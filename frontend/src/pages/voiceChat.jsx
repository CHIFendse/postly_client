import './voiceChat.css';
import { useState } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import FriendsMenu from '../components/friendsMenu';
import Chat from './chat'
import {SetRoomID, SetToken} from '../../wailsjs/go/pages/VoiceChat'

function VoiceChat({ token, handleLogout }) {
  const username = localStorage.getItem("username")
  const myId = localStorage.getItem("id")
  const [activeChatId, setActiveChatId] = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));

  const handleChatSelection = (chatId, username) => {
    setActiveChatId(chatId); // Обновляем экран
    localStorage.setItem("lastActiveChatId", chatId);
    setActiveChatName(username);
    localStorage.setItem("lastChatName", username);
    // Устанавливаем токен (если еще не установлен)
    SetToken(token);
    
    // Устанавливаем ID комнаты. 
    const roomIdInt = chatId;
      SetRoomID(roomIdInt);
  };
  
  return (
    <div className="container" >
      <MainHeader handleLogout={handleLogout} username={username}/>
      <Menu/>
      <FriendsMenu 
                currentUserId={myId}
                onSelectChat={handleChatSelection} 
                activeChatId={activeChatId} 
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