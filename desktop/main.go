package main

import (
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"client/components"
	"client/media"
	"client/nativecall"
	"client/pages"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
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
	var mainWindow *application.WebviewWindow
	app := application.New(application.Options{
		Name: "Postly",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "ru.postly-mes.desktop",
			OnSecondInstanceLaunch: func(application.SecondInstanceData) {
				if mainWindow == nil {
					return
				}
				mainWindow.UnMinimise()
				mainWindow.Show()
				mainWindow.Focus()
			},
		},
	})

	log.Println("Registering services...")
	chatWSService := &pages.ChatWS{}
	chatService := pages.GetChat()
	chatsComponent := components.NewChats()
	authService := pages.NewAuthService()
	getVersion := &components.CurrentVersion{}
	fileSaver := components.NewFileSaver(app)
	microphone := media.NewMicrophoneService()
	nativeCall := nativecall.New(chatWSService)

	app.RegisterService(application.NewService(microphone))
	app.RegisterService(application.NewService(nativeCall))
	app.RegisterService(application.NewService(chatWSService))
	app.RegisterService(application.NewService(chatService))
	app.RegisterService(application.NewService(chatsComponent))
	app.RegisterService(application.NewService(authService))
	app.RegisterService(application.NewService(getVersion))
	app.RegisterService(application.NewService(fileSaver))

	log.Println("Creating window...")
	mainWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:              "Postly",
		Width:              1024,
		Height:             768,
		URL:                "/",
		MinWidth:           380,
		MinHeight:          540,
		Zoom:               1.0,
		ZoomControlEnabled: false,
		Windows: application.WindowsWindow{
			Permissions: map[application.CoreWebView2PermissionKind]application.CoreWebView2PermissionState{
				application.CoreWebView2PermissionKindMicrophone: application.CoreWebView2PermissionStateAllow,
			},
		},
	})
	mainWindow.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		media.EnableWebviewMedia(mainWindow)
	})

	log.Println("Running app...")
	err := app.Run()
	if err != nil {
		log.Printf("ERROR app.Run(): %v", err)
	}
	log.Println("App exited.")
}
