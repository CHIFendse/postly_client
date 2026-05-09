import { useState, useEffect } from 'react';
import './header.css';
import { StartVoice, Disconnect, SetToken, OpenCallWindow, SetRoomID  } from '@bindings/client/pages/voicechat';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import decall from '../assets/images/phone-line.png'
import callIcon from '../assets/images/phone-fill.png'
import addUserImg from '../assets/images/user-plus.svg'
import { Events } from '@wailsio/runtime';

// Добавляем setExternalConnected в деструктуризацию пропсов
function Header({ token, chatName, chatId }) {
    const [status, setStatus] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [timer, setTimer] = useState('00:00');
    const [isMuted, setIsMuted] = useState(false);
    

    useEffect(() => {
        const unsubscribe = Events.On("server_message", async (event) => {
            const msg = event.data;
            // Используем msg.type или msg.typing в зависимости от твоего протокола
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
            // Wails v3 передает данные в event.data
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
    }, [token, chatId]); // Добавлен chatId для актуальности данных

    // Вспомогательная функция для старта голоса
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
            // ВАЖНО: передаем 'outgoing', чтобы открылось окно ожидания
            await OpenCallWindow(chatId.toString(), chatName, "outgoing"); 
            setStatus('Звоним...');
        } catch (err) {
            console.error("Ошибка при инициации звонка:", err);
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
