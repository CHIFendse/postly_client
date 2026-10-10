//go:build linux

package media

import (
	"errors"
	"os/exec"
)

var errUnsupported = errors.New("открытие настроек микрофона не поддерживается")

func settingsCommand() *exec.Cmd {
	candidates := [][]string{
		{"gnome-control-center", "sound"},
		{"systemsettings", "kcm_pulseaudio"},
		{"pavucontrol", "--tab=4"},
	}
	for _, c := range candidates {
		if path, err := exec.LookPath(c[0]); err == nil {
			return exec.Command(path, c[1:]...)
		}
	}
	return nil
}
