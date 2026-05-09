import { useParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import './CallWindow.css'; 
import { Window, Events } from '@wailsio/runtime';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import { Disconnect, StartVoice } from '@bindings/client/pages/voicechat';

function CallWindow() {
    const { userName, chatId, typing } = useParams(); // type может быть 'incoming' или 'outgoing'
    const [isClosing, setIsClosing] = useState(false);
    // callState: 'incoming' | 'outgoing' | 'active'
    const [callState, setCallState] = useState(typing || 'outgoing');
    const [timer, setTimer] = useState('00:00');

    const displayName = userName;
    const color = useMemo(() => getAvatarColor(displayName), [displayName]);
    const letter = useMemo(() => getFirstLetter(displayName), [displayName]);

    useEffect(() => {
        // Подписываемся на сигналы подтверждения/сброса
        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            if (msg.chat_id !== chatId) return;

            if (msg.type === "CALL_ACCEPT") {
                setCallState('active');
                StartVoice(); // Запускаем аудио, когда получили подтверждение
            }
            if (msg.type === "CALL_INVITE") {
                setCallState('incoming');
            }
            if (msg.type === "CALL_REJECT" || msg.typing === "CALL_HANGUP") {
                handleClose();
            }
        });

        return () => unsubscribe();
    }, [chatId]);

    // Таймер запускаем только в активной фазе
    useEffect(() => {
        if (callState !== 'active') return;

        const startTime = Date.now();
        const interval = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            setTimer(`${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [callState]);

    const handleAccept = () => {
        // Передаем просто строку
        Events.Emit("ui_call_accept", chatId); 
        setCallState('active');
        StartVoice();
    };

    const handleClose = async () => {
        if (isClosing) return;
        setIsClosing(true);

        try {
            Events.Emit("ui_call_reject", 
                chatId);

            // 2. Вызываем Disconnect из биндингов Go
            await Disconnect();

            // 3. ПАУЗА перед закрытием окна.
            // Без нее Wails уничтожает контекст JS раньше, чем Emit улетает в Go.
            setTimeout(() => {
                Window.Close();
            }, 200);
        } catch (err) {
            console.error("Ошибка при закрытии:", err);
            Window.Close(); // Закрываем в любом случае при критической ошибке
        }
    };
    // Рендер контента в зависимости от состояния
    const renderStatus = () => {
        switch(callState) {
            case 'incoming': return "Входящий вызов...";
            case 'outgoing': return "Ожидание ответа...";
            case 'active': return "Разговор";
            default: return "";
        }
    };

    return (
        <div className={`call-container ${callState}`}>
            <div className="drag-region" style={{ "--wails-draggable": "drag" }}></div>

            <div className="call-card">
                <div className={`avatar-pulse ${callState === 'active' ? 'paused' : ''}`}>
                    <div className="avatar" style={{ backgroundColor: color }}>
                        <span>{letter}</span>
                    </div>
                </div>

                <h2 className="user-name">{displayName}</h2>
                <div className="status-label">{renderStatus()}</div>
                {callState === 'active' && <div className="timer">{timer}</div>}

                <div className="controls">
                    {callState === 'incoming' && (
                        <button className="accept-call-btn" onClick={handleAccept} title="Принять">
                            <svg viewBox="0 0 24 24" width="28" height="28">
                                <path fill="white" d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z"/>
                            </svg>
                        </button>
                    )}
                    
                    <button className="end-call-btn" onClick={handleClose} title={callState === 'incoming' ? "Отклонить" : "Завершить"}>
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <path fill="white" d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" style={{ transform: 'rotate(135deg)', transformOrigin: 'center' }}/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CallWindow;