package pages

import (
	"encoding/binary"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"os"

	"github.com/gen2brain/malgo"
	"github.com/hraban/opus"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	targetSampleRate = 48000
	targetChannels   = 1
	frameSizeMs      = 20
	opusFrameSize    = (targetSampleRate * frameSizeMs) / 1000
)

type VoiceChat struct {
	mu            sync.Mutex
	running       bool
	stopChan      chan struct{}
	userToken     string
	currentRoomID string
	app           *application.App
	url			  string
}

func NewVoiceChat() *VoiceChat {
	url := os.Getenv("API_BASE_URL")
	return &VoiceChat{stopChan: make(chan struct{}), url: url}
}

func (v *VoiceChat) ServiceName() string {
	return "VoiceChat"
}

func (v *VoiceChat) OpenCallWindow(roomID, nickname string) {
	// В v3 мы создаем окно через глобальное приложение или контекст
	application.Get().Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Звонок: " + nickname,
		// Width:  450,
		// Height: 600,
		URL:         "/#/call/" + roomID + "/" + nickname,
		AlwaysOnTop: true,
	})
}

// В v3 SetContext больше не нужен, так как рантайм доступен глобально
func (s *VoiceChat) SetContext(_ any) {}

func (s *VoiceChat) SetToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.userToken = token
}

func (s *VoiceChat) SetRoomID(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentRoomID = id
}

func (s *VoiceChat) Connect() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("уже подключено")
	}
	token := s.userToken
	s.mu.Unlock()

	// Авторизация
	tmp := "http://"+s.url + ":8081/"
	req, _ := http.NewRequest("GET", tmp, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ошибка авторизации")
	}
	defer resp.Body.Close()

	s.mu.Lock()
	s.stopChan = make(chan struct{})
	s.running = true
	s.mu.Unlock()

	go s.startAudioCapture()
	return nil
}

func (s *VoiceChat) Disconnect() {
	s.mu.Lock()
	if s.running {
		close(s.stopChan)
		s.running = false
	}
	s.mu.Unlock()
}

func (s *VoiceChat) startAudioCapture() {
	var (
		bufferMu      sync.Mutex
		jitterBuffer  = make(map[uint32][]int16)
		nextSeqToPlay uint32
		firstPacket   = true
		seq           uint32
		lastSample    int16 // Для плавного затухания

		// Параметры под Wi-Fi
		idealBuffer = 6  // 120мс запаса
		maxBuffer   = 15 // 300мс лимит задержки
	)
	tmp := s.url + ":8082"
	serverAddr, _ := net.ResolveUDPAddr("udp", tmp)
	conn, err := net.DialUDP("udp", nil, serverAddr)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadBuffer(1024 * 1024)
	conn.SetWriteBuffer(1024 * 1024)

	s.mu.Lock()
	conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
	s.mu.Unlock()

	enc, _ := opus.NewEncoder(targetSampleRate, targetChannels, opus.AppVoIP)
	dec, _ := opus.NewDecoder(targetSampleRate, targetChannels)
	enc.SetBitrate(24000)
	enc.SetInBandFEC(true)
	enc.SetPacketLossPerc(15)
	compBuf := make([]byte, 1500)
	
	onData := func(pOutput, pInput []byte, frameCount uint32) {
		bufferMu.Lock()
		defer bufferMu.Unlock()

		for i := range pOutput {
			pOutput[i] = 0
		}

		if !firstPacket {
			if len(jitterBuffer) > maxBuffer {
				for len(jitterBuffer) > idealBuffer {
					delete(jitterBuffer, nextSeqToPlay)
					nextSeqToPlay++
				}
			}

			if pcm, ok := jitterBuffer[nextSeqToPlay]; ok {
				for i := 0; i < int(frameCount); i++ {
					if i < len(pcm) && i*2+1 < len(pOutput) {
						lastSample = pcm[i]
						sample := uint16(lastSample)
						pOutput[i*2] = byte(sample)
						pOutput[i*2+1] = byte(sample >> 8)
					}
				}
				delete(jitterBuffer, nextSeqToPlay)
				nextSeqToPlay++
			} else {
				for i := 0; i < int(frameCount); i++ {
					lastSample = int16(float32(lastSample) * 0.98)
					sample := uint16(lastSample)
					if i*2+1 < len(pOutput) {
						pOutput[i*2] = byte(sample)
						pOutput[i*2+1] = byte(sample >> 8)
					}
				}
			}
		}

		if pInput != nil {
			samples := make([]int16, frameCount)
			var maxAmp int16
			for i := 0; i < int(frameCount); i++ {
				val := int16(binary.LittleEndian.Uint16(pInput[i*2 : i*2+2]))
				boosted := int32(val) * 2
				if boosted > 32767 {
					boosted = 32767
				} else if boosted < -32768 {
					boosted = -32768
				}
				samples[i] = int16(boosted)
				absV := samples[i]
				if absV < 0 {
					absV = -absV
				}
				if absV > maxAmp {
					maxAmp = absV
				}
			}

			if maxAmp > 150 {
				n, err := enc.Encode(samples, compBuf[4:])
				if err == nil && n > 0 {
					binary.BigEndian.PutUint32(compBuf[:4], seq)
					conn.Write(compBuf[:n+4])
					seq++
				}
			}
		}
	}

	malgoCtx, _ := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	defer malgoCtx.Uninit()

	deviceConfig := malgo.DefaultDeviceConfig(malgo.Duplex)
	deviceConfig.SampleRate = targetSampleRate
	deviceConfig.PeriodSizeInFrames = opusFrameSize
	deviceConfig.Playback.Format = malgo.FormatS16
	deviceConfig.Capture.Format = malgo.FormatS16
	deviceConfig.Playback.Channels = targetChannels
	deviceConfig.Capture.Channels = targetChannels

	pDev, err := malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onData})
	if err != nil {
		deviceConfig.DeviceType = malgo.Playback
		pDev, _ = malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onData})
	}

	if pDev != nil {
		pDev.Start()
		defer pDev.Uninit()
	}

	go func() {
		buf := make([]byte, 2048)
		out := make([]int16, opusFrameSize)
		for {
			n, _, err := conn.ReadFromUDP(buf)
			if err != nil {
				return
			}
			if n < 20 {
				continue
			}

			inSeq := binary.BigEndian.Uint32(buf[:4])
			nDec, err := dec.Decode(buf[4:n], out)
			if err != nil {
				continue
			}

			ready := make([]int16, nDec)
			copy(ready, out)

			bufferMu.Lock()
			if firstPacket {
				if len(jitterBuffer) >= idealBuffer {
					nextSeqToPlay = inSeq - uint32(idealBuffer)
					firstPacket = false
				}
			}
			jitterBuffer[inSeq] = ready
			bufferMu.Unlock()
		}
	}()

	go func() {
		for {
			time.Sleep(5 * time.Second)
			s.mu.Lock()
			if !s.running {
				s.mu.Unlock()
				return
			}
			conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
			s.mu.Unlock()
		}
	}()

	<-s.stopChan
	conn.Write([]byte("BYE"))
}
