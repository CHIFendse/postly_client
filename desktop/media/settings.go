package media

type MicrophoneService struct{}

func NewMicrophoneService() *MicrophoneService {
	return &MicrophoneService{}
}

func (m *MicrophoneService) ServiceName() string {
	return "MicrophoneService"
}

func (m *MicrophoneService) CanOpenSettings() bool {
	return settingsCommand() != nil
}

func (m *MicrophoneService) OpenSettings() error {
	cmd := settingsCommand()
	if cmd == nil {
		return errUnsupported
	}
	return cmd.Start()
}
