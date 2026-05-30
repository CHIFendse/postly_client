package pages

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
)

type MessageInfo struct {
	Id        string `json:"id"`
	Text      string `json:"text"`
	ChatId    string `json:"chat_id"`
	SenderId  string `json:"sender_id"`
	CreatedAt int64  `json:"created_at"` // Unix milliseconds
	Username  string `json:"username"`
}

type Chat struct {
	url      string
	stopChan chan struct{}
	mu       sync.Mutex
	running  bool
}

func GetChat() *Chat {
	return &Chat{
		url:      "https://api.postly-mes.ru:8081",
		stopChan: make(chan struct{}),
	}
}

func (s *Chat) ServiceName() string { return "Chat" }
func (c *Chat) SetContext(_ any)    {}

func (c *Chat) GetMessages(chatId string, token string) ([]MessageInfo, error) {
	jsonData, _ := json.Marshal(map[string]string{"chat_id": chatId})
	req, err := http.NewRequest("POST", c.url+"/getMessages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := apiClient.Do(req)
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

func (c *Chat) GetUserChats(userId string, token string) ([]map[string]interface{}, error) {
	jsonData, _ := json.Marshal(map[string]string{"id": userId})
	req, err := http.NewRequest("POST", c.url+"/getChats", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := apiClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул ошибку: %d, %s", resp.StatusCode, string(bodyBytes))
	}

	var chats []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&chats); err != nil {
		return nil, err
	}
	return chats, nil
}

func (c *Chat) AddMessage(chat_id, sender_id, text, token string) (string, error) {
	jsonData, _ := json.Marshal(map[string]string{"chat_id": chat_id, "sender_id": sender_id, "text": text})
	req, err := http.NewRequest("POST", c.url+"/addMessage", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := apiClient.Do(req)
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
