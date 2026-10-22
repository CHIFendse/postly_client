//go:build !(linux && cgo)

package nativecall

import "errors"

var errUnsupported = errors.New("на этой ОС звонки идут через WebView, нативный звук не используется")

type Sender interface {
	SendWSMessage(payload string) error
}

type Service struct{}

func New(Sender) *Service {
	return &Service{}
}

func (s *Service) ServiceName() string {
	return "NativeCall"
}

func (s *Service) Supported() bool {
	return false
}

func (s *Service) Start(chatID string) error {
	return errUnsupported
}

func (s *Service) Offer(chatID, sdp string) error {
	return errUnsupported
}

func (s *Service) SetMuted(muted bool) {}

func (s *Service) Stop() {}
