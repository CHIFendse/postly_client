import './voiceChat.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import Menu from '../components/menu';
import MainHeader from '../components/mainHeader';
import ChatsMenu from '../components/chatsMenu';

import Chat from './chat';
import Settings from './Settings';
import { Events } from '@wailsio/runtime';
import { SetRoomID, SetToken as SetVoiceToken } from '@bindings/client/pages/voicechat';
import { Connect, SetToken as SetChatToken } from '@bindings/client/pages/chatws';
import { getAvatarColor } from '../utils/avatarHelper';

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


// ── Строка поиска сообщений (между Header и Chat) ──
function ChatSearchBar({ value, onChange, onClose, matchCount, matchIdx, onNav }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const getAvatarColor = (name) => {
        const colors = ['#5865f2', '#57f287', '#eb459e', '#ed4245', '#faa81a', '#9b59b6', '#1abc9c', '#e67e22', '#3498db', '#e74c3c'];
        const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
        return colors[idx];
    };
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

  const [view, setView] = useState(() => localStorage.getItem('lastView') || 'chats');
  const [activeChatId,   setActiveChatId]   = useState(
    getCookie('lastActiveChatId') || localStorage.getItem('lastActiveChatId')
  );
  const [activeChatName, setActiveChatName] = useState(
    getCookie('lastChatName') || localStorage.getItem('lastChatName')
  );
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // Search state
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatch, setSearchMatch] = useState({ count: 0, idx: 0 });

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatch({ count: 0, idx: 0 });
  };
  const handleSearchNav = dir => {
    setSearchMatch(m =>
      m.count > 0 ? { ...m, idx: (m.idx + dir + m.count) % m.count } : m
    );
  };

  // Reset search when chat changes
  useEffect(() => { closeSearch(); }, [activeChatId]);

  // Ref для activeChatId — актуален в event-handler'ах без пересоздания подписки
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  const triggerRefresh = useCallback(() => setRefreshTrigger(prev => !prev), []);
  const toggleMobileMenu = () => setIsMobileMenuOpen(v => !v);
  const closeMobileMenu  = () => setIsMobileMenuOpen(false);

  // ─────────────────────────────────────────────────────────
  // 1. Инициализация WS — один раз на токен
  //    - SetChatToken → chatws.SetToken
  //    - Connect('')  → chatws.Connect (одно соединение, chat_id не в URL)
  //    - SetVoiceToken + SetRoomID → WebRTC-комната (отдельный модуль)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        await SetChatToken(token);
        await Connect('');
      } catch (err) {
        if (!cancelled) console.error('WS init error:', err);
      }

      const savedId =
        getCookie('lastActiveChatId') || localStorage.getItem('lastActiveChatId');
      if (savedId) {
        try {
          await SetVoiceToken(token);
          await SetRoomID(savedId);
        } catch (err) {
          if (!cancelled) console.error('Voice room restore error:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // ─────────────────────────────────────────────────────────
  // 2. Friend requests: GET + polling каждые 30 сек
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/getFriendRequests`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json().catch(() => []);
        setFriendRequestCount(Array.isArray(data) ? data.length : 0);
      } catch (_) {}
    };

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [token]);

  // ─────────────────────────────────────────────────────────
  // 3. Единый слушатель server_message — обновление списка чатов и
  //    закрытие окна при DELETE_CHAT активного чата
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = Events.On('server_message', (event) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case 'DELETE_CHAT': {
          if (String(msg.chat_id) === String(activeChatIdRef.current)) {
            setActiveChatId(null);
            setActiveChatName('');
            deleteCookie('lastActiveChatId');
            deleteCookie('lastChatName');
            localStorage.removeItem('lastActiveChatId');
            localStorage.removeItem('lastChatName');
          }
          triggerRefresh();
          break;
        }
        case 'NEW_CHAT':
        case 'CLEAR_CHAT': {
          triggerRefresh();
          break;
        }
        case 'FRIEND_REQUEST': {
          // На случай если сервер всё-таки эмитит — перезагрузим счётчик
          (async () => {
            try {
              const r = await fetch(`${API_BASE}/getFriendRequests`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!r.ok) return;
              const data = await r.json().catch(() => []);
              setFriendRequestCount(Array.isArray(data) ? data.length : 0);
            } catch (_) {}
          })();
          break;
        }
        default:
          break;
      }
    });
    return () => unsub();
  }, [token, triggerRefresh]);

  // Дублирующий Events.On("friend_added") больше не нужен — покрыт polling'ом
  // и (опционально) FRIEND_REQUEST выше.

  // ─────────────────────────────────────────────────────────
  // 4. Выбор чата — текст идёт через одно WS, room_id — только для WebRTC
  // ─────────────────────────────────────────────────────────
  const handleChatSelection = async (chatId, name) => {
    setActiveChatId(chatId);
    setCookie('lastActiveChatId', chatId);
    localStorage.setItem('lastActiveChatId', chatId);
    setActiveChatName(name);
    setCookie('lastChatName', name);
    localStorage.setItem('lastChatName', name);
    setIsMobileMenuOpen(false);

    // Только если voice-комната реально привязана к чату:
    // try { await SetRoomID(chatId); } catch (err) { console.error(err); }
  };

  const handleChatDeleted = useCallback((id) => {
    if (String(id) === String(activeChatIdRef.current)) {
      setActiveChatId(null);
      setActiveChatName('');
      deleteCookie('lastActiveChatId');
      deleteCookie('lastChatName');
      localStorage.removeItem('lastActiveChatId');
      localStorage.removeItem('lastChatName');
    }
    triggerRefresh();
  }, [triggerRefresh]);

  // ─────────────────────────────────────────────────────────
  // 5. Logout — чистим кеши, обнуляем токен, сбрасываем cookies
  // ─────────────────────────────────────────────────────────
  const handleLogoutWithClear = async () => {
    deleteCookie('lastActiveChatId');
    deleteCookie('lastChatName');
    try { await SetChatToken(''); } catch (_) {}
    handleLogout();
  };

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
            getAvatarColor = {getAvatarColor}
          />

          {isMobileMenuOpen && (
            <div className="menu-overlay" onClick={closeMobileMenu} />
          )}

          <div className="main-content">

            {activeChatId && searchOpen && (
              <ChatSearchBar
                value={searchQuery}
                onChange={v => {
                  setSearchQuery(v);
                  setSearchMatch(m => ({ ...m, idx: 0 }));
                }}
                onClose={closeSearch}
                matchCount={searchMatch.count}
                matchIdx={searchMatch.idx}
                onNav={handleSearchNav}
              />
            )}

            {activeChatId ? (
              <Chat
                chatId={activeChatId}
                chatName={activeChatName}
                token={token}
                searchQuery={searchQuery}
                searchNavIdx={searchMatch.idx}
                onMatchesFound={count =>
                  setSearchMatch(m => ({ ...m, count }))
                }
                onMessageSent={() => triggerRefresh()}
                onMenuToggle={toggleMobileMenu}
                getAvatarColor = {getAvatarColor}
              />
            ) : (
              <div className="chat-placeholder">
                <div className="placeholder-content">
                  <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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