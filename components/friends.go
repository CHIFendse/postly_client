package components

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Friends struct {
	ctx context.Context
}

// NewFriends инициализирует компонент
func NewFriends() *Friends {
	return &Friends{}
}

// SetContext сохраняет контекст Wails
func (f *Friends) SetContext(ctx context.Context) {
	f.ctx = ctx
}

// CreateChat создает новый чат между текущим пользователем и выбранным собеседником
func (f *Friends) CreateChat(userId string, targetUsername string, token string) (string, error) {
	// Подготавливаем данные для сервера
	data := map[string]string{
		"user_id":        userId,
		"target_username": targetUsername,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("ошибка кодирования JSON: %w", err)
	}

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/createChat", bytes.NewBuffer(jsonData))
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
		if resp.StatusCode == 409 {
            return "", fmt.Errorf("пользователь с таким именем не найден")
        }
        return "", fmt.Errorf("ошибка сервера: %d", resp.StatusCode)
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("ошибка парсинга ответа: %w", err)
	}

	// Возвращаем ID созданного (или найденного) чата
	return result["id"], nil
}

// SearchUsers можно добавить сюда же метод для поиска новых людей по никнейму
func (f *Friends) SearchUsers(query string, token string) ([]map[string]interface{}, error) {
	data := map[string]string{"query": query}
	jsonData, _ := json.Marshal(data)

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/searchUsers", bytes.NewBuffer(jsonData))
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