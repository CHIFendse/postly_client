package pages

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

type AuthService struct {
	// Здесь можно вынести IP в константу или переменную окружения
	apiBaseURL string
}

func NewAuthService() *AuthService {
	return &AuthService{
		apiBaseURL: "http://84.22.132.243:8081",
	}
}
func (s *AuthService) ServiceName() string {
    return "AuthService"
}
type AuthResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
	ID       string `json:"id"`
	Message  string `json:"message,omitempty"`
}

// Login выполняет вход через внешний API
func (s *AuthService) Login(username, password string) (*AuthResponse, error) {
	payload, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})

	resp, err := http.Post(s.apiBaseURL+"/login", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("ошибка соединения: %v", err)
	}
	defer resp.Body.Close()

	var result AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New(result.Message)
	}
	return &result, nil
}

// Register выполняет регистрацию
func (s *AuthService) Register(username, password, email, phone string) (string, error) {
	payload, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
		"email":    email,
		"phone":    phone,
	})

	resp, err := http.Post(s.apiBaseURL+"/register", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]string
		json.NewDecoder(resp.Body).Decode(&errData)
		fmt.Println(errData["message"])
		return "", errors.New(errData["message"])
	}
	return "Авторизация успешна, перелогиньтесь", nil
}
// VerifyToken проверяет валидность токена на сервере
func (s *AuthService) VerifyToken(token string) (bool, error) {
	req, err := http.NewRequest("GET", s.apiBaseURL+"/verify", nil)
	if err != nil {
		return false, err
	}

	// Добавляем заголовок авторизации
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("сетевая ошибка: %v", err)
	}
	defer resp.Body.Close()

	// Если статус 200, токен валиден
	if resp.StatusCode == http.StatusOK {
		return true, nil
	}

	// Во всех остальных случаях (401, 500 и т.д.) считаем токен невалидным
	return false, nil
}