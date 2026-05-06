package pages

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ChatWS struct {
	conn  *websocket.Conn
	token string
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
	if a.token == "" {
		log.Println("Ошибка: Отсутствует токен")
		return
	}

	if a.conn != nil {
		log.Println("Закрытие предыдущего соединения...")
		a.conn.Close()
		a.conn = nil
	}

	url := "ws://"+os.Getenv("API_BASE_URL")+":8081/ws"
	if chatID != "" {
		url = fmt.Sprintf("%s?chat_id=%s", url, chatID)
	}

	header := make(http.Header)
	header.Add("Authorization", "Bearer "+a.token)

	c, resp, err := websocket.DefaultDialer.Dial(url, header)
	if err != nil {
		if resp != nil {
			log.Printf("Сервер отклонил запрос. HTTP Код: %d", resp.StatusCode)
		}
		log.Printf("Ошибка Dial: %v", err)
		return
	}

	a.conn = c
	log.Println("Успех! WebSocket соединен.")

	go a.listenToMessages()
}

func (a *ChatWS) listenToMessages() {
	for {
		if a.conn == nil {
			return
		}

		_, message, err := a.conn.ReadMessage()
		if err != nil {
			a.conn = nil
			return
		}

		var sysMsg struct {
			Type string      `json:"type"`
			Data interface{} `json:"data"`
		}

		// ИСПРАВЛЕНИЕ: Передаем имя события строкой, а данные вторым аргументом
		if err := json.Unmarshal(message, &sysMsg); err == nil && sysMsg.Type != "" {
			if sysMsg.Type == "NEW_CHAT" {
				application.Get().Event.Emit("refresh_chat_list", sysMsg.Data)
			}
		}

		application.Get().Event.Emit("server_message", string(message))
	}
}
func (a *ChatWS) SendWSMessage(payload string) {
	if a == nil || a.conn == nil {
		log.Println("ОШИБКА: Соединение еще не установлено.")
		return
	}

	err := a.conn.WriteMessage(websocket.TextMessage, []byte(payload))
	if err != nil {
		log.Printf("Ошибка отправки: %v", err)
		a.conn = nil
	}
}
