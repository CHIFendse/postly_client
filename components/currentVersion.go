package components

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	"io"
)

type CurrentVersion struct{}

type VersionResponse struct {
	Success bool   `json:"success"`
	Version string `json:"version"`
}

func (v *CurrentVersion) GetCurrentVersion() (*VersionResponse, error) {
	url := "https://api.postly-mes.ru:8081/getVersion"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Print("Ошибка получения версии:", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("сервер вернул статус: %d, ошибка чтения тела: %w", resp.StatusCode, err)
		}
		log.Printf("[GetCurrentVersion] %s → %d, body: %s", url, resp.StatusCode, string(body))
		return nil, fmt.Errorf("сервер вернул статус: %d, тело: %s", resp.StatusCode, string(body))
	}
	var version VersionResponse
	if err := json.NewDecoder(resp.Body).Decode(&version); err != nil {
		return nil, fmt.Errorf("ошибка десериализации JSON: %w", err)
	}

	return &version, nil
}
