import { useState, useEffect } from 'react';
import './header.css';
import { StartVoice, Disconnect, SetToken, OpenCallWindow, SetRoomID } from '@bindings/client/pages/voicechat';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import decall from '../assets/images/phone-line.png'
import callIcon from '../assets/images/phone-fill.png'
import { Events } from '@wailsio/runtime';

function Header({ token, chatName, chatId, onMenuToggle }) {
    const [status, setStatus] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [timer, setTimer] = useState('00:00');
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const unsubscribe = Events.On("server_message", async (event) => {
            const msg = event.data;
            const msgType = msg.type || msg.typing;
            console.log(event.data);
            if (msgType === "CALL_INVITE") {
                await OpenCallWindow(msg.chat_id.toString(), msg.name, "incoming");
            }

            if (msgType === "CALL_ACCEPT") {
                setStatus('В разговоре');
                setIsConnected(true);
            }

            if (msgType === "CALL_REJECT" || msgType === "CALL_HANGUP") {
                setStatus('Звонок завершен');
                await Disconnect();
                setTimeout(() => setStatus(''), 3000);
            }
        });

        const subAccept = Events.On("ui_call_accept", async (event) => {
            const targetId = event.data?.toString();
            
            await SendWSMessage(JSON.stringify({
                type: "CALL_ACCEPT",
                chat_id: targetId,
                sender_id: localStorage.getItem("id")
            }));
            startVoiceSession(targetId);
        });

        const subReject = Events.On("ui_call_reject", async (event) => {
            const targetId = event.data?.toString();

            await SendWSMessage(JSON.stringify({
                type: "CALL_REJECT",
                chat_id: targetId,
                sender_id: localStorage.getItem("id")
            }));
            
            await Disconnect();
            setStatus('Звонок отклонен');
            setIsConnected(false);
            setTimeout(() => setStatus(''), 2000);
        });

        return () => {
            unsubscribe();
            subAccept();
            subReject();
        };
    }, [token, chatId]);

    const startVoiceSession = async (cId) => {
        try {
            await SetToken(token);
            await SetRoomID(cId.toString());
            await StartVoice();
            setIsConnected(true);
        } catch (e) {
            console.error("Ошибка старта голоса:", e);
        }
    };

    const handleToggleCall = async () => {
        if (!chatId) return;

        const inviteData = {
            type: "CALL_INVITE",
            chat_id: chatId.toString(),
            sender_id: localStorage.getItem("id"),
            name: chatName
        };
        try {
            await SendWSMessage(JSON.stringify(inviteData));
            await OpenCallWindow(chatId.toString(), chatName, "outgoing");
            setStatus('Звоним...');
        } catch (err) {
            console.error("Ошибка при инициации звонка:", err);
        }
    };

    const addUser = async () => {
        // Логика добавления пользователя
    };

    const handleDisconnect = async () => {
        try {
            await Disconnect();
            setIsConnected(false);
            setStatus('Звонок завершен');
            setTimeout(() => setStatus(''), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const handleMenuClick = (e) => {
        e.stopPropagation();
        console.log('Menu button clicked!'); // Проверь консоль
        if (onMenuToggle) {
            onMenuToggle();
        }
    };

    if (!chatId) {
        return (
            <header className="header">
                <div className='left-group'>
                    <button 
                        className="menu-toggle-btn" 
                        onClick={handleMenuClick}
                        type="button"
                    >
                        ☰
                    </button>
                </div>
            </header>
        );
    }

    return (
        <header className="header">
            <div className='left-group'>
                <button 
                    className="menu-toggle-btn" 
                    onClick={handleMenuClick}
                    type="button"
                >
                    ☰
                </button>
                <nav className="chat-name">{chatName}</nav>
            </div>
            
            <div className="header-right">
                {isConnected && (
                    <span className="status-text">{status}</span>
                )}
                
                
                <button 
                    className={`call-button ${isConnected ? 'connected' : 'disconnected'}`}
                    onClick={isConnected ? handleDisconnect : handleToggleCall}
                    title={isConnected ? 'Завершить звонок' : 'Позвонить'}
                >
                    <img 
                        src={isConnected ? decall : callIcon} 
                        alt={isConnected ? "Hang Up" : "Call"} 
                        className="button-icon"
                    />
                </button>
            </div>

            {isConnected && (
                <div className="call-overlay">
                    <div className="call-info">
                        <div className="call-avatar"></div>
                        <div className="call-details">
                            <span className="call-nickname">{chatName}</span>
                            <span className="call-timer">{timer}</span>
                        </div>
                    </div>
                    <div className="call-controls">
                        <button 
                            className={`control-btn ${isMuted ? 'muted' : ''}`}
                            onClick={toggleMute}
                        >
                            <span className="control-icon">🎤</span>
                        </button>
                        <button 
                            className="control-btn disconnect-btn"
                            onClick={handleDisconnect}
                        >
                            <span className="control-icon">📞</span>
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header;