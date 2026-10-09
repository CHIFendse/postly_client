package pages

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)
var apiClient = &http.Client{}

// FlexInt64 принимает и число, и строку ("12345", ""): сервер хранит file_size строкой
type FlexInt64 int64

func (f *FlexInt64) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return err
	}
	*f = FlexInt64(n)
	return nil
}

type MessageInfo struct {
	Id        string `json:"id"`
	Text      string `json:"text"`
	ChatId    string `json:"chat_id"`
	SenderId  string `json:"sender_id"`
	CreatedAt int64  `json:"created_at"` // Unix milliseconds
	Username  string `json:"username"`
	Type 	  string `json:"type"`
	FileName  string `json:"file_name"`
	FileSize  FlexInt64 `json:"file_size"`
	FileUrl   string `json:"file_url"`
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
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул ошибку: %d, %s", resp.StatusCode, string(bodyBytes))
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

func (c *Chat) DeleteMessage(messageId, token string) (string, error) {
	url := c.url + "/deleteMessage"

	data := map[string]string{"message_id": messageId}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("ошибка создания JSON: %w", err)
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("ошибка парсинга: %w", err)
	}

	return result["chat_id"], nil
}