package pages

import (
	"context"
	"log"
    "net/http"
	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"fmt"
    "encoding/json"
)

type ChatWS struct {
    ctx  context.Context
    conn *websocket.Conn
	token string
}

func (a *ChatWS) SetToken(token string) {
    a.token = token
    log.Println("Токен установлен, теперь можно подключаться")
}

func (a *ChatWS) Startup(ctx context.Context) {
    a.ctx = ctx
    log.Println("ChatWS: Контекст инициализирован")
}

func (a *ChatWS) Connect(chatID string) {
    if a.token == "" {
        log.Println("Ошибка: Отсутствует chat_id или токен")
        return
    }

    // Если соединение уже есть — закрываем его корректно
    if a.conn != nil {
        log.Println("Закрытие предыдущего соединения...")
        a.conn.Close()
        a.conn = nil
    }

    // Формируем финальный URL
    url := "ws://84.22.132.243:8081/ws"
    if chatID != "" {
        url = fmt.Sprintf("%s?chat_id=%s", url, chatID)
    }

    header := make(http.Header)
    header.Add("Authorization", "Bearer "+a.token)

    // Выполняем подключение
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
    
    // Запускаем чтение в отдельной горутине
    go a.listenToMessages()
}


func (a *ChatWS) listenToMessages() {
    for {
        if a.conn == nil {
            log.Println("КЛИЕНТ: Соединение потеряно, выхожу из цикла")
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

        if err := json.Unmarshal(message, &sysMsg); err == nil && sysMsg.Type != "" {
            log.Printf("КЛИЕНТ: Получено системное уведомление: %s", sysMsg.Type)
            
            if sysMsg.Type == "NEW_CHAT" {
                // Отправляем специальное событие для обновления списка друзей
                runtime.EventsEmit(a.ctx, "refresh_chat_list", sysMsg.Data)
            }
            // Можно добавить другие типы: "USER_ONLINE", "CALL" и т.д.
        }

        // Отправляем во фронтенд
        runtime.EventsEmit(a.ctx, "server_message", string(message))
        log.Println("КЛИЕНТ: Событие успешно отправлено в JS")
    }
}


func (a *ChatWS) SendWSMessage(payload string) {
    // 1. Проверяем, не пустой ли объект соединения
    if a == nil || a.conn == nil {
        log.Println("ОШИБКА: Соединение еще не установлено. Сообщение проигнорировано.")
        return
    }

    // 2. Пытаемся отправить
    err := a.conn.WriteMessage(websocket.TextMessage, []byte(payload))
    if err != nil {
        log.Printf("Ошибка отправки: %v", err)
        // Если ошибка связи, обнуляем коннект, чтобы сработал автореконнект
        a.conn = nil 
    }
}