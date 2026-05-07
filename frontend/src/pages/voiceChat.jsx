import './voiceChat.css';
import { useState, useEffect } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import ChatsMenu from '../components/chatsMenu';
import Chat from './chat';
import { Events } from '@wailsio/runtime';
import { SetRoomID, SetToken } from '@bindings/client/pages/voicechat';

function VoiceChat({ token, handleLogout }) {
  const username = localStorage.getItem("username");
  const myId = localStorage.getItem("id");
  const [view, setView] = useState('chats');
  const [activeChatId, setActiveChatId] = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  useEffect(() => {
    // ИСПРАВЛЕНИЕ: В v3 события доступны через глобальный объект window.wails
    // Если ты сгенерировал bindings, можно импортировать Events оттуда,
    // но самый надежный способ для v3 сейчас — использовать window.wails.Events
    const unsubscribe = Events.On("friend_added", (data) => {
        triggerRefresh();
    });

    return () => unsubscribe(); 
  }, []);

  const handleChatSelection = async (chatId, name) => {
    setActiveChatId(chatId);
    localStorage.setItem("lastActiveChatId", chatId);
    setActiveChatName(name);
    localStorage.setItem("lastChatName", name);

    // В v3 функции возвращают Promise, лучше использовать await или .then()
    try {
        await SetToken(token);
        const roomIdInt = chatId;
        await SetRoomID(roomIdInt);
    } catch (err) {
        console.error("Ошибка вызова методов Go:", err);
    }
  };

  const triggerRefresh = () => setRefreshTrigger(prev => !prev);

  return (
    <div className="container" >
      <MainHeader 
                handleLogout={handleLogout} 
                username={username} 
                setChat={setActiveChatId} 
                setChatName={setActiveChatName}
                setView={setView}
            />
      <Menu setView={setView}/>
      <ChatsMenu 
                currentUserId={myId}
                onSelectChat={handleChatSelection} 
                activeChatId={activeChatId}
                refreshTrigger={refreshTrigger}
                onChatCreated={triggerRefresh}
                view={view}
            />
      <div className="main-content">
        <Header token={token} chatName={activeChatName} chatId={activeChatId}/>
                {activeChatId ? (
                    <Chat chatId={activeChatId}/>
                ) : (
                    <div className="chat-placeholder">
                        <div className="placeholder-content">
                            <p>Выберите чат, чтобы начать общение</p>
                        </div>
                    </div>)}
      </div>
    </div>
  );
}

export default VoiceChat;