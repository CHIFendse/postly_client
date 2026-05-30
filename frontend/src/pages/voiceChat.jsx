import './voiceChat.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import Menu from '../components/menu';
import Header from '../components/header';
import MainHeader from '../components/mainHeader';
import ChatsMenu, { clearChatsCache } from '../components/chatsMenu';
import Chat, { clearMessagesCache } from './chat';
import Settings from './Settings';
import { Events } from '@wailsio/runtime';
import { SetRoomID, SetToken } from '@bindings/client/pages/voicechat';

const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
};
const deleteCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

const API_BASE = 'https://api.postly-mes.ru:8081';

// ── Строка поиска сообщений (между Header и Chat) ──
function ChatSearchBar({ value, onChange, onClose, matchCount, matchIdx, onNav }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="chat-search-bar">
      <button className="csb-btn" onClick={onClose} title="Закрыть">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>
      <input
        ref={inputRef}
        className="csb-input"
        placeholder="Поиск сообщений..."
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onNav(e.shiftKey ? -1 : 1);
          if (e.key === 'Escape') onClose();
        }}
      />
      <span className="csb-count">
        {value ? (matchCount > 0 ? `${matchIdx + 1} / ${matchCount}` : '0') : ''}
      </span>
      <button className="csb-btn" onClick={() => onNav(-1)} disabled={!matchCount} title="Предыдущее">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button className="csb-btn" onClick={() => onNav(1)} disabled={!matchCount} title="Следующее">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function VoiceChat({ token, handleLogout, currentVersion }) {
  const username = localStorage.getItem("username");
  const myId     = localStorage.getItem("id");

  // Чистим кеши предыдущего аккаунта при каждом входе
  useEffect(() => {
    clearChatsCache();
    clearMessagesCache();
  }, []);

  const [view, setView] = useState(() => localStorage.getItem('lastView') || 'chats');
  const [activeChatId,   setActiveChatId]   = useState(getCookie('lastActiveChatId') || localStorage.getItem('lastActiveChatId'));
  const [activeChatName, setActiveChatName] = useState(getCookie('lastChatName') || localStorage.getItem('lastChatName'));
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // Search state
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatch, setSearchMatch] = useState({ count: 0, idx: 0 });

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setSearchMatch({ count: 0, idx: 0 }); };
  const handleSearchNav = dir => {
    setSearchMatch(m => m.count > 0
      ? { ...m, idx: (m.idx + dir + m.count) % m.count }
      : m
    );
  };

  // Reset search on chat change
  useEffect(() => { closeSearch(); }, [activeChatId]);

  // Friend requests badge
  useEffect(() => {
    const freshToken = localStorage.getItem('jwt_token');
    const userId     = localStorage.getItem('id');
    if (!freshToken || !userId) return;
    fetch(`${API_BASE}/getFriendRequests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
      body: JSON.stringify({ user_id: userId }),
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFriendRequestCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = Events.On("friend_added", () => triggerRefresh());
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const savedId = getCookie('lastActiveChatId') || localStorage.getItem('lastActiveChatId');
    if (!savedId || !token) return;
    (async () => {
      try { await SetToken(token); await SetRoomID(savedId); }
      catch (err) { console.error("Ошибка восстановления комнаты:", err); }
    })();
  }, []);

  const handleChatSelection = async (chatId, name) => {
    setActiveChatId(chatId);
    setCookie('lastActiveChatId', chatId);
    localStorage.setItem("lastActiveChatId", chatId);
    setActiveChatName(name);
    setCookie('lastChatName', name);
    localStorage.setItem("lastChatName", name);
    setIsMobileMenuOpen(false);
    try { await SetToken(token); await SetRoomID(chatId); }
    catch (err) { console.error(err); }
  };

  const handleLogoutWithClear = () => {
    deleteCookie('lastActiveChatId');
    deleteCookie('lastChatName');
    handleLogout();
  };

  // Ref для activeChatId — всегда актуален даже в event-handler'ах
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  // Стабильный callback — не меняется при каждом рендере
  const handleChatDeleted = useCallback((id) => {
    if (id === activeChatIdRef.current) {
      setActiveChatId(null);
      setActiveChatName('');
      deleteCookie('lastActiveChatId');
      deleteCookie('lastChatName');
      localStorage.removeItem('lastActiveChatId');
      localStorage.removeItem('lastChatName');
    }
    setRefreshTrigger(prev => !prev);
  }, []); // пустой массив — стабильная функция, читаем через ref

  // Прямой WS-слушатель для закрытия окна при DELETE_CHAT
  useEffect(() => {
    const unsub = Events.On('server_message', (event) => {
      const msg = event.data;
      if (!msg || msg.type !== 'DELETE_CHAT') return;
      if (msg.chat_id === activeChatIdRef.current) {
        setActiveChatId(null);
        setActiveChatName('');
        deleteCookie('lastActiveChatId');
        deleteCookie('lastChatName');
        localStorage.removeItem('lastActiveChatId');
        localStorage.removeItem('lastChatName');
      }
    });
    return () => unsub();
  }, []);

  const triggerRefresh = useCallback(() => setRefreshTrigger(prev => !prev), []);
  const toggleMobileMenu = () => setIsMobileMenuOpen(v => !v);
  const closeMobileMenu  = () => setIsMobileMenuOpen(false);

  return (
    <div className="container">
      <MainHeader
        handleLogout={handleLogoutWithClear}
        username={username}
        setChat={setActiveChatId}
        setChatName={setActiveChatName}
        setView={setView}
      />

      <div className="app-body">
        <Menu
          setView={setView}
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          username={username}
          onLogout={handleLogoutWithClear}
          onSettingsClick={() => setView('settings')}
          currentView={view}
          friendRequestCount={friendRequestCount}
        />

        <div className="app-right">
          <ChatsMenu
            currentUserId={myId}
            onSelectChat={handleChatSelection}
            activeChatId={activeChatId}
            refreshTrigger={refreshTrigger}
            onChatCreated={triggerRefresh}
            view={view}
            isOpen={isMobileMenuOpen}
            onClose={closeMobileMenu}
            onFriendRequestsLoaded={setFriendRequestCount}
            onChatDeleted={handleChatDeleted}
            onSetView={setView}
          />

          {isMobileMenuOpen && (
            <div className="menu-overlay" onClick={closeMobileMenu} />
          )}

          <div className="main-content">
            <Header
              token={token}
              chatName={activeChatName}
              chatId={activeChatId}
              onMenuToggle={toggleMobileMenu}
              searchOpen={searchOpen}
              onSearchToggle={() => searchOpen ? closeSearch() : setSearchOpen(true)}
            />

            {/* Search bar between header and chat */}
            {activeChatId && searchOpen && (
              <ChatSearchBar
                value={searchQuery}
                onChange={v => { setSearchQuery(v); setSearchMatch(m => ({ ...m, idx: 0 })); }}
                onClose={closeSearch}
                matchCount={searchMatch.count}
                matchIdx={searchMatch.idx}
                onNav={handleSearchNav}
              />
            )}

            {activeChatId ? (
              <Chat
                chatId={activeChatId}
                searchQuery={searchQuery}
                searchNavIdx={searchMatch.idx}
                onMatchesFound={count => setSearchMatch(m => ({ ...m, count }))}
              />
            ) : (
              <div className="chat-placeholder">
                <div className="placeholder-content">
                  <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Выберите чат, чтобы начать общение</p>
                </div>
              </div>
            )}
          </div>

          {view === 'settings' && (
            <div className="settings-fullscreen">
              <Settings onBack={() => setView('chats')} currentVersion={currentVersion} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceChat;
