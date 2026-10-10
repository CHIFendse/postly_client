import { Events } from '@wailsio/runtime';
import { Offer, SetMuted, Start, Stop } from '@bindings/client/nativecall/service';
import { LogCall } from '@bindings/client/pages/chatws';

export class NativeCallSession {
  constructor(chatId, handlers) {
    this.chatId = String(chatId);
    this.handlers = handlers;
    this.closed = false;
    this.unsubscribe = null;
    this.queue = Promise.resolve();
  }

  async start() {
    this.unsubscribe = Events.On('native_call', ({ data }) => {
      if (!data || data.chat_id !== this.chatId || this.closed) return;
      if (data.type === 'state' && data.value === 'failed') this.handlers.onFailed?.();
    });
    this.log('native start');
    await Start(this.chatId);
    if (this.closed) Stop().catch(() => {});
  }

  log(line) {
    LogCall(`chat=${this.chatId} ${line}`).catch(() => {});
  }

  handleSignal(msg) {
    this.queue = this.queue
      .then(() => this.#process(msg))
      .catch((e) => this.log(`native signal ${msg.type} error: ${e}`));
  }

  async #process(msg) {
    if (this.closed) return;
    if (msg.type === 'CALL_OFFER') {
      await Offer(this.chatId, msg.sdp);
      return;
    }
    if (msg.type === 'CALL_PEERS') {
      this.handlers.onPeers?.(msg.user_ids ? msg.user_ids.split(',') : []);
    }
  }

  setMuted(muted) {
    SetMuted(muted).catch(() => {});
  }

  retryMic() {}

  close() {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe?.();
    Stop().catch(() => {});
  }
}
