import { useState, useEffect } from 'react';
import './header.css';
import { Connect, Disconnect, SetToken, OpenCallWindow, SetRoomID  } from '@bindings/client/pages/voicechat';
import decall from '../assets/images/phone-line.png'
import callIcon from '../assets/images/phone-fill.png'
import addUserImg from '../assets/images/user-plus.svg'

// Добавляем setExternalConnected в деструктуризацию пропсов
function Header({ token, chatName, chatId }) {
    const [status, setStatus] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [timer, setTimer] = useState('00:00');
    const [isMuted, setIsMuted] = useState(false);
    


    const handleToggleCall = async () => {
        try {
            await OpenCallWindow(chatId.toString(), chatName);
            await SetToken(token);
            await SetRoomID(chatId.toString());
            await Connect();
        } catch (err) {
            console.error("Не удалось открыть окно звонка:", err);
        }
    };
    const addUser = async () => {

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
        // Здесь можно вызвать функцию из Go для выключения микрофона
        // MuteMicrophone(!isMuted);
    };
    if (!chatId) {
        return (
            <header className="header"></header>
        )
    };
    return (
        <>
            <header className="header">
                <div className='left-group'>
                    <nav className="chat-name">{chatName}</nav>
                </div>
                <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <button 
                        className="adduser-button"
                        onClick={addUser}
                        title="Добавить пользователя в чат"
                    >
                        <img 
                        className="addUserIcon" 
                        src={addUserImg} 
                        alt="Add New User"
                        />
                    </button>
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
                </div>
            </header>
            
            </>
    );
}

export default Header;
