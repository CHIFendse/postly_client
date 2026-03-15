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
func (s *VoiceChat) SetToken(token string) { s.mu.Lock(); defer s.mu.Unlock(); s.userToken = token }
func (s *VoiceChat) SetRoomID(id string) { s.mu.Lock(); defer s.mu.Unlock(); s.currentRoomID = id }

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
    firstPacket := true
    var seq uint32

    serverAddr, _ := net.ResolveUDPAddr("udp", "84.22.132.243:8082")
    conn, err := net.DialUDP("udp", nil, serverAddr)
    if err != nil { return }
    defer conn.Close()

    // Регистрация
    s.mu.Lock()
    conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
    s.mu.Unlock()

    enc, _ := opus.NewEncoder(targetSampleRate, targetChannels, opus.AppVoIP)
    dec, _ := opus.NewDecoder(targetSampleRate, targetChannels)
    enc.SetBitrate(24000)
    compBuf := make([]byte, 1500)

    // --- ВЫВОД (ДИНАМИКИ) ---
    onPlaybackData := func(pOutput, _ []byte, frameCount uint32) {
        bufferMu.Lock()
        defer bufferMu.Unlock()

        if len(jitterBuffer) == 0 {
            for i := range pOutput { pOutput[i] = 0 }
            return
        }

        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: если мы сильно отстали или пакет пропал, 
        // ищем ближайший существующий пакет в буфере
        if _, ok := jitterBuffer[nextSeqToPlay]; !ok {
            var closest uint32 = 0xFFFFFFFF
            found := false
            for k := range jitterBuffer {
                if k > nextSeqToPlay && k < closest {
                    closest = k
                    found = true
                }
            }
            if found {
                nextSeqToPlay = closest // Перепрыгиваем "дырку" в последовательности
            } else {
                for i := range pOutput { pOutput[i] = 0 }
                return
            }
        }

        if pcm, ok := jitterBuffer[nextSeqToPlay]; ok {
            for i, sample := range pcm {
                if i*2+1 < len(pOutput) {
                    binary.LittleEndian.PutUint16(pOutput[i*2:], uint16(sample))
                }
            }
            delete(jitterBuffer, nextSeqToPlay)
            nextSeqToPlay++
        }
    }

    // --- ВВОД (МИКРОФОН) ---
    onAudioData := func(_, pInput []byte, frameCount uint32) {
        samples := make([]int16, frameCount)
        var maxAmp int16

        for i := 0; i < int(frameCount); i++ {
            val := int16(binary.LittleEndian.Uint16(pInput[i*2 : i*2+2]))
            
            // Усиление x3.0 для ПК
            boosted := int32(val) * 3
            if boosted > 32767 { boosted = 32767 }
            if boosted < -32768 { boosted = -32768 }
            val = int16(boosted)

            samples[i] = val
            absV := val
            if absV < 0 { absV = -absV }
            if absV > maxAmp { maxAmp = absV }
        }

        // ВРЕМЕННО: снижаем порог до минимума, чтобы проверить, пойдет ли звук
        if maxAmp < 100 { return } 

        n, err := enc.Encode(samples, compBuf[4:])
        if err == nil && n > 0 {
            binary.BigEndian.PutUint32(compBuf[:4], seq)
            conn.Write(compBuf[:n+4])
            seq++
        }
    }

    // Malgo setup
    malgoCtx, _ := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
    deviceConfig := malgo.DefaultDeviceConfig(malgo.Duplex)
    deviceConfig.SampleRate, deviceConfig.PeriodSizeInFrames = targetSampleRate, opusFrameSize
    deviceConfig.Playback.Format, deviceConfig.Capture.Format = malgo.FormatS16, malgo.FormatS16
    deviceConfig.Playback.Channels, deviceConfig.Capture.Channels = targetChannels, targetChannels

    pDev, _ := malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onPlaybackData})
    cDev, _ := malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onAudioData})
    pDev.Start(); cDev.Start()

    // ПРИЕМ
    go func() {
        buf := make([]byte, 2048)
        out := make([]int16, opusFrameSize)
        for {
            n, _, err := conn.ReadFromUDP(buf)
            if err != nil { return }
            if n < 20 { continue } // Игнорим мелкие пакеты/команды пока что

            inSeq := binary.BigEndian.Uint32(buf[:4])
            nDec, err := dec.Decode(buf[4:n], out)
            if err != nil { continue }

            ready := make([]int16, nDec)
            copy(ready, out)

            bufferMu.Lock()
            if firstPacket {
                nextSeqToPlay = inSeq
                firstPacket = false
                fmt.Printf(">>> ЗВУК ПОШЕЛ! Первый seq: %d\n", inSeq)
            }
            jitterBuffer[inSeq] = ready
            bufferMu.Unlock()
        }
    }()

    // Keep-alive
    go func() {
        for {
            time.Sleep(5 * time.Second)
            s.mu.Lock()
            if !s.running { s.mu.Unlock(); return }
            conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
            s.mu.Unlock()
        }
    }()

    <-s.stopChan
    conn.Write([]byte("BYE"))
    pDev.Uninit(); cDev.Uninit(); malgoCtx.Uninit()
}