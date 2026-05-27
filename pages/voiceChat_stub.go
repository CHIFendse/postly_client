//go:build noaudio

package pages

// Stub-реализация VoiceChat без malgo/opus — только для диагностики.
// Собирать: go build -tags noaudio

type VoiceChat struct {
	running       bool
	userToken     string
	currentRoomID string
	url           string
}

type CallEventDTO struct {
	Type     string `json:"type"`
	ChatID   string `json:"chat_id"`
	SenderID string `json:"sender_id"`
	Data     string `json:"data"`
}

func NewVoiceChat() *VoiceChat {
	return &VoiceChat{url: "84.22.132.243"}
}

func (v *VoiceChat) ServiceName() string  { return "VoiceChat" }
func (v *VoiceChat) SetContext(_ any)     {}
func (v *VoiceChat) SetToken(token string) { v.userToken = token }
func (v *VoiceChat) SetRoomID(id string)  { v.currentRoomID = id }
func (v *VoiceChat) StartVoice(chatID string) error { return nil }
func (v *VoiceChat) Disconnect()          {}
func (v *VoiceChat) Connect() error       { return nil }
func (v *VoiceChat) OpenCallWindow(roomID, nickname, typing string) {}
