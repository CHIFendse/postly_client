//go:build linux && cgo

package nativecall

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gen2brain/malgo"
	"github.com/hraban/opus"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	sampleRate    = 48000
	frameSize     = sampleRate / 50
	startBuffered = frameSize * 3
	maxBuffered   = sampleRate / 4
)

type Sender interface {
	SendWSMessage(payload string) error
}

type Service struct {
	ws   Sender
	mu   sync.Mutex
	sess *session
}

func New(ws Sender) *Service {
	return &Service{ws: ws}
}

func (s *Service) ServiceName() string {
	return "NativeCall"
}

func (s *Service) Supported() bool {
	return true
}

func (s *Service) Start(chatID string) error {
	s.mu.Lock()
	old := s.sess
	s.sess = nil
	s.mu.Unlock()
	if old != nil {
		old.close()
	}

	sess, err := newSession(chatID, s.ws)
	if err != nil {
		log.Printf("call native start: %v", err)
		return err
	}
	s.mu.Lock()
	s.sess = sess
	s.mu.Unlock()
	return nil
}

func (s *Service) Offer(chatID, sdp string) error {
	sess := s.current(chatID)
	if sess == nil {
		return errors.New("нет активного звонка")
	}
	return sess.offer(sdp)
}

func (s *Service) SetMuted(muted bool) {
	if sess := s.current(""); sess != nil {
		sess.muted.Store(muted)
	}
}

func (s *Service) Stop() {
	s.mu.Lock()
	sess := s.sess
	s.sess = nil
	s.mu.Unlock()
	if sess != nil {
		sess.close()
	}
}

func (s *Service) current(chatID string) *session {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.sess == nil || (chatID != "" && s.sess.chatID != chatID) {
		return nil
	}
	return s.sess
}

type stream struct {
	pcm     []int16
	playing bool
}

type session struct {
	chatID string
	ws     Sender

	pc    *webrtc.PeerConnection
	track *webrtc.TrackLocalStaticSample
	enc   *opus.Encoder
	muted atomic.Bool

	audioCtx *malgo.AllocatedContext
	device   *malgo.Device
	capBuf   []int16
	frames   chan []int16

	mixMu   sync.Mutex
	streams map[string]*stream
	mixAcc  []int32

	sigMu     sync.Mutex
	stop      chan struct{}
	closeOnce sync.Once
}

func newSession(chatID string, ws Sender) (*session, error) {
	enc, err := opus.NewEncoder(sampleRate, 1, opus.AppVoIP)
	if err != nil {
		return nil, fmt.Errorf("opus encoder: %w", err)
	}
	enc.SetBitrate(32000)
	enc.SetInBandFEC(true)
	enc.SetPacketLossPerc(10)

	s := &session{
		chatID:  chatID,
		ws:      ws,
		enc:     enc,
		frames:  make(chan []int16, 16),
		streams: map[string]*stream{},
		stop:    make(chan struct{}),
	}
	if err := s.openAudio(); err != nil {
		return nil, err
	}
	if err := s.openPeer(); err != nil {
		s.closeAudio()
		return nil, err
	}
	go s.encodeLoop()

	log.Printf("call native chat=%s join", chatID)
	s.send(map[string]string{"type": "CALL_JOIN"})
	return s, nil
}

func (s *session) openAudio() error {
	ctx, err := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	if err != nil {
		return fmt.Errorf("не удалось открыть звуковую систему: %w", err)
	}
	cfg := malgo.DefaultDeviceConfig(malgo.Duplex)
	cfg.SampleRate = sampleRate
	cfg.PeriodSizeInFrames = frameSize / 2
	cfg.Capture.Format = malgo.FormatS16
	cfg.Capture.Channels = 1
	cfg.Playback.Format = malgo.FormatS16
	cfg.Playback.Channels = 1

	dev, err := malgo.InitDevice(ctx.Context, cfg, malgo.DeviceCallbacks{Data: s.onAudio})
	if err != nil {
		ctx.Uninit()
		ctx.Free()
		return errors.New("Микрофон или динамики не найдены. Подключите устройство и попробуйте снова.")
	}
	if err := dev.Start(); err != nil {
		dev.Uninit()
		ctx.Uninit()
		ctx.Free()
		return errors.New("Микрофон занят другим приложением или недоступен.")
	}
	s.audioCtx = ctx
	s.device = dev
	return nil
}

func (s *session) closeAudio() {
	if s.device != nil {
		s.device.Uninit()
		s.device = nil
	}
	if s.audioCtx != nil {
		s.audioCtx.Uninit()
		s.audioCtx.Free()
		s.audioCtx = nil
	}
}

func (s *session) openPeer() error {
	me := &webrtc.MediaEngine{}
	if err := me.RegisterDefaultCodecs(); err != nil {
		return err
	}
	se := webrtc.SettingEngine{}
	se.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4, webrtc.NetworkTypeTCP4})
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me), webrtc.WithSettingEngine(se))

	pc, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return err
	}
	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: sampleRate, Channels: 2},
		"mic", "native-mic",
	)
	if err != nil {
		pc.Close()
		return err
	}
	sender, err := pc.AddTrack(track)
	if err != nil {
		pc.Close()
		return err
	}
	go func() {
		buf := make([]byte, 1500)
		for {
			if _, _, err := sender.Read(buf); err != nil {
				return
			}
		}
	}()

	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		j, _ := json.Marshal(c.ToJSON())
		s.send(map[string]string{"type": "CALL_ICE", "candidate": string(j)})
	})
	pc.OnTrack(func(remote *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		s.receive(remote)
	})
	pc.OnConnectionStateChange(func(st webrtc.PeerConnectionState) {
		log.Printf("call native chat=%s connection=%s", s.chatID, st)
		s.emit("state", st.String())
	})

	s.pc = pc
	s.track = track
	return nil
}

