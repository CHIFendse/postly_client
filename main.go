package main

import (
	"embed"
	"log"

	"client/components"
	"client/pages"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {

	app := application.New(application.Options{
        Name: "Postly",
        Assets: application.AssetOptions{
            Handler: application.AssetFileServerFS(assets),
        },
    })

    // 2. Инициализируем сервисы, передавая им app
    voiceService := pages.NewVoiceChat()
    chatWSService := &pages.ChatWS{}
    chatService := pages.GetChat()
    chatsComponent := components.NewChats()

    // 3. Регистрируем каждый сервис через метод, который мы видим на скриншоте
    app.RegisterService(application.NewService(voiceService))
	app.RegisterService(application.NewService(chatWSService))
	app.RegisterService(application.NewService(chatService))
	app.RegisterService(application.NewService(chatsComponent))

	// 3. Описываем главное окно
	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Postly",
		Width:  1024,
		Height: 768,
		URL:    "/", // или твой стартовый путь
	})
	// Запускаем
	err := app.Run()

	if err != nil {
		log.Println("Предупреждение: .env файл не найден, используются системные переменные")
	}	
}
