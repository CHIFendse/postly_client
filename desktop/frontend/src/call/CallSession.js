import { LogCall, SendWSMessage } from '@bindings/client/pages/chatws';
import { openMicrophone, stopStream } from './microphone';

const send = (msg) => SendWSMessage(JSON.stringify(msg));

const describeCandidate = (c) =>
  c ? `${c.protocol} ${c.candidateType} ${c.address ?? c.ip}:${c.port}` : '?';

export class CallSession {
  constructor(chatId, handlers) {
    this.chatId = String(chatId);
    this.handlers = handlers;
    this.pc = null;
    this.mic = null;
    this.micSender = null;
    this.muted = false;
    this.closed = false;
    this.recovering = false;
    this.queue = Promise.resolve();
  }

  async start(mic) {
    if (this.closed) {
      stopStream(mic);
      return;
    }
    this.mic = mic;

    const pc = new RTCPeerConnection();
    this.pc = pc;
    const [track] = mic.getAudioTracks();
    this.micSender = pc.addTrack(track, mic);
    this.#watchTrack(track);

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate || this.closed) return;
      send({ type: 'CALL_ICE', chat_id: this.chatId, candidate: JSON.stringify(candidate) }).catch(() => {});
    };

    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;
      const userId = stream.id.replace(/^user-/, '');
      this.log(`track from ${userId}`);
      this.handlers.onStream?.(userId, stream);
      stream.onremovetrack = () => {
        if (stream.getTracks().length === 0) this.handlers.onStreamEnded?.(userId);
      };
    };

    pc.oniceconnectionstatechange = () => this.log(`ice=${pc.iceConnectionState}`);

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.log(`connection=${state}`);
      if (state === 'connected' || state === 'failed') this.#logPath(pc);
      if (state === 'failed' && !this.closed) this.handlers.onFailed?.();
    };

    this.log('join');
    await send({ type: 'CALL_JOIN', chat_id: this.chatId });
  }

  log(line) {
    LogCall(`chat=${this.chatId} ${line}`).catch(() => {});
  }

  async #logPath(pc) {
    try {
      const stats = await pc.getStats();
      const byId = new Map();
      const pairs = [];
      stats.forEach((s) => {
        byId.set(s.id, s);
        if (s.type === 'candidate-pair') pairs.push(s);
      });
      const selected = pairs.find((p) => p.nominated && p.state === 'succeeded');
      if (selected) {
        this.log(`path local=${describeCandidate(byId.get(selected.localCandidateId))} remote=${describeCandidate(byId.get(selected.remoteCandidateId))}`);
        return;
      }
      const summary = pairs
        .map((p) => `${describeCandidate(byId.get(p.localCandidateId))} -> ${describeCandidate(byId.get(p.remoteCandidateId))} ${p.state}`)
        .join(' | ');
      this.log(`no working path; pairs: ${summary || 'none'}`);
    } catch (e) {
      this.log(`stats error ${e}`);
    }
  }

  #watchTrack(track) {
    track.onended = () => this.retryMic();
  }

  async retryMic() {
    if (this.closed || this.recovering || !this.micSender) return;
    this.recovering = true;
    try {
      const next = await openMicrophone();
      if (this.closed) {
        stopStream(next);
        return;
      }
      const [track] = next.getAudioTracks();
      track.enabled = !this.muted;
      await this.micSender.replaceTrack(track);
      stopStream(this.mic);
      this.mic = next;
      this.#watchTrack(track);
      this.handlers.onMicRecovered?.();
    } catch (e) {
      this.handlers.onMicLost?.(e);
    } finally {
      this.recovering = false;
    }
  }

  handleSignal(msg) {
    this.queue = this.queue
      .then(() => this.#process(msg))
      .catch((e) => console.error('call signal', msg.type, e));
  }

  async #process(msg) {
    if (this.closed || !this.pc) return;

    if (msg.type === 'CALL_OFFER') {
      await this.pc.setRemoteDescription(JSON.parse(msg.sdp));
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      await send({
        type: 'CALL_ANSWER',
        chat_id: this.chatId,
        sdp: JSON.stringify(this.pc.localDescription),
      });
      return;
    }

    if (msg.type === 'CALL_PEERS') {
      this.handlers.onPeers?.(msg.user_ids ? msg.user_ids.split(',') : []);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.mic?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pc?.close();
    stopStream(this.mic);
    this.pc = null;
    this.mic = null;
    this.micSender = null;
  }
}
