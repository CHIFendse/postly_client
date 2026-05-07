package pages

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v3/pkg/application"
    "encoding/json"
)

type ChatWS struct {
    // Используем мьютекс внутри клиента, чтобы соединение не "улетало"
    mu    sync.Mutex
    conn  *websocket.Conn
    token string
}

type MessageDTO struct {
    // Если сервер шлет "id", "chat_id", "text"
    ID       string `json:"id"`
    ChatID   string `json:"chat_id"`
    SenderID string `json:"sender_id"`
    Text     string `json:"text"`
    Type     string `json:"type"` // Это мы добавим сами
}
func (s *ChatWS) ServiceName() string { return "ChatWS" }

func (a *ChatWS) SetToken(token string) {
	a.token = token
	log.Println("Токен установлен, теперь можно подключаться")
}

func (a *ChatWS) Startup(_ any) {
	log.Println("ChatWS: Инициализировано (v3)")
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
    log.Println("Успех! WebSocket соединен (Клиент).")

    // Запускаем чтение в отдельной рутине
    go a.listenToMessages(c)
}

func (a *ChatWS) listenToMessages(c *websocket.Conn) {
    for {
        _, message, err := c.ReadMessage()
        if err != nil {
            return
        }

        // ЛОГ ДЛЯ ПРОВЕРКИ: что именно прислал сервер 8081?
        log.Printf("СЫРЫЕ ДАННЫЕ ОТ СЕРВЕРА: %s", string(message))

        var msg MessageDTO
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("Ошибка парсинга: %v", err)
            continue
        }

        // Если в логе выше поля есть, а после Unmarshal пропали — 
        // значит теги json:"..." в структуре MessageDTO не совпадают с ключами в JSON.
        
        msg.Type = "NEW_MESSAGE"

        // Пробрасываем объект целиком
        application.Get().Event.Emit("server_message", msg)
    }
}
func (a *ChatWS) SendWSMessage(payload string) {
	log.Println("Попытка отправки сообщения...")
    
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