import './voiceChat.css';
import { useState, useEffect } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import ChatsMenu from '../components/chatsMenu';
import Chat from './chat'
import {SetRoomID, SetToken} from '../../wailsjs/go/pages/VoiceChat'
import { EventsOn } from '../../wailsjs/runtime/runtime';

function VoiceChat({ token, handleLogout }) {
  const username = localStorage.getItem("username")
  const myId = localStorage.getItem("id")
  const [view, setView] = useState('chats'); // 'chats' или 'groups'
  const [activeChatId, setActiveChatId] = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);

  useEffect(() => {
    const unsubscribe = EventsOn("friend_added", (data) => {
        // Вызываем обновление списка
        triggerRefresh();
    });

    return () => unsubscribe(); // Отписываемся при размонтировании
  }, []);

  const handleChatSelection = (chatId, name) => {
    setActiveChatId(chatId); // Обновляем экран
    localStorage.setItem("lastActiveChatId", chatId);
    setActiveChatName(name);
    localStorage.setItem("lastChatName", name);
    SetToken(token);
    
    // Устанавливаем ID комнаты. 
    const roomIdInt = chatId;
      SetRoomID(roomIdInt);
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