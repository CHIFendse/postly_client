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
	var (
		bufferMu      sync.Mutex
		jitterBuffer  = make(map[uint32][]int16)
		nextSeqToPlay uint32
		firstPacket   = true
		seq           uint32
	)

	// 1. Сетевое подключение
	serverAddr, _ := net.ResolveUDPAddr("udp", "84.22.132.243:8082")
	conn, err := net.DialUDP("udp", nil, serverAddr)
	if err != nil {
		return
	}
	defer conn.Close()

	// Регистрация на сервере
	s.mu.Lock()
	conn.Write([]byte(fmt.Sprintf("HELLO %s %s", s.userToken, s.currentRoomID)))
	s.mu.Unlock()

	// 2. Инициализация Opus
	enc, _ := opus.NewEncoder(targetSampleRate, targetChannels, opus.AppVoIP)
	dec, _ := opus.NewDecoder(targetSampleRate, targetChannels)
	enc.SetBitrate(24000)
	compBuf := make([]byte, 1500)

	// --- ЕДИНЫЙ ОБРАБОТЧИК ЗВУКА ---
	onData := func(pOutput, pInput []byte, frameCount uint32) {
        bufferMu.Lock()
        defer bufferMu.Unlock()

        // 1. Очищаем выход (важно, чтобы не было эха/шума)
        for i := range pOutput { pOutput[i] = 0 }

        // 2. Логика воспроизведения
        if !firstPacket {
            // Если пакета нет, не прыгаем сразу, а ждем (даем шансы сети)
            if _, ok := jitterBuffer[nextSeqToPlay]; !ok {
                // Если в буфере скопилось слишком много (например > 10), 
                // значит мы реально отстали — тогда прыгаем вперед
                if len(jitterBuffer) > 10 {
                    var closest uint32 = 0xFFFFFFFF
                    for k := range jitterBuffer {
                        if k > nextSeqToPlay && k < closest { closest = k }
                    }
                    nextSeqToPlay = closest
                }
            }

            if pcm, ok := jitterBuffer[nextSeqToPlay]; ok {
                // Копируем напрямую, проверяя границы
                for i := 0; i < int(frameCount) && i < len(pcm); i++ {
                    if i*2+1 < len(pOutput) {
                        binary.LittleEndian.PutUint16(pOutput[i*2:], uint16(pcm[i]))
                    }
                }
                delete(jitterBuffer, nextSeqToPlay)
                nextSeqToPlay++
            }
        }

        // 3. Логика микрофона (оптимизированная)
        if pInput != nil && len(pInput) >= int(frameCount)*2 {
            var maxAmp int16
            // Используем заранее созданный буфер samples, чтобы не аллоцировать память
            samples := make([]int16, frameCount) // В идеале вынеси это за пределы onData
            
            for i := 0; i < int(frameCount); i++ {
                val := int16(binary.LittleEndian.Uint16(pInput[i*2 : i*2+2]))
                boosted := int32(val) * 3
                if boosted > 32767 { boosted = 32767 } else if boosted < -32768 { boosted = -32768 }
                samples[i] = int16(boosted)
                
                absV := samples[i]; if absV < 0 { absV = -absV }
                if absV > maxAmp { maxAmp = absV }
            }

            if maxAmp > 100 {
                n, err := enc.Encode(samples, compBuf[4:])
                if err == nil && n > 0 {
                    binary.BigEndian.PutUint32(compBuf[:4], seq)
                    conn.Write(compBuf[:n+4])
                    seq++
                }
            }
        }
    }

	// 3. Настройка Malgo (Duplex с откатом)
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
		fmt.Println("Микрофон не найден, переключаемся в режим только прослушивания...")
		deviceConfig.DeviceType = malgo.Playback
		pDev, err = malgo.InitDevice(malgoCtx.Context, deviceConfig, malgo.DeviceCallbacks{Data: onData})
		if err != nil {
			fmt.Printf("Ошибка аудио: %v\n", err)
			return
		}
	}
	
	pDev.Start()
	defer pDev.Uninit()

	// 4. Поток приема UDP
	go func() {
		buf := make([]byte, 2048)
		out := make([]int16, opusFrameSize)
		for {
			n, _, err := conn.ReadFromUDP(buf)
			if err != nil { return }
			if n < 20 { continue }

			inSeq := binary.BigEndian.Uint32(buf[:4])
			nDec, err := dec.Decode(buf[4:n], out)
			if err != nil { continue }

			ready := make([]int16, nDec)
			copy(ready, out)

			bufferMu.Lock()
			if firstPacket {
				nextSeqToPlay = inSeq
				firstPacket = false
				fmt.Printf(">>> Звук пошел! Seq: %d\n", inSeq)
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
}