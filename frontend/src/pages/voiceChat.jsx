import './voiceChat.css';
import { useState, useEffect } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import ChatsMenu from '../components/chatsMenu';
import Chat from './chat';
import Settings from './Settings';
import { Events } from '@wailsio/runtime';
import { SetRoomID, SetToken } from '@bindings/client/pages/voicechat';

function VoiceChat({ token, handleLogout, currentVersion }) {
  const username = localStorage.getItem("username");
  const myId     = localStorage.getItem("id");

  const [view, setView] = useState(() =>
    localStorage.getItem('lastView') || 'chats'
  );
  const [activeChatId,   setActiveChatId]   = useState(localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = Events.On("friend_added", () => triggerRefresh());
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
      {/* ── Брендовая шапка (только десктоп) ── */}
      <MainHeader
        handleLogout={handleLogout}
        username={username}
        setChat={setActiveChatId}
        setChatName={setActiveChatName}
        setView={setView}
      />

      {/* ── Тело: sidebar + chats + main ── */}
      <div className="app-body">
        <Menu
          setView={setView}
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          username={username}
          onLogout={handleLogout}
          onSettingsClick={() => setView('settings')}
          currentView={view}
        />

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

        {/* Оверлей для мобильного меню */}
        {isMobileMenuOpen && (
          <div className="menu-overlay" onClick={closeMobileMenu} />
        )}

        {/* ── Основная область ── */}
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
                <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p>Выберите чат, чтобы начать общение</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Настройки: полный оверлей поверх всего app-body ── */}
        {view === 'settings' && (
          <div className="settings-fullscreen">
            <Settings
              onBack={() => setView('chats')}
              currentVersion={currentVersion}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceChat;
