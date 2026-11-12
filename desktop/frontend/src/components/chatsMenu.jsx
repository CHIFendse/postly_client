import { useState, useEffect, useRef, useCallback } from 'react';
import './chatsMenu.css';
import CreateGroupModal from './createGroupModal';
import Avatar from './Avatar';
import { Events } from '@wailsio/runtime';
import {
    CreateChat,
    SendFriendRequest,
    AcceptFriendRequest,
    DeclineFriendRequest,
    DeleteFriend,
    CancelFriendRequest,
    DeleteChat,
    ClearChat,
    CreateGroup,
} from '@bindings/client/components/chatsmenu';
import { useInitData } from '../context/InitDataContext';
import { markSelfAction } from '../utils/notifier';
import { applyNewMessageToCache } from './messagesCache';

function ChatsMenu({
    currentUserId,
    onSelectChat,
    activeChatId,
    onChatCreated,
    view,
    isOpen,
    onClose,
    onChatDeleted,
    onSetView,
    getAvatarColor
}) {
    const [inputText, setInputText] = useState('');
    // Данные берём из общего хранилища (/init_client), вкладки не ходят на сервер
    const {
        chats: allChats,
        groups,
        friends,
        friendRequests: reqs,
        sentRequests: sentReqs,
        setChats: setAllChats,
        setGroups,
        setFriends,
        setFriendRequests: setReqs,
        setSentRequests: setSentReqs,
        reload,
        unread,
    } = useInitData();
    const chats = view === 'groups' ? groups : allChats;
    const allChatsRef = useRef(allChats);
    const groupsRef = useRef(groups);
    allChatsRef.current = allChats;
    groupsRef.current = groups;
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [chatCtx, setChatCtx] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const chatCtxRef = useRef(null);
    const longPressTimer = useRef(null);
    const onSetViewRef = useRef(onSetView);
    const onChatCreatedRef = useRef(onChatCreated);
    const usernameRef = useRef(localStorage.getItem('username') || '');

    useEffect(() => { onSetViewRef.current = onSetView; }, [onSetView]);
    useEffect(() => { onChatCreatedRef.current = onChatCreated; }, [onChatCreated]);

    const token = localStorage.getItem('jwt_token');
    const username = localStorage.getItem('username') || '';

    // ── WS: обновление чатов + друзей ──
    useEffect(() => {
        if (!token) return;

        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            switch (msg.type) {
                // ── Друзья ──
                // FRIEND_REQUEST и FRIEND_ACCEPTED обрабатывает useNotifications
                // (обновляет данные и показывает уведомление)
                case 'FRIEND_DECLINED':
                case 'DELETE_FRIEND':
                case 'FRIEND_REQUEST_CANCELED':
                    // друзья, заявки и (при принятии) чаты — один общий запрос
                    reload();
                    break;

                // ── Новое сообщение — обновляем список локально ──
                case 'NEW_MESSAGE': {
                    // 1. Обновляем нужный список (личные чаты или группы) локально
                    const chatId = String(msg.chat_id);
                    const inChats = allChatsRef.current.some(c => String(c.id) === chatId);
                    const inGroups = !inChats && groupsRef.current.some(c => String(c.id) === chatId);

                    const applyMessage = prev => {
                        const idx = prev.findIndex(c => String(c.id) === chatId);
                        if (idx === -1) return prev;
                        const updated = [...prev];
                        updated[idx] = {
                            ...updated[idx],
                            last_message: msg.text
                                || (msg.message_type === 'image' ? 'Фотография'
                                    : msg.message_type === 'file' ? `Файл: ${msg.file_name || ''}`.trim()
                                    : msg.text ?? updated[idx].last_message),
                            username: msg.username || updated[idx].username || '',
                            updated_at: msg.updated_at || Math.floor(Date.now() / 1000),
                        };
                        const [chat] = updated.splice(idx, 1);
                        updated.unshift(chat);
                        return updated;
                    };

                    if (inChats) setAllChats(applyMessage);
                    else if (inGroups) setGroups(applyMessage);
                    else onChatCreatedRef.current?.(); // неизвестный чат — подтянуть список

                    // 2. Обновляем кэш сообщений (чтобы при заходе в чат сразу показать)
                    // Общая с chat.jsx логика: своё сообщение заменяет tmp, а не дублируется
                    applyNewMessageToCache(
                        msg,
                        String(msg.sender_id) === String(localStorage.getItem('id'))
                    );

                    break;
                }

                // ── Очистка истории ──
                case 'CLEAR_CHAT': {
                    const clear = prev => {
                        const idx = prev.findIndex(c => String(c.id) === String(msg.chat_id));
                        if (idx === -1) return prev;
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], last_message: '', updated_at: 0 };
                        return updated;
                    };
                    setAllChats(clear);
                    setGroups(clear);
                    break;
                }

                // ── Удаление сообщения — last_message мог измениться ──
                case 'DELETE_MESSAGE': {
                    const deletedChatId = String(msg.chat_id);
                    const deletedMsgId = String(msg.message_id || msg.id);

                    const updateLastMsgOnDelete = prev => {
                        const idx = prev.findIndex(c => String(c.id) === deletedChatId);
                        if (idx === -1) return prev;

                        // Если это было последнее сообщение в чате — подтягиваем свежие данные
                        // либо сбрасываем локально, чтобы не висел призрак
                        const updated = [...prev];
                        // Если сервер прислал новое последнее сообщение в payload:
                        if (msg.last_message !== undefined) {
                            updated[idx] = {
                                ...updated[idx],
                                last_message: msg.last_message,
                                username: msg.username || '',
                                updated_at: msg.updated_at || updated[idx].updated_at
                            };
                        }
                        return updated;
                    };

                    setAllChats(updateLastMsgOnDelete);
                    setGroups(updateLastMsgOnDelete);

                    // Запрашиваем актуальный список чатов с сервера
                    onChatCreatedRef.current?.();
                    break;
                }

                // ── Новый / удалённый чат ──
                case 'NEW_CHAT':
                case 'DELETE_CHAT': {
                    onChatCreatedRef.current?.();
                    break;
                }

                default:
                    break;
            }
        });
        return () => unsub();
    }, [token, reload, setAllChats, setGroups]);

    // ── Клик по чату ──
    const handleSelectChat = useCallback((chatId, name, userId = '') => {
        onSelectChat?.(chatId, name, userId);
        onClose?.();
    }, [onSelectChat, onClose]);

    // ── Друзья ──
    const acceptFriendRequest = async (reqId) => {
        try {
            markSelfAction('friend_accepted'); // событие FRIEND_ACCEPTED придёт и нам, но мы о нём знаем
            await AcceptFriendRequest(String(reqId), token);
            setReqs(prev => prev.filter(r => r.id !== reqId));
            reload(); // появился друг (и, возможно, чат)
        } catch (e) { console.error(e); }
    };

    const declineFriendRequest = async (reqId) => {
        try {
            await DeclineFriendRequest(String(reqId), token);
            setReqs(prev => prev.filter(r => r.id !== reqId));
        } catch (e) { console.error(e); }
    };

    const sendFriendRequest = async (targetUsername) => {
        try {
            await SendFriendRequest(targetUsername, token);
            reload();
        } catch (e) { console.error(e); }
    };

    const cancelFriendRequest = async (reqId) => {
        try {
            await CancelFriendRequest(String(reqId), token);
            setSentReqs(prev => prev.filter(r => r.id !== reqId));
        } catch (e) { console.error(e); }
    };

    const deleteFriend = async (friendId) => {
        try {
            await DeleteFriend(String(friendId), token);
            setFriends(prev => prev.filter(f => f.id !== friendId));
        } catch (e) { console.error(e); }
    };

    // ── Создание группы ──
    const handleCreateGroup = async (payload) => {
        try {
            const freshToken = localStorage.getItem('jwt_token');
            await CreateGroup(
                payload.name,
                payload.avatar_color || '',
                payload.avatar_file || '',
                freshToken,
                payload.members || [],
                payload.is_private || false
            );
            onChatCreatedRef.current?.();
        } catch (e) {
            console.error('CreateGroup error:', e);
        }
        setShowCreateGroup(false);
    };

    // ── Контекстное меню чата ──
    const openChatCtx = (e, chatId) => {
        e.preventDefault();
        setChatCtx({ x: e.clientX, y: e.clientY, id: chatId });
    };
    const startLongPress = (e, chatId) => {
        const touch = e.touches[0];
        longPressTimer.current = setTimeout(() => {
            setChatCtx({ x: touch.clientX, y: touch.clientY, id: chatId });
        }, 500);
    };
    const moveLongPress = () => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    };
    const endLongPress = () => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    };

    useEffect(() => {
        const close = () => setChatCtx(null);
        if (chatCtx) {
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }
    }, [chatCtx]);

    const handleClearCtx = (chatId) => {
        setConfirm({
            title: 'Очистить историю?',
            body: 'Все сообщения в этом чате будут удалены.',
            okLabel: 'Очистить',
            onOk: async () => {
                try {
                    await ClearChat(String(chatId), token);
                    // WS CLEAR_CHAT придёт — обновит список
                } catch (e) {
                    console.error('ClearChat error:', e);
                }
            },
        });
        setChatCtx(null);
    };

    const handleDeleteCtx = (chatId) => {
        setConfirm({
            title: 'Удалить чат?',
            body: 'Чат и все сообщения будут удалены безвозвратно.',
            okLabel: 'Удалить',
            onOk: async () => {
                try {
                    await DeleteChat(String(chatId), token);
                    onChatDeleted?.(chatId);
                } catch (e) {
                    console.error('DeleteChat error:', e);
                }
            },
        });
        setChatCtx(null);
    };

    // ── Хелперы ──
    const getHeaderText = () => {
        if (view === 'groups') return 'Группы';
        if (view === 'friends') return 'Друзья';
        return 'Чаты';
    };
    const getSearchPlaceholder = () => {
        if (view === 'friends') return 'Найти друга...';
        if (view === 'groups') return 'Найти группу...';
        return 'Найти чат...';
    };
    const formatChatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts * 1000);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' });
    };


    const getFirstLetter = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

    const q = inputText.toLowerCase().trim();
    const filteredReqs = reqs.filter(r => !q || (r.username || '').toLowerCase().includes(q));
    const filteredFriends = friends.filter(f => !q || (f.username || '').toLowerCase().includes(q));
    const filteredSent = sentReqs.filter(r => !q || (r.username || '').toLowerCase().includes(q));

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && view === 'friends' && inputText.trim()) {
            sendFriendRequest(inputText.trim());
            setInputText('');
        }
    };

    return (
        <>
            <div className={`chats-menu ${isOpen ? 'open' : ''}`} id="chats-menu">
                <div className="search-row">
                    <input
                        type="text"
                        className={`search-chat${view === 'chats' ? ' alone' : ''}`}
                        placeholder={getSearchPlaceholder()}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    {view === 'groups' && (
                        <button
                            className="create-group-btn"
                            onClick={() => setShowCreateGroup(!showCreateGroup)}
                            title={showCreateGroup ? 'Закрыть' : 'Создать группу'}
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
                            onClick={() => { if (inputText.trim()) { sendFriendRequest(inputText.trim()); setInputText(''); } }}
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
                    currentUserId={currentUserId}
                />

                <div className="chats-header" id="chats-header">{getHeaderText()}</div>

                <div className="chats-list" id="chats-list">
                    {view === 'friends' && (
                        <>
                            {filteredReqs.map((req) => {
                                const name   = req.username || '?';
                                return (
                                    <div className="chat-item friend-req-item" key={req.id}>
                                        <Avatar userId={req.sender_id} name={name} color={getAvatarColor(name)} />
                                        <div className="chat-content">
                                            <span className="chat-name-text">{name}</span>
                                            <div className="friend-req-actions">
                                                <button className="fr-accept-btn" onClick={() => acceptFriendRequest(req.id)}>Принять</button>
                                                <button className="fr-decline-btn" onClick={() => declineFriendRequest(req.id)}>Отклонить</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredReqs.length > 0 && filteredFriends.length > 0 && !q && (
                                <div className="friends-divider"><span>Друзья</span></div>
                            )}

                            {filteredFriends.length === 0 && filteredReqs.length === 0 && (
                                <div className="friends-empty-state">
                                    <p>{q ? 'Ничего не найдено' : 'Нет друзей'}</p>
                                    {!q && <small>Введи имя в строке поиска</small>}
                                </div>
                            )}

                            {filteredFriends.map((friend) => {
                                const name   = friend.username || '?';
                                const openChat = async () => {
                                    try {
                                        const freshToken = localStorage.getItem('jwt_token');
                                        const userId = localStorage.getItem('id');
                                        const result = await CreateChat(String(userId), name, freshToken);
                                        const chatId = result?.chat_id || result?.id;
                                        if (!chatId) return;
                                        onSetViewRef.current?.('chats');
                                        onChatCreatedRef.current?.();
                                        handleSelectChat(chatId, name, friend.id);
                                    } catch (err) { console.error(err); }
                                };
                                return (
                                    <div className="chat-item friend-item" key={friend.id} onClick={openChat}>
                                        <Avatar userId={friend.id} name={name} color={getAvatarColor(name)} />
                                        <div className="chat-content">
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
                                        <button
                                            className="friend-delete-btn"
                                            title="Удалить из друзей"
                                            onClick={e => { e.stopPropagation(); deleteFriend(friend.id); }}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {view !== 'friends' && (
                        <>
                            {chats
                                .filter(chat => !q || (chat.name || '').toLowerCase().includes(q))
                                .map((chat) => {
                                    return (
                                        <div
                                            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                                            key={chat.id}
                                            onClick={() => handleSelectChat(chat.id, chat.name, chat.user_id)}
                                            onContextMenu={e => {
                                                e.stopPropagation();
                                                openChatCtx(e, chat.id);
                                            }}
                                            onTouchStart={e => startLongPress(e, chat.id)}
                                            onTouchMove={moveLongPress}
                                            onTouchEnd={endLongPress}
                                        >
                                            <Avatar userId={chat.user_id} name={chat.name} color={getAvatarColor(chat.name)} />
                                            <div className="chat-content">
                                                <div className="chat-row">
                                                    <span className="chat-name-text">{chat.name}</span>
                                                    {chat.last_message && chat.last_message.trim() !== '' && chat.updated_at > 0 && (
                                                        <span className="chat-time">{formatChatTime(chat.updated_at)}</span>
                                                    )}
                                                </div>
                                                <div className="last-message-info">
                                                    {chat.last_message && chat.last_message.trim() !== '' ? (
                                                        <>
                                                            <span className="last-message-sender">
                                                                {chat.username === username ? 'Вы: ' : `${chat.username}: `}
                                                            </span>
                                                            <span className="last-message">{chat.last_message}</span>
                                                        </>
                                                    ) : (
                                                        <span className="no-messages">Нет сообщений...</span>
                                                    )}
                                                    {unread[chat.id] > 0 && (
                                                        <span className="chat-unread">
                                                            {unread[chat.id] > 99 ? '99+' : unread[chat.id]}
                                                        </span>
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

            {chatCtx && (
                <div
                    ref={chatCtxRef}
                    className="chat-item-ctx"
                    style={{ left: chatCtx.x, top: chatCtx.y }}
                    onClick={e => e.stopPropagation()}
                >
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