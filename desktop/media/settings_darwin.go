//go:build darwin

package media

import (
	"errors"
	"os/exec"
)

var errUnsupported = errors.New("открытие настроек микрофона не поддерживается")

func settingsCommand() *exec.Cmd {
	return exec.Command("open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
}
