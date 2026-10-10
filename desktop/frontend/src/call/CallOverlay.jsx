import { useEffect, useMemo, useState } from 'react';
import { CanOpenSettings, OpenSettings } from '@bindings/client/media/microphoneservice';
import { useCall } from './CallProvider';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import './CallOverlay.css';

const PHONE_PATH = 'M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z';

function PhoneIcon({ hangup, size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path
        fill="currentColor"
        d={PHONE_PATH}
        style={hangup ? { transform: 'rotate(135deg)', transformOrigin: 'center' } : undefined}
      />
    </svg>
  );
}

function MicIcon({ off, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Avatar({ name, size }) {
  const color = useMemo(() => getAvatarColor(name), [name]);
  const letter = useMemo(() => getFirstLetter(name), [name]);
  return (
    <div className="co-avatar" style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}>
      <span>{letter}</span>
    </div>
  );
}

function useTimer(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return '';
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function MicDialog({ dialog, onConsent, onClose }) {
  const [canOpenSettings, setCanOpenSettings] = useState(false);

  useEffect(() => {
    CanOpenSettings().then(setCanOpenSettings).catch(() => setCanOpenSettings(false));
  }, []);

  const openSettings = () => {
    OpenSettings().catch((e) => console.error('open microphone settings', e));
    onClose();
  };

  if (dialog.kind === 'consent') {
    return (
      <div className="co-backdrop co-backdrop-top">
        <div className="co-dialog" role="dialog" aria-modal="true">
          <div className="co-dialog-icon"><MicIcon size={28} /></div>
          <div className="co-dialog-title">Доступ к микрофону</div>
          <div className="co-dialog-text">
            Postly нужен микрофон, чтобы собеседники вас слышали. Разрешение сохранится, и больше мы спрашивать не будем.
          </div>
          <div className="co-dialog-actions">
            <button type="button" className="co-dialog-btn" onClick={() => onConsent(false)}>
              Не сейчас
            </button>
            <button type="button" className="co-dialog-btn co-dialog-btn-primary" onClick={() => onConsent(true)} autoFocus>
              Разрешить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="co-backdrop co-backdrop-top">
      <div className="co-dialog" role="alertdialog" aria-modal="true">
        <div className="co-dialog-icon co-dialog-icon-error"><MicIcon off size={28} /></div>
        <div className="co-dialog-title">Микрофон недоступен</div>
        <div className="co-dialog-text">{dialog.text}</div>
        <div className="co-dialog-actions">
          {dialog.settings && canOpenSettings && (
            <button type="button" className="co-dialog-btn" onClick={openSettings}>
              Открыть настройки
            </button>
          )}
          <button type="button" className="co-dialog-btn co-dialog-btn-primary" onClick={onClose} autoFocus>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS = {
  outgoing: 'Вызов…',
  connecting: 'Соединение…',
  ended: 'Звонок завершён',
};

function CallView() {
  const { call, peers, muted, micIssue, accept, hangup, toggleMute } = useCall();
  const timer = useTimer(call?.state === 'active' ? call.startedAt : 0);

  if (!call) return null;

  if (call.state === 'incoming') {
    return (
      <div className="co-backdrop">
        <div className="co-incoming">
          <div className="co-pulse">
            <Avatar name={call.name} size={96} />
          </div>
          <div className="co-name">{call.name}</div>
          <div className="co-status">
            {call.kind === 'group' ? 'Групповой звонок' : 'Входящий звонок'}
          </div>
          <div className="co-actions">
            <button type="button" className="co-btn co-btn-decline" onClick={hangup} title="Отклонить">
              <PhoneIcon hangup size={28} />
            </button>
            <button type="button" className="co-btn co-btn-accept" onClick={accept} title="Принять">
              <PhoneIcon size={28} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = call.state === 'active'
    ? (call.kind === 'group' ? `${timer} · ${peers.length + 1} участн.` : timer)
    : (call.error || STATUS[call.state] || '');

  return (
    <div className={`co-panel ${call.state === 'ended' ? 'co-panel-ended' : ''}`}>
      <Avatar name={call.name} size={40} />
      <div className="co-panel-info">
        <div className="co-panel-name">{call.name}</div>
        <div className={`co-panel-status ${micIssue ? 'co-panel-status-warn' : ''}`}>
          {micIssue && call.state !== 'ended' ? micIssue : status}
        </div>
      </div>
      {call.state !== 'ended' && (
        <div className="co-panel-actions">
          {call.state === 'active' && (
            <button
              type="button"
              className={`co-btn co-btn-small ${muted ? 'co-btn-muted' : 'co-btn-neutral'}`}
              onClick={toggleMute}
              title={muted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              <MicIcon off={muted} />
            </button>
          )}
          <button type="button" className="co-btn co-btn-small co-btn-decline" onClick={hangup} title="Завершить">
            <PhoneIcon hangup size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CallOverlay() {
  const { dialog, answerConsent, closeDialog } = useCall();
  return (
    <>
      <CallView />
      {dialog && <MicDialog dialog={dialog} onConsent={answerConsent} onClose={closeDialog} />}
    </>
  );
}
