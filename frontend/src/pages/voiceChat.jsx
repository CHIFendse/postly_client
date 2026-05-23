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
  const [view, setView] = useState(() => {
    return localStorage.getItem('lastView') || 'chats';
  });
  const [activeChatId, setActiveChatId] = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
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
    
    setIsMobileMenuOpen(false);
    
    try {
        await SetToken(token);
        const roomIdInt = chatId;
        await SetRoomID(roomIdInt);
    } catch (err) {
        console.error("Ошибка вызова методов Go:", err);
    }
  };

  const triggerRefresh = () => setRefreshTrigger(prev => !prev);

  const toggleMobileMenu = () => {
    console.log('Toggle menu, current state:', isMobileMenuOpen);
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    console.log('Close menu');
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="container">
      <MainHeader 
        handleLogout={handleLogout} 
        username={username} 
        setChat={setActiveChatId} 
        setChatName={setActiveChatName}
        setView={setView}
      />
      
      {/* Левое меню с группами */}
      <Menu 
        setView={setView} 
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        username={username}
        onLogout={handleLogout}
      />
      
      {/* Меню чатов */}
      <ChatsMenu 
        currentUserId={myId}
        onSelectChat={handleChatSelection} 
        activeChatId={activeChatId}
        refreshTrigger={refreshTrigger}
        onChatCreated={triggerRefresh}
        view={view}
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
      />
      
      {/* Оверлей для мобильных меню */}
      {isMobileMenuOpen && (
        <div className="menu-overlay" onClick={closeMobileMenu} />
      )}
      
      <div className="main-content">
        <Header 
          token={token} 
          chatName={activeChatName} 
          chatId={activeChatId}
          onMenuToggle={toggleMobileMenu}
        />
        
        {activeChatId ? (
          <Chat chatId={activeChatId}/>
        ) : (
          <div className="chat-placeholder">
            <div className="placeholder-content">
              <p>Выберите чат, чтобы начать общение</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChat;