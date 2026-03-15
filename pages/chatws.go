package pages

import (
	"context"
	"log"
    "net/http"
	"github.com/gorilla/websocket"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"fmt"
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
    if chatID == "" || a.token == "" {
        log.Println("Ошибка: Отсутствует chat_id или токен")
        return
    }

    // Если соединение уже есть — закрываем его корректно
    if a.conn != nil {
        log.Println("Закрытие предыдущего соединения...")
        a.conn.Close()
        a.conn = nil // Обязательно зануляем!
    }

    // Формируем финальный URL
    url := fmt.Sprintf("ws://84.22.132.243:8081/ws?chat_id=%s", chatID)
    header := make(http.Header)
    header.Add("Authorization", "Bearer "+a.token)
    log.Printf("КЛИЕНТ: Подключение к чату %s (токен: %s...)", chatID, a.token[:10])

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
    log.Println("КЛИЕНТ: Цикл чтения запущен")
    for {
        if a.conn == nil {
            log.Println("КЛИЕНТ: Соединение потеряно, выхожу из цикла")
            return
        }

        messageType, message, err := a.conn.ReadMessage()
        if err != nil {
            log.Printf("КЛИЕНТ: Ошибка ReadMessage: %v", err)
            a.conn = nil
            return
        }

        log.Printf("КЛИЕНТ: Получены данные (тип %d): %s", messageType, string(message))

        if a.ctx == nil {
            log.Println("КЛИЕНТ: ОШИБКА - ctx is nil, не могу отправить в JS")
            continue
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