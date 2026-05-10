package pages

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"github.com/gorilla/websocket"
    "encoding/json"
    "github.com/wailsapp/wails/v3/pkg/application"
    
    
)

type ChatWS struct {
    // Используем мьютекс внутри клиента, чтобы соединение не "улетало"
    mu    sync.Mutex
    conn  *websocket.Conn
    token string
}

type MessageDTO struct {
    ID       string `json:"id"`
    ChatID   string `json:"chat_id"`
    SenderID string `json:"sender_id"`
    Text     string `json:"text"`
    Type  string `json:"type"`
    Name string `json:"name"`
    SenderName string `json:"username"`
}
func (s *ChatWS) ServiceName() string { return "ChatWS" }

func (a *ChatWS) SetToken(token string) {
	a.token = token
}

func (a *ChatWS) Connect(chatID string) {
    a.mu.Lock()
    defer a.mu.Unlock()

    if a.token == "" {
        log.Println("Ошибка: Отсутствует токен")
        return
    }

    // Если уже есть соединение, закрываем старое
    if a.conn != nil {
        a.conn.Close()
    }

    url := "ws://" + os.Getenv("API_BASE_URL") + ":8081/ws"
    // Если нужно подключаться к конкретному чату
    if chatID != "" {
        url = fmt.Sprintf("%s?chat_id=%s", url, chatID)
    }

    header := make(http.Header)
    header.Add("Authorization", "Bearer "+a.token)

    c, _, err := websocket.DefaultDialer.Dial(url, header)
    if err != nil {
        log.Printf("Ошибка Dial: %v", err)
        return
    }

    a.conn = c

    // Запускаем чтение в отдельной рутине
    go a.listenToMessages(c)
}
func (a *ChatWS) listenToMessages(c *websocket.Conn) {
    log.Println("WS: Новая горутина чтения запущена")
    defer func() {
        c.Close()
        log.Println("WS: Горутина чтения завершена")
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
        
        // В v3 API часто требует вызова метода Events() с большой буквы
        app := application.Get()
        if app != nil {
            app.Event.Emit(
                "server_message",
                msg,
            )
        }
    }
}

func (a *ChatWS) SendWSMessage(payload string) {
    a.mu.Lock()
    defer a.mu.Unlock()
    if a.conn == nil {
        log.Println("ОШИБКА: Соединение nil. Проверь, был ли вызван Connect() успешно.")
        // Попробуй вызвать Connect автоматически, если токен есть
        return
    }

    err := a.conn.WriteMessage(websocket.TextMessage, []byte(payload))
    if err != nil {
        log.Printf("Ошибка отправки: %v", err)
        a.conn.Close()
        a.conn = nil
    }
}