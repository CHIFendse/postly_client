package main

import (
	"embed"
	"context"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"client/pages"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	voiceService := pages.NewVoiceChat()
	chatApp := pages.GetChat()
	chatWS := &pages.ChatWS{}
	// Create application with options
	err := wails.Run(&options.App{
		Title:  "client",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
            voiceService.SetContext(ctx)
			chatApp.SetContext(ctx)
			chatWS.Startup(ctx)
        },
		Bind: []interface{}{
			voiceService,
			chatApp,
			chatWS,

		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
