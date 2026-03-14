package components

// import (
// 	"context"
// 	"sync"
// )

// type VoiceChat struct { // Название сохранено
// 	ctx       context.Context
// 	stopChan  chan struct{}
// 	mu        sync.Mutex
// 	running   bool
// 	userToken string // Поле для хранения JWT
// }


// func NewVoiceChat() *VoiceChat {
// 	return &VoiceChat{}
// }

// func (s *VoiceChat) SetContext(ctx context.Context) {
// 	s.ctx = ctx
// }

// // Эту функцию мы вызываем из React: SetToken(token)
// func (s *VoiceChat) SetToken(token string) {
// 	s.mu.Lock()
// 	defer s.mu.Unlock()
// 	s.userToken = token
// }

// const (
// 	targetSampleRate = 48000
// 	targetChannels   = 1
// 	frameSizeMs      = 20
// 	opusFrameSize    = (targetSampleRate * frameSizeMs) / 1000
// )

// type Response struct {
// 	Status bool `json:"status"`
// }