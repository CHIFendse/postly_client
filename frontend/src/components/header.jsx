import { useState, useEffect } from 'react';
import './header.css';
import { Connect, Disconnect, SetToken } from '../../wailsjs/go/pages/VoiceChat';
import micOff from '../assets/images/mic-off-fill.png'; 
import micOn from '../assets/images/mic-fill.png';
import decall from '../assets/images/phone-line.png'
import callIcon from '../assets/images/phone-fill.png'

function Header({ token, chatName }) {
    const [status, setStatus] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [timer, setTimer] = useState('00:00');
    const [isMuted, setIsMuted] = useState(false);
    

    useEffect(() => {
    let interval;
    if (isConnected) {
      const startTime = Date.now();
      interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        setTimer(`${mins}:${secs}`);
        setStatus(`${mins}:${secs}`);
      }, 1000);
    } else {
      setTimer('Подключение...');
    }
    return () => clearInterval(interval);
  }, [isConnected]);

    const handleToggleCall = async () => {
        if (!isConnected) {
            try {
                if (!token) {
                    setStatus('Ошибка: нет токена');
                    console.error("Токен отсутствует в пропсах Header");
                    return;
                }
                
                await SetToken(token);
                await Connect();
                setIsConnected(true);
            
            } catch (err) {
                setStatus('Сервер не отвечает...');
                console.error(err);
            }
        } else {
            try {
                await Disconnect();
                setIsConnected(false);
                if (setExternalConnected) setExternalConnected(false);
                setStatus('Вы вышли');
                setTimeout(() => setStatus(''), 2000);
            } catch (err) {
                console.error(err);
            }
        }
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
        // MuteMicrophone(!isMuted); НУЖНО РЕАЛИЗОВАТЬ  
    };
    return (
        <>
            <header className="header">
                <div className='left-group'>
                    <nav className="chat-name">{chatName}</nav>
                </div>
                <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px'}}>
                {!isConnected && (
                    <button 
                        className="call-button disconnected"
                        onClick={handleToggleCall}
                        title="Позвонить"
                    >
                        <img 
                            src={callIcon} 
                            alt="Call Icon" 
                            className="button-icon"
                        />
                    </button>
                )}
                </div>
            </header>
            {isConnected && (
                    <div className="call-overlay">
                        <div className="call-info">
                            <img src={"пенис" || callIcon} alt="Avatar" className="call-avatar" />
                            <div className="call-details">
                                <span className="call-nickname">{chatName}</span>
                                <span className="call-timer">{timer}</span>
                            </div>
                        </div>
                        <div className="call-controls">
                            <button 
                                className={`control-btn ${isMuted ? 'muted' : ''}`} 
                                onClick={toggleMute}
                                title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                            >
                                
                                <img 
                                    src={isMuted ? micOff : micOn} 
                                    alt="Mute" 
                                    className="control-icon" 
                                />
                            </button>
                            <button 
                                className="control-btn disconnect-btn" 
                                onClick={handleDisconnect}
                                title="Завершить звонок"
                            >
                                <img 
                                    src={decall} 
                                    alt="End Call" 
                                    className="control-icon" 
                                />
                            </button>
                        </div>
                    </div>
                )}
            </>
    );
}

export default Header;
