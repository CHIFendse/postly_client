package pages

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// MessageInfo описывает структуру сообщения для фронтенда
type MessageInfo struct {
	Id        string    `json:"id"`
	Text      string    `json:"text"`
	ChatId    string    `json:"chat_id"`
	SenderId  string    `json:"sender_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Chat struct {
	ctx      context.Context
	stopChan chan struct{}
	mu       sync.Mutex
	running  bool
}

// GetChat инициализирует компонент
func GetChat() *Chat {
	return &Chat{
		stopChan: make(chan struct{}),
	}
}

// SetContext сохраняет контекст Wails
func (c *Chat) SetContext(ctx context.Context) {
	c.ctx = ctx
}

// GetMessages обращается к твоему серверному эндпоинту handleGetMessages
func (c *Chat) GetMessages(chatId string, token string) ([]MessageInfo, error) {
	data := map[string]string{"chat_id": chatId}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("ошибка кодирования JSON: %w", err)
	}

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/getMessages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// Добавляем токен
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("сервер вернул ошибку: %d", resp.StatusCode)
	}

	var messages []MessageInfo
	if err := json.NewDecoder(resp.Body).Decode(&messages); err != nil {
		return nil, fmt.Errorf("ошибка парсинга сообщений: %w", err)
	}

	return messages, nil
}

// GetUserChats вызывает твой handleGetChats на сервере
func (c *Chat) GetUserChats(userId string, token string) ([]map[string]interface{}, error) {
	data := map[string]string{"id": userId}
	jsonData, _ := json.Marshal(data)

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/getChats", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// Добавляем токен
	req.Header.Set("Authorization", "Bearer "+token)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("сервер вернул ошибку: %d", resp.StatusCode)
	}

	var chats []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&chats); err != nil {
		return nil, err
	}
	
	return chats, nil
}

// AddMessage добавляет сообщение через сервер
func (c *Chat) AddMessage(chat_id, sender_id, text, token string) (string, error) {
	data := map[string]string{"chat_id": chat_id, "sender_id": sender_id, "text": text}
	jsonData, _ := json.Marshal(data)
	
	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/addMessage", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	// Добавляем токен
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("сервер вернул ошибку: %d", resp.StatusCode)
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result["id"], nil
}