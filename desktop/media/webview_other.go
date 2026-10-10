//go:build !(linux && cgo && !gtk4)

package media

import "github.com/wailsapp/wails/v3/pkg/application"

func EnableWebviewMedia(_ *application.WebviewWindow) {}
