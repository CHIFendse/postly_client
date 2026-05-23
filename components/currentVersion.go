package components

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
	"fmt"
)

type CurrentVersion struct {}

type VersionResponse struct {
	Success 	bool 	`json:"success"`
	Version 	string 	`json:"version"`
}


func (v *CurrentVersion) GetCurrentVersion() (*VersionResponse, error) {
	url := "http://"+os.Getenv("API_BASE_URL")+":8081/getVersion"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Print("Ошибка получения версии:", err.Error())
		return nil, err
	}
	defer resp.Body.Close() 
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("сервер вернул статус: %d", resp.StatusCode)
	}
	var version VersionResponse
	if err := json.NewDecoder(resp.Body).Decode(&version); err != nil {
		return nil, fmt.Errorf("ошибка десериализации JSON: %w", err)
	}

	return &version, nil
}