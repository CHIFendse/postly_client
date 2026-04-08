package pages

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gen2brain/malgo"
	"github.com/hraban/opus"
)

const (
	targetSampleRate = 48000
	targetChannels   = 1
	frameSizeMs      = 20
	opusFrameSize    = (targetSampleRate * frameSizeMs) / 1000
)

type VoiceChat struct {
	ctx           context.Context
	mu            sync.Mutex
	running       bool
	stopChan      chan struct{}
	userToken     string
	currentRoomID string
}

func NewVoiceChat() *VoiceChat {
	return &VoiceChat{stopChan: make(chan struct{})}
}

func (s *VoiceChat) SetContext(ctx context.Context) { s.ctx = ctx }
func (s *VoiceChat) SetToken(token string)         { s.mu.Lock(); defer s.mu.Unlock(); s.userToken = token }
func (s *VoiceChat) SetRoomID(id string)          { s.mu.Lock(); defer s.mu.Unlock(); s.currentRoomID = id }

func (s *VoiceChat) Connect() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("уже подключено")
	}
	token := s.userToken
	s.mu.Unlock()

	// Валидация API
	req, _ := http.NewRequest("GET", "http://84.22.132.243:8081/", nil)
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
	bufferMu := sync.Mutex{}
	jitterBuffer := make(map[uint32][]int16)
	var nextSeqToPlay uint32
	prebuffering := true
	firstPacket := true

	// UDP
	serverAddr, _ := net.ResolveUDPAddr("udp", "84.22.132.243:8082")
	conn, err := net.DialUDP("udp", nil, serverAddr)
	if err != nil { return }
	defer conn.Close()

	// Auth
	s.mu.Lock()
	conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
	s.mu.Unlock()

	// Opus
	enc, _ := opus.NewEncoder(targetSampleRate, targetChannels, opus.AppVoIP)
	dec, _ := opus.NewDecoder(targetSampleRate, targetChannels)
	enc.SetBitrate(24000)

	// Вспомогательный буфер для каста байтов в int16
	compBuf := make([]byte, 1500)

	// --- ОБРАБОТКА ВЫВОДА (ДИНАМИКИ) ---
	onPlaybackData := func(pOutput, _ []byte, frameCount uint32) {
		bufferMu.Lock()
		defer bufferMu.Unlock()

		if prebuffering && len(jitterBuffer) < 6 { return }
		prebuffering = false

		// Drift control
		if len(jitterBuffer) > 15 {
			var maxSeq uint32
			for s := range jitterBuffer { if s > maxSeq { maxSeq = s } }
			nextSeqToPlay = maxSeq - 3
		}

		if pcm, ok := jitterBuffer[nextSeqToPlay]; ok {
			// Malgo ожидает байты, но мы работаем с S16. 
			// Просто копируем слайс через приведение типов, это самый быстрый и универсальный способ.
			for i, sample := range pcm {
				binary.LittleEndian.PutUint16(pOutput[i*2:], uint16(sample))
			}
			delete(jitterBuffer, nextSeqToPlay)
			nextSeqToPlay++
		} else if len(jitterBuffer) > 0 {
			nextSeqToPlay++
		}
	}

	// --- ОБРАБОТКА ВВОДА (МИКРОФОН) ---
	var seq uint32
	onAudioData := func(_, pInput []byte, frameCount uint32) {
		samples := make([]int16, frameCount)
		var maxAmp int16

		// Универсальное чтение входных байтов как S16
		for i := 0; i < int(frameCount); i++ {
			val := int16(binary.LittleEndian.Uint16(pInput[i*2 : i*2+2]))
			samples[i] = val
			
			// Считаем амплитуду для VAD (Voice Activity Detection)
			absV := val
			if absV < 0 { absV = -absV }
			if absV > maxAmp { maxAmp = absV }
		}

		// Порог тишины (универсальный для S16)
		if maxAmp < 40 { return }

		n, err := enc.Encode(samples, compBuf[4:])
		if err == nil && n > 0 {
			binary.BigEndian.PutUint32(compBuf[:4], seq)
			conn.Write(compBuf[:n+4])
			seq++
		}
	}

	// Настройка Malgo
	malgoCtx, _ := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	defer malgoCtx.Uninit()

	// Используем одинаковый формат S16 для обеих сторон.
	// Malgo сам выполнит ресемплинг и конвертацию форматов ОС, если они отличаются.
	deviceConfig := malgo.DefaultDeviceConfig(malgo.Duplex) // Дуплекс режим (запись + воспроизведение)
	deviceConfig.SampleRate = targetSampleRate
	deviceConfig.PeriodSizeInFrames = opusFrameSize
	deviceConfig.Playback.Format = malgo.FormatS16
	deviceConfig.Capture.Format = malgo.FormatS16
	deviceConfig.Playback.Channels = targetChannels
	deviceConfig.Capture.Channels = targetChannels

	// Мы разделяем устройства, так как Malgo Duplex на некоторых ОС капризен.
	pDev, _ := malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onPlaybackData})
	cDev, _ := malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onAudioData})
	
	pDev.Start()
	cDev.Start()
	defer pDev.Uninit()
	defer cDev.Uninit()

	// Сетевой поток
	go func() {
		buf := make([]byte, 2048)
		out := make([]int16, opusFrameSize)
		for {
			n, _, err := conn.ReadFromUDP(buf)
			if err != nil { return }
			if n < 4 { continue }

			inSeq := binary.BigEndian.Uint32(buf[:4])
			nDec, err := dec.Decode(buf[4:n], out)
			if err != nil { continue }

			ready := make([]int16, nDec)
			copy(ready, out)

			bufferMu.Lock()
			if firstPacket || inSeq < nextSeqToPlay-100 {
				nextSeqToPlay = inSeq
				firstPacket = false
			}
			if inSeq >= nextSeqToPlay {
				jitterBuffer[inSeq] = ready
			}
			bufferMu.Unlock()
		}
	}()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
			s.mu.Unlock()
		case <-s.stopChan:
			conn.Write([]byte("BYE"))
			return
		}
	}
}