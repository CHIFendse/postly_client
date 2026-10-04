package components

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const fileAPIBaseURL = "https://api.postly-mes.ru:8081"

type FileSaver struct {
	app *application.App
}

func NewFileSaver(app *application.App) *FileSaver {
	return &FileSaver{app: app}
}

func (s *FileSaver) SaveFile(fileURL, fileName, token string) (bool, error) {
	if fileURL == "" {
		return false, fmt.Errorf("file url is required")
	}
	if fileName == "" {
		fileName = "image"
	}

	requestURL := fileURL
	if strings.HasPrefix(fileURL, "/") {
		requestURL = fileAPIBaseURL + fileURL
	}

	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return false, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return false, fmt.Errorf("download failed: %s", response.Status)
	}

	data, err := io.ReadAll(response.Body)
	if err != nil {
		return false, err
	}

	path, err := s.app.Dialog.SaveFile().
		AttachToWindow(s.app.Window.Current()).
		SetFilename(filepath.Base(fileName)).
		PromptForSingleSelection()
	if err != nil {
		return false, err
	}
	if path == "" {
		return false, nil
	}
	if err := writeFile(path, data); err != nil {
		return false, err
	}
	return true, nil
}

func writeFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}
