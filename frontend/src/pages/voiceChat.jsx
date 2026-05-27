import './voiceChat.css';
import { useState, useEffect } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import ChatsMenu from '../components/chatsMenu';
import Chat from './chat';
import SettingsModal from '../components/SettingsModal';
import { Events } from '@wailsio/runtime';
import { SetRoomID, SetToken } from '@bindings/client/pages/voicechat';

function VoiceChat({ token, handleLogout }) {
  const username  = localStorage.getItem("username");
  const myId      = localStorage.getItem("id");

  const [view, setView] = useState(() =>
    localStorage.getItem('lastView') || 'chats'
  );
  const [activeChatId,   setActiveChatId]   = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = Events.On("friend_added", () => {
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
      await SetRoomID(chatId);
    } catch (err) {
      console.error("Ошибка вызова методов Go:", err);
    }
  };

  const triggerRefresh = () => setRefreshTrigger(prev => !prev);

  const toggleMobileMenu = () => setIsMobileMenuOpen(v => !v);
  const closeMobileMenu  = () => setIsMobileMenuOpen(false);

  return (
    <div className="container">
      {/* Фирменная шапка (только десктоп) */}
      <MainHeader
        handleLogout={handleLogout}
        username={username}
        setChat={setActiveChatId}
        setChatName={setActiveChatName}
        setView={setView}
      />

      {/* Левое меню-навигация */}
      <Menu
        setView={setView}
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        username={username}
        onLogout={handleLogout}
        onSettingsClick={() => setShowSettings(true)}
        currentView={view}
      />

      {/* Список чатов/групп */}
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

      {/* Оверлей мобильных меню */}
      {isMobileMenuOpen && (
        <div className="menu-overlay" onClick={closeMobileMenu} />
      )}

      {/* Основная область */}
      <div className="main-content">
        <Header
          token={token}
          chatName={activeChatName}
          chatId={activeChatId}
          onMenuToggle={toggleMobileMenu}
        />

        {activeChatId ? (
          <Chat chatId={activeChatId} />
        ) : (
          <div className="chat-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">💬</div>
              <p>Выберите чат, чтобы начать общение</p>
            </div>
          </div>
        )}
      </div>

      {/* Модалка настроек */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default VoiceChat;
