package pages

import (
	"encoding/json"
	"log"
	"strings"
)

func logCallSignal(msg MessageDTO) {
	if !strings.HasPrefix(msg.Type, "CALL_") {
		return
	}
	switch msg.Type {
	case "CALL_OFFER":
		log.Printf("call recv CALL_OFFER chat=%s server candidates=%v", msg.ChatID, offerCandidates(msg.SDP))
	case "CALL_PEERS":
		log.Printf("call recv CALL_PEERS chat=%s users=%s", msg.ChatID, msg.UserIDs)
	case "CALL_ERROR":
		log.Printf("call recv CALL_ERROR chat=%s error=%s", msg.ChatID, msg.Error)
	default:
		log.Printf("call recv %s chat=%s from=%s", msg.Type, msg.ChatID, msg.SenderID)
	}
}

func offerCandidates(sdpJSON string) []string {
	var desc struct {
		SDP string `json:"sdp"`
	}
	if err := json.Unmarshal([]byte(sdpJSON), &desc); err != nil {
		return []string{"bad sdp: " + err.Error()}
	}
	var out []string
	for _, line := range strings.Split(desc.SDP, "\r\n") {
		if !strings.HasPrefix(line, "a=candidate:") {
			continue
		}
		f := strings.Fields(line)
		if len(f) >= 8 && f[1] == "1" {
			out = append(out, f[2]+" "+f[4]+":"+f[5]+" "+f[7])
		}
	}
	return out
}

func (a *ChatWS) LogCall(line string) {
	log.Printf("call client %s", line)
}
