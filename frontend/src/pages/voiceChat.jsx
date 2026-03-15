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
  const [activeChatName, setActiveChatName] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleChatSelection = (chatId, username) => {
    setActiveChatId(chatId);
    localStorage.setItem("lastActiveChatId", chatId);
    setActiveChatName(username);
    SetToken(token);
    
    const roomIdInt = chatId;
      SetRoomID(roomIdInt);
      console.log(roomIdInt);
  };

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);
  
  return (
    <div className="container" >
      <MainHeader handleLogout={handleLogout} username={username}/>
      <Menu/>
      <FriendsMenu 
                currentUserId={myId}
                onSelectChat={handleChatSelection} 
                activeChatId={activeChatId} 
                refreshTrigger={refreshTrigger}
                onChatCreated={triggerRefresh}
            />
      <div className="main-content">
        <Header token={token} chatName={activeChatName}/> 
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