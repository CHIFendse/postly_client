import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Events, Window } from '@wailsio/runtime';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import { Supported as NativeSupported } from '@bindings/client/nativecall/service';
import { CallSession } from './CallSession';
import { NativeCallSession } from './NativeCallSession';
import CallOverlay from './CallOverlay';
import {
  describeMicError,
  hasMicConsent,
  isCallingSupported,
  openMicrophone,
  saveMicConsent,
  stopStream,
} from './microphone';

const RING_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 20_000;

const NATIVE_AUDIO = { native: true, getTracks: () => [] };

const nativeSupported = NativeSupported().catch(() => false);

const CallContext = createContext(null);

export const useCall = () => useContext(CallContext);

const sendSignal = (type, chatId) =>
  SendWSMessage(JSON.stringify({ type, chat_id: String(chatId) })).catch(() => {});

const bringToFront = () => {
  try {
    Window.UnMinimise();
    Window.Show();
    Window.Focus();
  } catch (_) {}
};

function RemoteAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

export function CallProvider({ myId, children }) {
  const [call, setCall] = useState(null);
  const [peers, setPeers] = useState([]);
  const [streams, setStreams] = useState({});
  const [muted, setMuted] = useState(false);
  const [micIssue, setMicIssue] = useState('');
  const [dialog, setDialog] = useState(null);

  const callRef = useRef(null);
  const sessionRef = useRef(null);
  const consentRef = useRef(null);
  const preparingRef = useRef(false);

  const update = useCallback((next) => {
    callRef.current = next;
    setCall(next);
  }, []);

  const askConsent = useCallback(() => new Promise((resolve) => {
    consentRef.current = resolve;
    setDialog({ kind: 'consent' });
  }), []);

  const answerConsent = useCallback((granted) => {
    const resolve = consentRef.current;
    consentRef.current = null;
    setDialog(null);
    if (granted) saveMicConsent();
    resolve?.(granted);
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const acquireMic = useCallback(async () => {
    const native = await nativeSupported;
    if (!native && !isCallingSupported()) {
      setDialog({
        kind: 'error',
        text: 'Звонки недоступны: системный WebView не поддерживает микрофон или WebRTC.',
        settings: false,
      });
      return null;
    }
    if (!hasMicConsent() && !(await askConsent())) return null;
    if (native) return NATIVE_AUDIO;
    try {
      return await openMicrophone();
    } catch (e) {
      console.error('microphone', e);
      setDialog({ kind: 'error', ...describeMicError(e) });
      return null;
    }
  }, [askConsent]);

  const finish = useCallback((reason = '') => {
    const cur = callRef.current;
    if (!cur || cur.state === 'ended') return;

    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      session.close();
      sendSignal('CALL_HANGUP', cur.chatId);
    }

    setPeers([]);
    setStreams({});
    setMuted(false);
    setMicIssue('');

    const ended = { ...cur, state: 'ended', error: reason };
    update(ended);
    setTimeout(() => {
      if (callRef.current === ended) update(null);
    }, reason ? 2500 : 600);
  }, [update]);

  const startSession = useCallback(async (chatId, mic) => {
    const Session = mic === NATIVE_AUDIO ? NativeCallSession : CallSession;
    const session = new Session(chatId, {
      onStream: (uid, stream) => setStreams((m) => ({ ...m, [uid]: stream })),
      onStreamEnded: (uid) => setStreams(({ [uid]: _, ...rest }) => rest),
      onPeers: (ids) => {
        const others = ids.filter((id) => id !== String(myId));
        setPeers(others);
        const cur = callRef.current;
        if (!cur || cur.state === 'ended') return;
        if (others.length > 0 && cur.state !== 'active') {
          update({ ...cur, state: 'active', startedAt: Date.now() });
        } else if (others.length === 0 && cur.state === 'active') {
          finish(cur.kind === 'direct' ? 'Собеседник завершил звонок' : 'Все участники вышли');
        }
      },
      onFailed: () => finish('Соединение потеряно'),
      onMicLost: (e) => setMicIssue(describeMicError(e).text),
      onMicRecovered: () => setMicIssue(''),
    });
    sessionRef.current = session;

    try {
      await session.start(mic);
    } catch (e) {
      console.error('call start', e);
      if (sessionRef.current !== session) return;
      if (mic === NATIVE_AUDIO && e?.message) {
        setDialog({ kind: 'error', text: e.message, settings: true });
      }
      finish('Не удалось начать звонок');
    }
  }, [myId, update, finish]);

  const startCall = useCallback(async (chatId, name, kind) => {
    const cur = callRef.current;
    if (preparingRef.current || (cur && cur.state !== 'ended')) return;

    preparingRef.current = true;
    const mic = await acquireMic();
    preparingRef.current = false;
    if (!mic) return;

    const latest = callRef.current;
    if (latest && latest.state !== 'ended') {
      stopStream(mic);
      return;
    }

    update({
      id: Date.now(),
      chatId: String(chatId),
      name,
      kind,
      callerId: String(myId),
      state: 'outgoing',
      startedAt: 0,
      error: '',
    });
    sendSignal('CALL_INVITE', chatId);
    startSession(String(chatId), mic);
  }, [myId, acquireMic, update, startSession]);

  const accept = useCallback(async () => {
    const cur = callRef.current;
    if (preparingRef.current || !cur || cur.state !== 'incoming') return;

    preparingRef.current = true;
    const mic = await acquireMic();
    preparingRef.current = false;
    if (!mic) return;

    if (callRef.current !== cur) {
      stopStream(mic);
      return;
    }

    update({ ...cur, state: 'connecting' });
    sendSignal('CALL_ACCEPT', cur.chatId);
    startSession(cur.chatId, mic);
  }, [acquireMic, update, startSession]);

  const hangup = useCallback(() => {
    const cur = callRef.current;
    if (!cur || cur.state === 'ended') return;
    if (cur.state === 'incoming') sendSignal('CALL_REJECT', cur.chatId);
    finish('');
  }, [finish]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    sessionRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  useEffect(() => Events.On('server_message', ({ data: msg }) => {
    if (!msg?.type?.startsWith('CALL_')) return;
    const cur = callRef.current;
    const active = cur && cur.state !== 'ended';
    const sameChat = active && String(msg.chat_id) === cur.chatId;

    switch (msg.type) {
      case 'CALL_INVITE':
        if (active) {
          if (!sameChat) sendSignal('CALL_REJECT', msg.chat_id);
          return;
        }
        update({
          id: Date.now(),
          chatId: String(msg.chat_id),
          name: msg.name || 'Звонок',
          kind: msg.kind || 'direct',
          callerId: String(msg.sender_id),
          state: 'incoming',
          startedAt: 0,
          error: '',
        });
        bringToFront();
        return;

      case 'CALL_OFFER':
      case 'CALL_PEERS':
        if (sameChat) sessionRef.current?.handleSignal(msg);
        return;

      case 'CALL_REJECT':
        if (sameChat && cur.state === 'outgoing' && cur.kind === 'direct') finish('Звонок отклонён');
        return;

      case 'CALL_HANGUP':
        if (sameChat && cur.state === 'incoming' && String(msg.sender_id) === cur.callerId) finish('Звонок отменён');
        return;

      case 'CALL_ERROR':
        if (sameChat) finish(msg.error || 'Ошибка звонка');
        return;

      default:
    }
  }), [update, finish]);

  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.addEventListener || !micIssue) return;
    const retry = () => sessionRef.current?.retryMic();
    devices.addEventListener('devicechange', retry);
    return () => devices.removeEventListener('devicechange', retry);
  }, [micIssue]);

  useEffect(() => {
    if (!call) return;
    const timeouts = { outgoing: RING_TIMEOUT_MS, incoming: RING_TIMEOUT_MS, connecting: CONNECT_TIMEOUT_MS };
    const ms = timeouts[call.state];
    if (!ms) return;
    const reasons = { outgoing: 'Нет ответа', incoming: '', connecting: 'Не удалось подключиться' };
    const t = setTimeout(() => {
      if (callRef.current === call) finish(reasons[call.state]);
    }, ms);
    return () => clearTimeout(t);
  }, [call, finish]);

  useEffect(() => () => {
    const cur = callRef.current;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      session.close();
      if (cur) sendSignal('CALL_HANGUP', cur.chatId);
    }
    consentRef.current?.(false);
  }, []);

  const value = useMemo(
    () => ({
      call,
      peers,
      muted,
      micIssue,
      dialog,
      startCall,
      accept,
      hangup,
      toggleMute,
      answerConsent,
      closeDialog,
    }),
    [call, peers, muted, micIssue, dialog, startCall, accept, hangup, toggleMute, answerConsent, closeDialog],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
      {Object.entries(streams).map(([uid, stream]) => (
        <RemoteAudio key={uid} stream={stream} />
      ))}
    </CallContext.Provider>
  );
}