func (s *session) offer(sdp string) error {
	s.sigMu.Lock()
	defer s.sigMu.Unlock()
	select {
	case <-s.stop:
		return errors.New("звонок завершён")
	default:
	}

	var desc webrtc.SessionDescription
	if err := json.Unmarshal([]byte(sdp), &desc); err != nil {
		return err
	}
	if err := s.pc.SetRemoteDescription(desc); err != nil {
		return err
	}
	answer, err := s.pc.CreateAnswer(nil)
	if err != nil {
		return err
	}
	if err := s.pc.SetLocalDescription(answer); err != nil {
		return err
	}
	j, _ := json.Marshal(s.pc.LocalDescription())
	s.send(map[string]string{"type": "CALL_ANSWER", "sdp": string(j)})
	return nil
}

func (s *session) onAudio(out, in []byte, frameCount uint32) {
	for i := 0; i+1 < len(in); i += 2 {
		s.capBuf = append(s.capBuf, int16(binary.LittleEndian.Uint16(in[i:])))
	}
	for len(s.capBuf) >= frameSize {
		frame := make([]int16, frameSize)
		copy(frame, s.capBuf)
		s.capBuf = append(s.capBuf[:0], s.capBuf[frameSize:]...)
		select {
		case s.frames <- frame:
		default:
		}
	}
	s.mix(out, int(frameCount))
}

func (s *session) mix(out []byte, n int) {
	if cap(s.mixAcc) < n {
		s.mixAcc = make([]int32, n)
	}
	acc := s.mixAcc[:n]
	clear(acc)

	s.mixMu.Lock()
	for _, st := range s.streams {
		if !st.playing {
			if len(st.pcm) < startBuffered {
				continue
			}
			st.playing = true
		}
		k := min(n, len(st.pcm))
		for i := 0; i < k; i++ {
			acc[i] += int32(st.pcm[i])
		}
		st.pcm = st.pcm[k:]
		if k < n {
			st.playing = false
		}
	}
	s.mixMu.Unlock()

	for i := 0; i < n && 2*i+1 < len(out); i++ {
		v := max(-32768, min(32767, acc[i]))
		binary.LittleEndian.PutUint16(out[2*i:], uint16(int16(v)))
	}
}

func (s *session) push(id string, pcm []int16) {
	s.mixMu.Lock()
	defer s.mixMu.Unlock()
	st := s.streams[id]
	if st == nil {
		st = &stream{}
		s.streams[id] = st
	}
	st.pcm = append(st.pcm, pcm...)
	if len(st.pcm) > maxBuffered {
		st.pcm = append(st.pcm[:0], st.pcm[len(st.pcm)-startBuffered:]...)
	}
}

func (s *session) dropStream(id string) {
	s.mixMu.Lock()
	delete(s.streams, id)
	s.mixMu.Unlock()
}

func (s *session) receive(remote *webrtc.TrackRemote) {
	if remote.Kind() != webrtc.RTPCodecTypeAudio {
		return
	}
	id := strings.TrimPrefix(remote.StreamID(), "user-")
	log.Printf("call native chat=%s track from %s", s.chatID, id)
	defer s.dropStream(id)

	dec, err := opus.NewDecoder(sampleRate, 1)
	if err != nil {
		log.Printf("call native opus decoder: %v", err)
		return
	}
	pcm := make([]int16, frameSize*6)
	var last uint16
	first := true
	for {
		pkt, _, err := remote.ReadRTP()
		if err != nil {
			return
		}
		if !first {
			diff := pkt.SequenceNumber - last
			if diff == 0 || diff > 0x8000 {
				continue
			}
			for lost := int(diff) - 1; lost > 0 && lost < 5; lost-- {
				if dec.DecodePLC(pcm[:frameSize]) == nil {
					s.push(id, pcm[:frameSize])
				}
			}
		}
		first = false
		last = pkt.SequenceNumber

		n, err := dec.Decode(pkt.Payload, pcm)
		if err != nil {
			continue
		}
		s.push(id, pcm[:n])
	}
}

func (s *session) encodeLoop() {
	buf := make([]byte, 1500)
	silence := make([]int16, frameSize)
	for {
		select {
		case <-s.stop:
			return
		case frame := <-s.frames:
			if s.muted.Load() {
				frame = silence
			}
			n, err := s.enc.Encode(frame, buf)
			if err != nil {
				continue
			}
			data := make([]byte, n)
			copy(data, buf[:n])
			if err := s.track.WriteSample(media.Sample{Data: data, Duration: 20 * time.Millisecond}); err != nil {
				log.Printf("call native write: %v", err)
			}
		}
	}
}

func (s *session) send(msg map[string]string) {
	msg["chat_id"] = s.chatID
	b, _ := json.Marshal(msg)
	if err := s.ws.SendWSMessage(string(b)); err != nil {
		log.Printf("call native send %s: %v", msg["type"], err)
	}
}

func (s *session) emit(kind, value string) {
	if app := application.Get(); app != nil {
		app.Event.Emit("native_call", map[string]string{"chat_id": s.chatID, "type": kind, "value": value})
	}
}

func (s *session) close() {
	s.closeOnce.Do(func() {
		close(s.stop)
		s.sigMu.Lock()
		s.pc.Close()
		s.sigMu.Unlock()
		s.closeAudio()
		log.Printf("call native chat=%s closed", s.chatID)
	})
}
