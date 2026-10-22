package pages

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ChatWS struct {
	mu    sync.Mutex
	conn  *websocket.Conn
	token string
}

type MessageDTO struct {
	ID          string `json:"id"`
	MessageID   string `json:"message_id"`
	ChatID      string `json:"chat_id"`
	SenderID    string `json:"sender_id"`
	Text        string `json:"text"`
	Type        string `json:"type"`
	Name        string `json:"name"`
	SenderName  string `json:"username"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
	LastMessage string `json:"last_message"`
	MessageType string `json:"message_type"`
	FileURL     string `json:"file_url"`
	FileName    string `json:"file_name"`
	FileSize    string `json:"file_size"`
	SDP         string `json:"sdp,omitempty"`
	UserIDs     string `json:"user_ids,omitempty"`
	Kind        string `json:"kind,omitempty"`
	Error       string `json:"error,omitempty"`
}

func (s *ChatWS) ServiceName() string { return "ChatWS" }

// Смена токена = смена аккаунта (или выход). Соединение авторизовано старым
// токеном, и сервер берёт отправителя из него — поэтому закрываем его.
// Горутина чтения сама переподключится уже с новым токеном (или не станет,
// если токен пустой).
func (a *ChatWS) SetToken(token string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.token == token {
		return
	}
	a.token = token
	if a.conn != nil {
		a.conn.Close()
		a.conn = nil
	}
}

func (a *ChatWS) Connect(chatID string) error {
	a.mu.Lock()

	if a.token == "" {
		a.mu.Unlock()
		log.Println("Ошибка: Отсутствует токен")
		return fmt.Errorf("отсутствует токен")
	}

	// Уже подключены — не пересоздаём
	if a.conn != nil {
		a.mu.Unlock()
		return nil
	}

	tok := a.token
	a.mu.Unlock()

	u, err := url.Parse("wss://api.postly-mes.ru:8081/ws")
	if err != nil {
		return err
	}
	q := u.Query()
	q.Set("token", tok)
	u.RawQuery = q.Encode()

	header := make(http.Header)
	header.Add("Authorization", "Bearer "+tok) // fallback

	dialer := *websocket.DefaultDialer

	c, resp, err := dialer.Dial(u.String(), header)
	if err != nil {
		if resp != nil {
			log.Printf("❌ СЕРВЕР ВЕРНУЛ ОШИБКУ HANDSHAKE. Статус: %d", resp.StatusCode)
		} else {
			log.Printf("❌ Ошибка Dial (WSS): %v", err)
		}
		return err
	}

	a.mu.Lock()
	// Пока дозванивались, сменился аккаунт — это соединение уже чужое
	if a.token != tok {
		hasToken := a.token != ""
		a.mu.Unlock()
		c.Close()
		if hasToken {
			return a.Connect("")
		}
		return nil
	}
	// Кто-то успел подключиться, пока мы дозванивались — закрываем новый
	if a.conn != nil {
		a.mu.Unlock()
		c.Close()
		return nil
	}
	a.conn = c
	a.mu.Unlock()

	log.Println("WS: Успешно подключено к", u.String())

	go a.listenToMessages(c)
	return nil
}

func (a *ChatWS) listenToMessages(c *websocket.Conn) {
	log.Println("WS: Новая горутина чтения запущена")
	defer func() {
		c.Close()
		log.Println("WS: Горутина чтения завершена")

		a.mu.Lock()
		if a.conn == c {
			a.conn = nil
		}
		hasToken := a.token != ""
		a.mu.Unlock()

		// Авто-reconnect через 3 секунды, как в app.js
		if hasToken {
			time.AfterFunc(3*time.Second, func() {
				_ = a.Connect("")
			})
		}
	}()

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Printf("WS Read Error: %v", err)
			return
		}

		var msg MessageDTO
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Ошибка декодирования: %v", err)
			continue
		}
		if msg.Type == "" {
			msg.Type = "NEW_MESSAGE"
		}
		logCallSignal(msg)

		app := application.Get()
		if app != nil {
			app.Event.Emit("server_message", msg)
		}
	}
}

// SendWSMessage возвращает error — Wails-биндинг отдаёт его в JS вторым значением.
func (a *ChatWS) SendWSMessage(payload string) error {
	a.mu.Lock()
	conn := a.conn
	token := a.token
	a.mu.Unlock()

	if conn == nil {
		if token == "" {
			return fmt.Errorf("нет токена для подключения")
		}
		if err := a.Connect(""); err != nil {
			return fmt.Errorf("нет соединения: %w", err)
		}

		a.mu.Lock()
		conn = a.conn
		a.mu.Unlock()
		if conn == nil {
			return fmt.Errorf("нет соединения")
		}
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if a.conn == nil {
		return fmt.Errorf("нет соединения")
	}

	if err := a.conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		log.Printf("Ошибка отправки: %v", err)
		a.conn.Close()
		a.conn = nil
		return err
	}

	log.Printf("Сообщение отправлено: %s", payload)
	return nil
}
