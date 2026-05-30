import './chatsMenu.css'
import { useState, useEffect, useRef } from 'react';
import { Events } from '@wailsio/runtime';
import { GetUserChats } from '@bindings/client/pages/chat';
import { CreateChat, GetGroups } from '@bindings/client/components/chats';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import CreateGroupModal from './createGroupModal';

// Module-level chats cache: view → { data: [], ts: 0 }
const _chatsCache = new Map();
const CHATS_TTL = 120_000;

export function clearChatsCache() { _chatsCache.clear(); }

const API_BASE = 'https://api.postly-mes.ru:8081';

function formatChatTime(unixSeconds) {
    if (!unixSeconds) return '';
    const d      = new Date(unixSeconds * 1000);
    const now    = new Date();
    const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff   = today - msgDay;
    if (diff === 0)         return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    if (diff === 86400000)  return 'Вчера';
    if (diff === 172800000) return 'Позавчера';
    const opts = d.getFullYear() === now.getFullYear()
        ? { day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('ru-RU', opts);
}

function ChatsMenu({ activeChatId, onSelectChat, refreshTrigger, onChatCreated, view, isOpen, onClose, onFriendRequestsLoaded, onChatDeleted, onSetView }) {
    const [chats, setChats] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [friendsList, setFriendsList] = useState([]);
    // Chat context menu state
    const [chatCtx, setChatCtx]     = useState(null); // { x, y, id }
    const [confirm, setConfirm]     = useState(null); // { title, body, okLabel, onOk }
    const chatCtxRef = useRef(null);
    const lpRef      = useRef(null);
    const [inputText, setInputText] = useState("");
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const username = localStorage.getItem('username');

    // Refs для callbacks — всегда актуальны без перепривязки WS
    const onChatDeletedRef = useRef(onChatDeleted);
    const onChatCreatedRef = useRef(onChatCreated);
    const onSetViewRef     = useRef(onSetView);
    useEffect(() => { onChatDeletedRef.current = onChatDeleted; }, [onChatDeleted]);
    useEffect(() => { onChatCreatedRef.current = onChatCreated; }, [onChatCreated]);
    useEffect(() => { onSetViewRef.current = onSetView; }, [onSetView]);

    // Ref для синхронного доступа к текущим чатам (нужен в WS handler без setChats side-effect)
    const chatsRef = useRef(chats);
    useEffect(() => { chatsRef.current = chats; }, [chats]);

    // Close chat ctx menu on outside click
    useEffect(() => {
        const h = e => {
            if (chatCtxRef.current && !chatCtxRef.current.contains(e.target)) setChatCtx(null);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const openChatCtx = (e, id) => {
        e.preventDefault(); e.stopPropagation();
        const x = e.clientX || e.touches?.[0]?.clientX || 0;
        const y = e.clientY || e.touches?.[0]?.clientY || 0;
        const mw = 192, mh = 96;
        setChatCtx({
            id,
            x: Math.min(x, window.innerWidth - mw - 8),
            y: y + mh > window.innerHeight ? y - mh : y + 2,
        });
    };

    const askConfirm = (title, body, okLabel, onOk) => {
        setChatCtx(null);
        setConfirm({ title, body, okLabel, onOk });
    };

    const handleClearCtx = (id) => askConfirm(
        'Очистить историю',
        'Все сообщения будут удалены безвозвратно.',
        'Очистить',
        async () => {
            const tok = localStorage.getItem('jwt_token');
            const uid = localStorage.getItem('id');
            try {
                await fetch(`${API_BASE}/clearChat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                    body: JSON.stringify({ chat_id: id, user_id: uid }),
                });
                fetchChats();
            } catch {}
        }
    );

    const handleDeleteCtx = (id) => askConfirm(
        'Удалить чат',
        'Чат и все сообщения будут удалены для обоих участников.',
        'Удалить',
        async () => {
            const tok = localStorage.getItem('jwt_token');
            const uid = localStorage.getItem('id');
            try {
                const r = await fetch(`${API_BASE}/deleteChat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                    body: JSON.stringify({ chat_id: id, user_id: uid }),
                });
                if (r.ok) {
                    if (onChatDeleted) onChatDeleted(id);
                    fetchChats();
                }
            } catch {}
        }
    );

    // Long press helpers for chat items
    const startLongPress = (e, id) => {
        const t = e.touches[0];
        const sx = t.clientX, sy = t.clientY;
        lpRef.current = {
            timer: setTimeout(() => {
                navigator.vibrate?.(40);
                setChatCtx({ id, x: Math.min(sx, window.innerWidth - 196), y: sy + 96 > window.innerHeight ? sy - 96 : sy + 2 });
                lpRef.current = null;
            }, 500),
            sx, sy,
        };
    };
    const moveLongPress = e => {
        if (!lpRef.current) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - lpRef.current.sx) > 10 || Math.abs(t.clientY - lpRef.current.sy) > 10) {
            clearTimeout(lpRef.current.timer); lpRef.current = null;
        }
    };
    const endLongPress = () => {
        if (lpRef.current) { clearTimeout(lpRef.current.timer); lpRef.current = null; }
    };

    const fetchChats = async () => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        if (!freshToken || !userId) { setChats([]); return; }

        const hit = _chatsCache.get(view);

        // Show cached immediately — no blank flash
        if (hit) {
            setChats(hit.data);
            if (Date.now() - hit.ts < CHATS_TTL) return; // still fresh
        }

        if (view === 'groups') {
            try {
                const result = await GetGroups(String(userId), freshToken);
                const fresh = result || [];
                _chatsCache.set(view, { data: fresh, ts: Date.now() });
                setChats(fresh);
            } catch (err) {
                console.error("Ошибка загрузки групп:", err);
                if (!hit) setChats([]);
            }
        } else {
            try {
                const result = await GetUserChats(String(userId), freshToken);
                const fresh = result || [];
                _chatsCache.set(view, { data: fresh, ts: Date.now() });
                setChats(fresh);
            } catch (err) {
                console.error("Ошибка загрузки чатов:", err);
                if (!hit) setChats([]);
            }
        }
    };

    const fetchFriends = async () => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        if (!freshToken || !userId) return;

        try {
            const [reqRes, friendsRes] = await Promise.all([
                fetch(`${API_BASE}/getFriendRequests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
                    body: JSON.stringify({ user_id: userId }),
                }),
                fetch(`${API_BASE}/getFriends`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
                    body: JSON.stringify({ user_id: userId }),
                }),
            ]);
            const requests = reqRes.ok ? (await reqRes.json().catch(() => [])) : [];
            const friends  = friendsRes.ok ? (await friendsRes.json().catch(() => [])) : [];
            const reqList  = Array.isArray(requests) ? requests : [];
            const fList    = Array.isArray(friends) ? friends : [];
            setFriendRequests(reqList);
            setFriendsList(fList);
            if (onFriendRequestsLoaded) onFriendRequestsLoaded(reqList.length);
        } catch (_) {
            setFriendRequests([]);
            setFriendsList([]);
        }
    };

    const sendFriendRequest = async (targetUsername) => {
        if (!targetUsername) return;
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        try {
            const r = await fetch(`${API_BASE}/sendFriendRequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
                body: JSON.stringify({ user_id: userId, target_username: targetUsername }),
            });
            if (r.ok) {
                setInputText('');
            } else {
                const data = await r.json().catch(() => ({}));
                console.error('Friend request error:', data.message);
            }
        } catch (err) {
            console.error('Ошибка отправки заявки:', err);
        }
    };

    const acceptFriendRequest = async (requestId) => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        try {
            const r = await fetch(`${API_BASE}/acceptFriendRequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
                body: JSON.stringify({ user_id: userId, request_id: requestId }),
            });
            if (r.ok) await fetchFriends();
        } catch (err) {
            console.error('Ошибка принятия заявки:', err);
        }
    };

    const declineFriendRequest = async (requestId) => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        try {
            const r = await fetch(`${API_BASE}/declineFriendRequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
                body: JSON.stringify({ user_id: userId, request_id: requestId }),
            });
            if (r.ok) await fetchFriends();
        } catch (err) {
            console.error('Ошибка отклонения заявки:', err);
        }
    };

    // Единый WS-обработчик — переподписывается только при смене view
    useEffect(() => {
        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            if (!msg) return;

            if (msg.type === 'FRIEND_REQUEST') {
                setFriendRequests(prev => {
                    const updated = [...prev, msg];
                    if (onFriendRequestsLoaded) onFriendRequestsLoaded(updated.length);
                    return updated;
                });
                return;
            }

            if (msg.type === 'DELETE_MESSAGE') {
                setChats(prev => {
                    const next = prev.map(c => c.id !== msg.chat_id ? c : {
                        ...c,
                        last_message: msg.last_message != null ? msg.last_message : c.last_message,
                        username:     msg.username     != null ? msg.username     : c.username,
                    });
                    _chatsCache.set(view, { data: next, ts: _chatsCache.get(view)?.ts ?? Date.now() });
                    return next;
                });
                return;
            }

            if (msg.type === 'CLEAR_CHAT') {
                setChats(prev => {
                    const next = prev.map(c => c.id === msg.chat_id ? { ...c, last_message: '', updated_at: 0 } : c);
                    _chatsCache.set(view, { data: next, ts: _chatsCache.get(view)?.ts ?? Date.now() });
                    return next;
                });
                return;
            }

            if (msg.type === 'DELETE_CHAT') {
                const next = chatsRef.current.filter(c => c.id !== msg.chat_id);
                _chatsCache.set(view, { data: next, ts: _chatsCache.get(view)?.ts ?? Date.now() });
                setChats(next);
                if (onChatDeletedRef.current) onChatDeletedRef.current(msg.chat_id);
                return;
            }

            if (msg.type === 'NEW_CHAT') {
                _chatsCache.delete(view);
                if (onChatCreatedRef.current) onChatCreatedRef.current();
                return;
            }

            if (msg.type !== 'NEW_MESSAGE') return;

            // Читаем текущие чаты из ref — без side-effect в setChats
            const chatIndex = chatsRef.current.findIndex(c => c.id === msg.chat_id);
            if (chatIndex !== -1) {
                const updated = [...chatsRef.current];
                updated[chatIndex] = {
                    ...updated[chatIndex],
                    last_message: msg.text,
                    sender_id:    msg.sender_id,
                    username:     msg.username,
                    updated_at:   msg.updated_at || Math.floor(Date.now() / 1000),
                };
                const [moved] = updated.splice(chatIndex, 1);
                const next = [moved, ...updated];
                _chatsCache.set(view, { data: next, ts: _chatsCache.get(view)?.ts ?? Date.now() });
                setChats(next);
            } else {
                // Чат не в текущем списке — перезагружаем
                _chatsCache.delete(view);
                fetchChats();
            }
        });
        return () => unsubscribe();
    }, [view]); // только view — callbacks берём через refs

    useEffect(() => {
        if (view === 'friends') fetchFriends();
        else fetchChats();
    }, [refreshTrigger, view]);

    const handleSearchKeyDown = async (e) => {
        if (e.key !== 'Enter' || inputText.trim() === '') return;

        if (view === 'friends') {
            await sendFriendRequest(inputText.trim());
            return;
        }

        const targetUsername = inputText.trim();
        const userId = localStorage.getItem('id');
        const freshToken = localStorage.getItem('jwt_token');
        try {
            const result = await CreateChat(String(userId), targetUsername, freshToken);
            const actualChatId = result.id;
            _chatsCache.delete(view);
            if (onChatCreated) onChatCreated();
            onSelectChat(actualChatId, targetUsername);
            if (onClose) onClose();
            setInputText("");
        } catch (err) {
            console.error("Ошибка:", err);
        }
    };

    const handleSelectChat = (id, name) => {
        onSelectChat(id, name);
        if (window.innerWidth <= 850 && onClose) onClose();
    };

    const handleCreateGroup = async (groupData) => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        try {
            const response = await fetch(`${API_BASE}/createGroup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshToken}`
                },
                body: JSON.stringify({
                    admin_id: String(userId),
                    name: groupData.name,
                    is_private: groupData.is_private,
                    members: groupData.members
                })
            });
            if (response.status === 201) {
                const data = await response.json();
                setShowCreateGroup(false);
                _chatsCache.delete(view);
                if (onChatCreated) onChatCreated();
                fetchChats();
                if (data.id) onSelectChat(data.id, data.name);
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            alert(errorData.error || errorData.message || `Ошибка ${response.status}`);
        } catch (err) {
            console.error("Ошибка создания группы:", err);
            alert('Не удалось создать группу. Проверьте соединение.');
        }
    };

    const getHeaderText = () => {
        if (view === 'groups')  return 'Группы';
        if (view === 'friends') return friendsList.length > 0 ? `Друзья · ${friendsList.length}` : 'Друзья';
        return 'Чаты';
    };

    const getSearchPlaceholder = () => {
        if (view === 'groups')  return 'Найти группу...';
        if (view === 'friends') return 'Найти пользователя...';
        return 'Найти друга...';
    };

    const filteredFriends = inputText.trim()
        ? friendsList.filter(f => (f.username || f.name || '').toLowerCase().includes(inputText.toLowerCase()))
        : friendsList;

    const filteredReqs = inputText.trim()
        ? friendRequests.filter(r => (r.username || r.from_username || '').toLowerCase().includes(inputText.toLowerCase()))
        : friendRequests;

    return (
        <>
        <div className={`chats-menu ${isOpen ? 'open' : ''}`}>
            <div className="search-row">
                <input
                    type="text"
                    placeholder={getSearchPlaceholder()}
                    className={`search-chat${view === 'chats' ? ' only-child' : ''}`}
                    style={view === 'chats' ? { borderRadius: '10px', borderRight: '1px solid var(--border-medium)' } : {}}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                />
                {view === 'groups' && (
                    <button
                        className={`create-group-btn ${showCreateGroup ? 'active' : ''}`}
                        onClick={() => setShowCreateGroup(!showCreateGroup)}
                        title={showCreateGroup ? "Закрыть" : "Создать группу"}
                    >
                        {showCreateGroup ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4L12 12M12 4L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                        )}
                    </button>
                )}
                {view === 'friends' && (
                    <button
                        className="create-group-btn"
                        onClick={() => { if (inputText.trim()) sendFriendRequest(inputText.trim()); }}
                        title="Отправить заявку в друзья"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                    </button>
                )}
            </div>

            <CreateGroupModal
                isOpen={showCreateGroup}
                onClose={() => setShowCreateGroup(false)}
                onCreate={handleCreateGroup}
                currentUserId={localStorage.getItem('id')}
            />

            <div className="chats-header">{getHeaderText()}</div>

            <div className="chats-list">
                {/* ── Friends view ── */}
                {view === 'friends' && (
                    <>
                        {/* Requests with accent border */}
                        {filteredReqs.map((req, i) => {
                            const name   = req.username || req.from_username || '?';
                            const color  = getAvatarColor(name);
                            const letter = getFirstLetter(name);
                            const reqId  = req.id || req.request_id;
                            return (
                                <div className="chat-item friend-req-item" key={reqId || i}>
                                    <div className="avatar" style={{ backgroundColor: color }}>
                                        <span>{letter}</span>
                                    </div>
                                    <div className="chat-content">
                                        <span className="chat-name-text">{name}</span>
                                        <div className="friend-req-actions">
                                            <button className="fr-accept-btn" onClick={() => acceptFriendRequest(reqId)}>Принять</button>
                                            <button className="fr-decline-btn" onClick={() => declineFriendRequest(reqId)}>Отклонить</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Divider only when both sections are non-empty */}
                        {filteredReqs.length > 0 && filteredFriends.length > 0 && !inputText.trim() && (
                            <div className="friends-divider" />
                        )}

                        {/* Friends list */}
                        {filteredFriends.length === 0 && filteredReqs.length === 0 && (
                            <div className="friends-empty-state">
                                <p>{inputText.trim() ? 'Ничего не найдено' : 'Нет друзей'}</p>
                                {!inputText.trim() && <small>Введи имя в строке поиска</small>}
                            </div>
                        )}

                        {filteredFriends.map((friend, i) => {
                            const name   = friend.username || friend.name || '?';
                            const color  = getAvatarColor(name);
                            const letter = getFirstLetter(name);
                            const openChat = async () => {
                                const freshToken = localStorage.getItem('jwt_token');
                                const userId = localStorage.getItem('id');
                                try {
                                    const result = await CreateChat(String(userId), name, freshToken);
                                    const chatId = result.chat_id || result.id;
                                    if (!chatId) return;
                                    // Переключаемся на вкладку чатов и открываем чат
                                    if (onSetViewRef.current) onSetViewRef.current('chats');
                                    _chatsCache.delete('chats');
                                    if (onChatCreatedRef.current) onChatCreatedRef.current();
                                    handleSelectChat(chatId, name);
                                } catch (err) { console.error(err); }
                            };
                            return (
                                <div className="chat-item friend-item" key={friend.id || i} onClick={openChat}>
                                    <div className="avatar" style={{ backgroundColor: color }}>
                                        <span>{letter}</span>
                                    </div>
                                    <div className="chat-content" style={{ flex: 1, minWidth: 0 }}>
                                        <span className="chat-name-text">{name}</span>
                                    </div>
                                    <button
                                        className="friend-chat-btn"
                                        title="Написать сообщение"
                                        onClick={e => { e.stopPropagation(); openChat(); }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </>
                )}

                {/* ── Chats / Groups view ── */}
                {view !== 'friends' && (
                    <>
                        {chats
                            .filter(chat => {
                                if (view === 'groups' && inputText.trim() !== '') {
                                    return chat.name.toLowerCase().includes(inputText.toLowerCase());
                                }
                                return true;
                            })
                            .map((chat) => {
                                const chatColor  = getAvatarColor(chat.name);
                                const chatLetter = getFirstLetter(chat.name);
                                return (
                                    <div
                                        className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                                        key={chat.id}
                                        onClick={() => handleSelectChat(chat.id, chat.name)}
                                        onContextMenu={e => openChatCtx(e, chat.id)}
                                        onTouchStart={e => startLongPress(e, chat.id)}
                                        onTouchMove={moveLongPress}
                                        onTouchEnd={endLongPress}
                                    >
                                        <div className="avatar" style={{ backgroundColor: chatColor }}>
                                            <span>{chatLetter}</span>
                                        </div>
                                        <div className="chat-content">
                                            <div className="chat-row">
                                                <span className="chat-name-text">{chat.name}</span>
                                                {chat.last_message && chat.last_message.trim() !== "" && chat.updated_at > 0 && (
                                                    <span className="chat-time">{formatChatTime(chat.updated_at)}</span>
                                                )}
                                            </div>
                                            <div className="last-message-info">
                                                {chat.last_message && chat.last_message.trim() !== "" ? (
                                                    <>
                                                        <span className="last-message-sender">
                                                            {chat.username === username ? 'Вы: ' : `${chat.username}: `}
                                                        </span>
                                                        <span className="last-message">{chat.last_message}</span>
                                                    </>
                                                ) : (
                                                    <span className="no-messages">Нет сообщений...</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        {chats.length === 0 && (
                            <div style={{ padding: '10px', color: 'var(--txt-secondary)', fontSize: '12px' }}>
                                {view === 'groups' ? 'Группы не найдены' : 'Чаты не найдены'}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>

            {/* Chat item context menu */}
            {chatCtx && (
                <div ref={chatCtxRef} className="chat-item-ctx" style={{ left: chatCtx.x, top: chatCtx.y }}
                    onClick={e => e.stopPropagation()}>
                    <button className="ctx-item" onClick={() => handleClearCtx(chatCtx.id)}>
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        Очистить историю
                    </button>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }}/>
                    <button className="ctx-item ctx-item-danger" onClick={() => handleDeleteCtx(chatCtx.id)}>
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                        Удалить чат
                    </button>
                </div>
            )}

            {/* Confirm dialog */}
            {confirm && (
                <div className="chats-confirm-overlay" onClick={() => setConfirm(null)}>
                    <div className="chats-confirm-modal" onClick={e => e.stopPropagation()}>
                        <p className="chats-confirm-title">{confirm.title}</p>
                        <p className="chats-confirm-body">{confirm.body}</p>
                        <div className="chats-confirm-actions">
                            <button className="chats-confirm-cancel" onClick={() => setConfirm(null)}>Отмена</button>
                            <button className="chats-confirm-ok" onClick={() => { confirm.onOk(); setConfirm(null); }}>{confirm.okLabel}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ChatsMenu;
