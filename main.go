package main

import (
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"client/components"
	"client/pages"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func setupFileLog() *os.File {
	logDir, err := os.UserConfigDir()
	if err != nil {
		logDir = os.TempDir()
	}
	logDir = filepath.Join(logDir, "Postly")
	_ = os.MkdirAll(logDir, 0755)
	logPath := filepath.Join(logDir, "postly.log")
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return nil
	}
	log.SetOutput(f)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Printf("=== Postly starting %s ===", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "Log file: %s\n", logPath)
	return f
}

func main() {
	logFile := setupFileLog()
	if logFile != nil {
		defer logFile.Close()
	}

	log.Println("Creating application...")
	app := application.New(application.Options{
		Name: "Postly",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	log.Println("Registering services...")
	voiceService := pages.NewVoiceChat()
	chatWSService := &pages.ChatWS{}
	chatService := pages.GetChat()
	chatsComponent := components.NewChats()
	authService := pages.NewAuthService()
	getVersion := &components.CurrentVersion{}

	app.RegisterService(application.NewService(voiceService))
	app.RegisterService(application.NewService(chatWSService))
	app.RegisterService(application.NewService(chatService))
	app.RegisterService(application.NewService(chatsComponent))
	app.RegisterService(application.NewService(authService))
	app.RegisterService(application.NewService(getVersion))

	log.Println("Creating window...")
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:    "Postly",
		Width:    1024,
		Height:   768,
		URL:      "/",
		MinWidth:  380,
		MinHeight: 540,
	})

	log.Println("Running app...")
	err := app.Run()
	if err != nil {
		log.Printf("ERROR app.Run(): %v", err)
	}
	log.Println("App exited.")
}
