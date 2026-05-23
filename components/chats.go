package components

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"io"
	"log"
)

type Chats struct {
	ctx context.Context
	url string
}

// NewChats инициализирует компонент
func NewChats() *Chats {
	url := "http://84.22.132.243:8081/"
	return &Chats{
		url: url,
	}
}

// SetContext сохраняет контекст Wails
func (f *Chats) SetContext(ctx context.Context) {
	f.ctx = ctx
}

// CreateChat создает новый чат между текущим пользователем и выбранным собеседником
func (f *Chats) CreateChat(userId string, targetUsername string, token string) (map[string]interface{}, error) {
	// Подготавливаем данные для сервера
	data := map[string]string{
		"user_id":         userId,
		"target_username": targetUsername,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("ошибка кодирования JSON: %w", err)
	}
	url := f.url + "createChat"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == 409 {
			return nil, fmt.Errorf("пользователь с таким именем не найден")
		}
		return nil, fmt.Errorf("ошибка сервера: %d", resp.StatusCode)
	}

	// Читаем всё тело в память
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("не удалось прочитать тело: %w", err)
	}

	// Парсим из байтов, а не из потока
	var result map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга (тело было: %s): %w", string(bodyBytes), err)
	}

	// Возвращаем ID созданного (или найденного) чата
	return result, nil
}

// SearchUsers можно добавить сюда же метод для поиска новых людей по никнейму
func (f *Chats) SearchUsers(query string, token string) ([]map[string]interface{}, error) {
	data := map[string]string{"query": query}
	jsonData, _ := json.Marshal(data)
	url := f.url+"searchUsers"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var users []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&users)
	return users, nil
}

func (f *Chats) GetGroups(userId, token string) ([]Groups, error) {
    data := map[string]string{"id": userId}
    jsonData, err := json.Marshal(data)
    if err != nil {
        return nil, err
    }
    
    url := f.url + "getGroups"
    
    log.Printf("GetGroups request: url=%s, userId=%s, token=%s...", url, userId, token[:min(20, len(token))])
    
    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+token)

    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        log.Printf("GetGroups network error: %v", err)
        return nil, err
    }
    defer resp.Body.Close()

    log.Printf("GetGroups response status: %d", resp.StatusCode)

    if resp.StatusCode != http.StatusOK {
        bodyBytes, _ := io.ReadAll(resp.Body)
        log.Printf("GetGroups error body: %s", string(bodyBytes))
        
        var errResp map[string]string
        if err := json.Unmarshal(bodyBytes, &errResp); err == nil {
            if msg, ok := errResp["error"]; ok {
                return nil, fmt.Errorf(msg)
            }
            if msg, ok := errResp["message"]; ok {
                return nil, fmt.Errorf(msg)
            }
        }
        return nil, fmt.Errorf("сервер вернул ошибку: %d, тело: %s", resp.StatusCode, string(bodyBytes))
    }

    var groups []Groups
    if err := json.NewDecoder(resp.Body).Decode(&groups); err != nil {
        return nil, err
    }

    if groups == nil {
        groups = []Groups{}
    }

    log.Printf("GetGroups success: %d groups", len(groups))
    return groups, nil
}

type Groups struct {
    Id            string `json:"id"`
    Name          string `json:"name"`
    CreatedAt     string `json:"created_at"`
    LastMsg       string `json:"last_message"`
    LastMsgSender string `json:"username"`
    UpdatedAt     int    `json:"updated_at"`
}