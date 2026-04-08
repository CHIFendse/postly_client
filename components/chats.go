package components

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Chats struct {
	ctx context.Context
}

// NewChats инициализирует компонент
func NewChats() *Chats {
	return &Chats{}
}

// SetContext сохраняет контекст Wails
func (f *Chats) SetContext(ctx context.Context) {
	f.ctx = ctx
}

// CreateChat создает новый чат между текущим пользователем и выбранным собеседником
func (f *Chats) CreateChat(userId string, targetUsername string, token string) ([]map[string]interface{}, error) {
	// Подготавливаем данные для сервера
	data := map[string]string{
		"user_id":        userId,
		"target_username": targetUsername,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("ошибка кодирования JSON: %w", err)
	}

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/createChat", bytes.NewBuffer(jsonData))
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

	var result []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга ответа: %w", err)
	}

	// Возвращаем ID созданного (или найденного) чата
	return result, nil
}

// SearchUsers можно добавить сюда же метод для поиска новых людей по никнейму
func (f *Chats) SearchUsers(query string, token string) ([]map[string]interface{}, error) {
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

func (f *Chats) GetGroups(userId, token string) ([]map[string]interface{}, error){
	data := map[string]string{"id": userId}
	jsonData, _ := json.Marshal(data)

	req, err := http.NewRequest("POST", "http://84.22.132.243:8081/getGroups", bytes.NewBuffer(jsonData))
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