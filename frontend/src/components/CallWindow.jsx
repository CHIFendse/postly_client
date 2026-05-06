import { useParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import './CallWindow.css'; 
import { Window } from '@wailsio/runtime';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import { Disconnect } from '@bindings/client/pages/voicechat';

function CallWindow() {
    const { userName, chatId } = useParams();

    const displayName = userName;

    const [timer, setTimer] = useState('00:00');

    const color = useMemo(() => getAvatarColor(displayName), [displayName]);
    const letter = useMemo(() => getFirstLetter(displayName), [displayName]);


    // Таймер звонка
    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
            const secs = String(seconds % 60).padStart(2, '0');
            setTimer(`${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleClose = () => {
        Disconnect(chatId);
        Window.Close();
    };



    return (
        <div className="call-container">
            <div className="drag-region" style={{ "--wails-draggable": "drag" }}></div>

            <div className="call-card">
                <div className="avatar-pulse">
                    <div className="avatar" style={{ backgroundColor: color }}>
                        <span>{letter}</span>
                    </div>
                </div>

                {/* Отображаем полное имя собеседника */}
                <h2 className="user-name">{displayName}</h2>
                <div className="status-label">Входящий звонок</div>
                <div className="timer">{timer}</div>

                <div className="controls">
                    <button className="end-call-btn" onClick={handleClose} title="Завершить">
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <path fill="currentColor" d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" transform="rotate(135 12 12)"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CallWindow;