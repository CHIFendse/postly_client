//go:build windows

package media

import (
	"errors"
	"os/exec"
)

var errUnsupported = errors.New("открытие настроек микрофона не поддерживается")

func settingsCommand() *exec.Cmd {
	return exec.Command("explorer.exe", "ms-settings:privacy-microphone")
}
