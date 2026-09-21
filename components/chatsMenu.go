package components

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

)

type ChatsMenu struct {
	ctx context.Context
	url string
}
type Request struct {
	Id       string `json:"id"`
	SenderId string `json:"sender_id"`
	Username string `json:"username"`
	CreatedAt int64 `json:"created_at"`
}

type ReqOut struct {
    Id         string `json:"id"`
    ReceiverId string `json:"receiver_id"`
    Username   string `json:"username"`
    CreatedAt  int64  `json:"created_at"`
}

type User struct {
	Id       string `json:"id"`
	Username string `json:"username"`
}

type Groups struct {
	Id            string `json:"id"`
	Name          string `json:"name"`
	CreatedAt     string `json:"created_at"`
	LastMsg       string `json:"last_message"`
	LastMsgSender string `json:"username"`
	UpdatedAt     int    `json:"updated_at"`
}


func NewChats() *ChatsMenu {
	url := "https://api.postly-mes.ru:8081/"
	return &ChatsMenu{
		url: url,
	}
}


func (cm *ChatsMenu) SetContext(ctx context.Context) {
	cm.ctx = ctx
}

// CreateChat создает новый чат между текущим пользователем и выбранным собеседником
func (cm *ChatsMenu) CreateChat(userId string, targetUsername string, token string) (map[string]interface{}, error) {
	// Подготавливаем данные для сервера
	data := map[string]string{
		"user_id":         userId,
		"target_username": targetUsername,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("ошибка кодирования JSON: %w", err)
	}
	url := cm.url + "createChat"
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
func (cm *ChatsMenu) SearchUsers(query string, token string) ([]map[string]interface{}, error) {
	data := map[string]string{"query": query}
	jsonData, _ := json.Marshal(data)
	url := cm.url + "searchUsers"
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

func (cm *ChatsMenu) GetGroups(userId, token string) ([]Groups, error) {
	data := map[string]string{"id": userId}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	url := cm.url + "getGroups"

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

func (cm *ChatsMenu) GetFriendRequests(token string) ([]Request, error) {
	url := cm.url + "/getFriendRequests"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result []Request
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга: %w", err)
	}
	if result == nil {
		result = []Request{}
	}
	return result, nil
}

func (cm *ChatsMenu) SendFriendRequest(username, token string) (string, error) {
	url := cm.url + "/sendFriendRequest"

	data := map[string]string{
		"username": username,
	}

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

	return result["request_id"], nil
}

func (cm *ChatsMenu) AcceptFriendRequest(requestId, token string) (bool, error) {
	url := cm.url + "/acceptFriendRequest"
	
	data := map[string]string{
		"request_id": requestId,
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]bool
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}
	return result["status"], nil
}

func (cm *ChatsMenu) DeclineFriendRequest(requestId, token string) (bool, error) {
	url := cm.url + "/declineFriendRequest"

	data := map[string]string {
		"request_id": requestId,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]bool
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}
	
	return result["status"], nil
}

func (cm *ChatsMenu) GetFriends(token string) ([]User, error) {
	url := cm.url + "/getFriends"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Authorization", "Bearer " +token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result []User
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга: %w", err)
	}
	if result == nil {
		result = []User{}
	}
	return result, nil
}

func (cm *ChatsMenu) DeleteFriend(friendId, token string) (bool, error) {
	url := cm.url + "/deleteFriend"

	data := map[string]string {
		"friend_id": friendId,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}

	return result["success"]=="ok", nil
}

func (cm *ChatsMenu) CancelFriendRequest(requestId, token string) (bool, error) {
	url := cm.url + "/cancelFriendRequest"
	
	data := map[string]string {
		"request_id": requestId,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}
	
	var result map[string]bool
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}

	return result["ok"], nil
}

func (cm *ChatsMenu) GetSentRequests(token string) ([]ReqOut, error) {
	url := cm.url + "/getSentRequests"
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result []ReqOut
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга: %w", err)
	}
	if result == nil {
		result = []ReqOut{}
	}
	return result, nil

}


func (cm *ChatsMenu) DeleteChat(chatId, token string) (bool, error) {
	url := cm.url + "/deleteChat"

	data := map[string]string {
		"chat_id": chatId,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]bool
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}

	return result["status"], nil
}

func (cm *ChatsMenu) ClearChat(chatId, token string) (bool, error) {
	url := cm.url + "/clearChat"
	
	data := map[string]string {
		"chat_id": chatId,
	}
	
	jsonData, err := json.Marshal(data)
	if err != nil {
		return false, fmt.Errorf("ошибка создания JSON: %w", err)
	}
	
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, fmt.Errorf("ошибка создания запроса: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сервер недоступен: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return false, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}
	
	var result map[string]bool
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("ошибка парсинга: %w", err)
	}
	
	return result["status"], nil
}


func (cm *ChatsMenu) CreateGroup(name, avatarColor, avatarFile, token string,members []string,isPrivate bool) (map[string]interface{}, error) {
	url := cm.url + "/createGroup"

	data := map[string]interface{}{
		"name":         name,
		"is_private":   isPrivate,
		"members":      members,     // usernames
		"avatar_color": avatarColor,
		"avatar_file":  avatarFile,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания JSON: %w", err)
	}

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
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("сервер вернул %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга: %w", err)
	}

	return result, nil
}