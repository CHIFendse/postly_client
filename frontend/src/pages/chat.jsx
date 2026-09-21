import './chat.css';
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { GetMessages, DeleteMessage } from '@bindings/client/pages/chat';
import { SendWSMessage, Connect, SetToken } from '@bindings/client/pages/chatws';
import { Events } from '@wailsio/runtime';
import { _msgsCache, MSGS_TTL, clearMessagesCache } from '../components/messagesCache';


function getDateLabel(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const dDay = new Date(d); dDay.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((today - dDay) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    if (diff === 2) return 'Позавчера';
    const opts = d.getFullYear() === new Date().getFullYear()
        ? { day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('ru-RU', opts);
}

function HighlightText({ text, query, active }) {
    if (!query || !text) return <>{text}</>;
    const parts = [];
    const q = query.toLowerCase();
    let searchFrom = 0;
    while (true) {
        const idx = text.toLowerCase().indexOf(q, searchFrom);
        if (idx === -1) { parts.push(text.slice(searchFrom)); break; }
        if (idx > searchFrom) parts.push(text.slice(searchFrom, idx));
        parts.push(
            <mark key={idx} className={active ? 'msg-search-mark-active' : 'msg-search-mark'}>
                {text.slice(idx, idx + q.length)}
            </mark>
        );
        searchFrom = idx + q.length;
    }
    return <>{parts}</>;
}

function Chat({ chatId, searchQuery = '', searchNavIdx = 0, onMatchesFound, onMessageSent }) {
    const myId     = localStorage.getItem('id');
    const username = localStorage.getItem('username');
    const [messages,  setMessages]  = useState([]);
    const [inputText, setInputText] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [ctxMenu,   setCtxMenu]   = useState(null);
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);
    const typingClearRef = useRef(null);
    const typingSendRef  = useRef(null);
    const longPressRef   = useRef(null);
    const suppressClickRef = useRef(false);
    const msgRefs        = useRef({});

    // ── ref на актуальный chatId, чтобы не пересоздавать WS-подписку ──
    const chatIdRef = useRef(chatId);
    useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

    const isMine = id => String(id) === String(myId);

    // ── Сброс временных состояний при смене чата ──
    useEffect(() => {
        setMessages([]);
        setTypingUser(null);
        setCtxMenu(null);
        clearTimeout(typingClearRef.current);
        setIsLoading(true);
        isInitialMount.current = true;
        msgRefs.current = {};
    }, [chatId]);

    // ── Загрузка истории для активного чата ──
    useEffect(() => {
        if (!chatId) return;
        let isCancelled = false;
        const tok = localStorage.getItem('jwt_token');

        if (tok) {
            SetToken(tok).catch(err => console.error('SetToken error:', err));
        }

        const hit = _msgsCache.get(chatId);
        if (hit) {
            setMessages(hit.data);
            setIsLoading(false);
            if (Date.now() - hit.ts < MSGS_TTL) return; // свежий — не перезапрашиваем
        }

        GetMessages(chatId, tok)
            .then(r => {
                if (isCancelled) return;
                const fresh = r || [];
                _msgsCache.set(chatId, { data: fresh, ts: Date.now() });
                setMessages(fresh);
            })
            .catch(err => { if (!isCancelled) console.error(err); })
            .finally(() => { if (!isCancelled) setIsLoading(false); });

        return () => { isCancelled = true; };
    }, [chatId]);

    // ── WS: единственная подписка (не пересоздаётся при смене чата) ──
    useEffect(() => {
        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            const msgChatId = String(msg.chat_id);
            const isActive  = msgChatId === String(chatIdRef.current);

            // ── TYPING — только для активного чата ──
            if (msg.type === 'TYPING') {
                if (!isActive || isMine(msg.sender_id)) return;
                setTypingUser(msg.username);
                clearTimeout(typingClearRef.current);
                typingClearRef.current = setTimeout(() => setTypingUser(null), 3500);
                return;
            }

            // ── DELETE_MESSAGE — обновляем кэш всегда, UI только для активного ──
            if (msg.type === 'DELETE_MESSAGE') {
                const mid = msg.message_id || msg.id;
                if (!mid) return;

                const cached = _msgsCache.get(msgChatId);
                if (cached) {
                    cached.data = cached.data.filter(m => String(m.id) !== String(mid));
                    cached.ts = Date.now();
                }

                if (!isActive) return;
                setMessages(prev => prev.filter(m => String(m.id) !== String(mid)));
                return;
            }

            // ── CLEAR_CHAT — обновляем кэш всегда, UI только для активного ──
            if (msg.type === 'CLEAR_CHAT') {
                _msgsCache.set(msgChatId, { data: [], ts: Date.now() });
                if (!isActive) return;
                setMessages([]);
                return;
            }

            // ── Служебные события для родителя ──
            if (msg.type === 'NEW_CHAT' || msg.type === 'DELETE_CHAT' || msg.type === 'FRIEND_REQUEST') {
                onMessageSent?.(msg);
                return;
            }

            if (msg.type !== 'NEW_MESSAGE') return;

            const msgId = msg.id || msg.msg_id;

            // ── 1. Обновляем кэш для ЛЮБОГО чата (не только активного) ──
            const cached = _msgsCache.get(msgChatId);
            if (cached) {
                const exists = msgId && cached.data.some(m => String(m.id) === String(msgId));

                if (isMine(msg.sender_id)) {
                    // Моё сообщение — заменяем tmp_ на реальный id
                    if (msgId) {
                        const tmpIdx = cached.data.findIndex(m => String(m.id || '').startsWith('tmp_'));
                        if (tmpIdx !== -1) {
                            const updated = [...cached.data];
                            updated[tmpIdx] = { ...updated[tmpIdx], id: msgId, created_at: msg.created_at || updated[tmpIdx].created_at };
                            _msgsCache.set(msgChatId, { data: updated, ts: Date.now() });
                        } else if (!exists) {
                            _msgsCache.set(msgChatId, {
                                data: [...cached.data, { ...msg, id: msgId, created_at: msg.created_at || new Date().toISOString() }],
                                ts: Date.now(),
                            });
                        }
                    }
                } else if (!exists) {
                    // Чужое сообщение — добавляем
                    _msgsCache.set(msgChatId, {
                        data: [...cached.data, { ...msg, id: msgId, created_at: msg.created_at || new Date().toISOString() }],
                        ts: Date.now(),
                    });
                }
            }

            // ── 2. Если это НЕ активный чат — UI не трогаем ──
            if (!isActive) return;

            // ── 3. Обновляем UI активного чата ──
            if (isMine(msg.sender_id)) {
                setMessages(prev => {
                    if (msgId && prev.some(m => String(m.id) === String(msgId))) return prev;
                    const tmpIdx = [...prev].reverse().findIndex(
                        m => String(m.id || '').startsWith('tmp_') && m.text === msg.text
                    );
                    if (tmpIdx !== -1) {
                        const realIdx = prev.length - 1 - tmpIdx;
                        const updated = [...prev];
                        updated[realIdx] = { ...updated[realIdx], id: msgId, created_at: msg.created_at || updated[realIdx].created_at };
                        return updated;
                    }
                    return [...prev, { ...msg, id: msgId, created_at: msg.created_at || new Date().toISOString() }];
                });
                setTypingUser(null);
                clearTimeout(typingClearRef.current);
                onMessageSent?.(msg);
                return;
            }

            setTypingUser(null);
            clearTimeout(typingClearRef.current);

            setMessages(prev => {
                if (msgId && prev.some(m => String(m.id) === String(msgId))) return prev;
                return [...prev, { ...msg, id: msgId, created_at: msg.created_at || new Date().toISOString() }];
            });
        });

        return () => unsub();
    }, []);   // ← пустой массив зависимостей — подписка одна на весь жизненный цикл

    // ── Скролл вниз ──
    useLayoutEffect(() => {
        if (messages.length > 0 && messagesEndRef.current && !searchQuery) {
            messagesEndRef.current.scrollIntoView({ behavior: isInitialMount.current ? 'auto' : 'smooth' });
            isInitialMount.current = false;
        }
    }, [messages]);

    // ── Поиск: найти совпадения ──
    const matchIndices = useRef([]);
    useEffect(() => {
        if (!searchQuery) {
            matchIndices.current = [];
            if (onMatchesFound) onMatchesFound(0);
            return;
        }
        const q = searchQuery.toLowerCase();
        const indices = messages
            .map((m, i) => m.text?.toLowerCase().includes(q) ? i : -1)
            .filter(i => i !== -1);
        matchIndices.current = indices;
        if (onMatchesFound) onMatchesFound(indices.length);
    }, [searchQuery, messages]);

    // ── Поиск: скролл к текущему совпадению ──
    useEffect(() => {
        if (!searchQuery || !matchIndices.current.length) return;
        const safeIdx = searchNavIdx % matchIndices.current.length;
        const msgIdx = matchIndices.current[safeIdx];
        const msg = messages[msgIdx];
        if (!msg) return;
        const el = msgRefs.current[msg.id || msgIdx];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchNavIdx, searchQuery]);

    // ── Закрытие ctx по клику вне ──
    useEffect(() => {
        const h = () => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            setCtxMenu(null);
        };
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    // ── Typing ──
    const handleTyping = useCallback(() => {
        clearTimeout(typingSendRef.current);
        typingSendRef.current = setTimeout(async () => {
            if (!chatIdRef.current) return;
            await SendWSMessage(JSON.stringify({
                type: 'TYPING', chat_id: chatIdRef.current, sender_id: myId, username,
            }));
        }, 400);
    }, [myId, username]);

    // ── Отправка ──
    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || !chatId) return;

        const tempId = `tmp_${Date.now()}`;
        const nowIso = new Date().toISOString();
        clearTimeout(typingSendRef.current);

        setMessages(prev => {
            const next = [...prev, { id: tempId, chat_id: chatId, sender_id: myId, username, text, created_at: nowIso }];
            _msgsCache.set(chatId, { data: next, ts: Date.now() });
            return next;
        });
        setInputText('');

        const err = await SendWSMessage(JSON.stringify({
            type: 'NEW_MESSAGE',
            chat_id: chatId,
            sender_id: myId,
            text,
            username,
        }));

        if (err) {
            setMessages(prev => {
                const next = prev.filter(m => m.id !== tempId);
                _msgsCache.set(chatId, { data: next, ts: Date.now() });
                return next;
            });
            console.error('Ошибка отправки сообщения:', err);
        }
    };

    const handleKeyDown = e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Контекстное меню ──
    const showCtxMenu = (e, msg) => {
        e.preventDefault(); e.stopPropagation();
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const mine = isMine(msg.sender_id);
        const mh = mine ? 88 : 50;
        setCtxMenu({
            x: Math.min(x, window.innerWidth - 178),
            y: y + mh > window.innerHeight ? y - mh : y + 4,
            msgId: msg.id,
            isMine: mine,
            text: msg.text || '',
        });
    };

    const handleLongPressStart = (e, msg) => {
        const t = e.touches[0];
        const startX = t.clientX, startY = t.clientY;
        longPressRef.current = {
            timer: setTimeout(() => {
                navigator.vibrate?.(40);
                suppressClickRef.current = true;
                showCtxMenu({ clientX: startX, clientY: startY, preventDefault(){}, stopPropagation(){} }, msg);
                longPressRef.current = null;
            }, 400),
            startX, startY,
        };
    };

    const handleLongPressMove = e => {
        if (!longPressRef.current) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - longPressRef.current.startX) > 12 ||
            Math.abs(t.clientY - longPressRef.current.startY) > 12) {
            clearTimeout(longPressRef.current.timer);
            longPressRef.current = null;
        }
    };

    const handleLongPressEnd = () => {
        if (longPressRef.current) { clearTimeout(longPressRef.current.timer); longPressRef.current = null; }
    };

    const handleCopy = () => {
        if (ctxMenu?.text) navigator.clipboard?.writeText(ctxMenu.text).catch(() => {});
        setCtxMenu(null);
    };

    const handleDeleteMsg = async () => {
        const id = ctxMenu?.msgId;
        setCtxMenu(null);
        if (!id || String(id).startsWith('tmp_')) return;

        const tok = localStorage.getItem('jwt_token');
        try {
            await DeleteMessage(String(id), tok);
            setMessages(prev => {
                const next = prev.filter(m => String(m.id) !== String(id));
                _msgsCache.set(chatId, { data: next, ts: Date.now() });
                return next;
            });
        } catch (err) {
            console.error('deleteMessage error:', err);
        }
    };

    if (!chatId) return (
        <div className="chat-placeholder">
            <div className="placeholder-content"><p>Выберите чат</p></div>
        </div>
    );

    const currentMatchMsgIdx = searchQuery && matchIndices.current.length
        ? matchIndices.current[searchNavIdx % matchIndices.current.length]
        : -1;

    return (
        <div className="chat-window" onClick={() => setCtxMenu(null)}>
            <div className="messages-list">
                <div className="messages-spacer"/>

                {isLoading && (
                    <div className="chat-loading"><div className="spinner"/><p>Загрузка...</p></div>
                )}
                {!isLoading && messages.length === 0 && (
                    <div className="no-messages-empty">Сообщений пока нет...</div>
                )}

                {(() => {
                    const result = [];
                    let lastLabel = null;
                    messages.forEach((msg, i) => {
                        const label = getDateLabel(msg.created_at);
                        if (label && label !== lastLabel) {
                            lastLabel = label;
                            result.push(
                                <div key={`sep-${i}`} className="date-separator"><span>{label}</span></div>
                            );
                        }
                        const timeStr = msg.created_at
                            ? new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
                            : '';
                        const mine = isMine(msg.sender_id);
                        const isMatch = searchQuery && matchIndices.current.includes(i);
                        const isActive = isMatch && i === currentMatchMsgIdx;

                        result.push(
                            <div
                                key={msg.id || i}
                                ref={el => { msgRefs.current[msg.id || i] = el; }}
                                className={`message-bubble ${mine ? 'sent' : 'received'}${isActive ? ' msg-search-active' : isMatch ? ' msg-search-match' : ''}`}
                                onContextMenu={e => showCtxMenu(e, msg)}
                                onTouchStart={e => handleLongPressStart(e, msg)}
                                onTouchMove={handleLongPressMove}
                                onTouchEnd={handleLongPressEnd}
                                onClick={e => e.stopPropagation()}
                            >
                                {!mine && <div className="message-sender">{msg.username}</div>}
                                <div className="message-text">
                                    <HighlightText text={msg.text || ''} query={searchQuery} active={isActive} />
                                </div>
                                {timeStr && <div className="message-time">{timeStr}</div>}
                            </div>
                        );
                    });
                    return result;
                })()}

                <div ref={messagesEndRef} style={{ height: '1px' }}/>
            </div>
            

            <div className="chat-input-container">
                <div className={`typing-indicator ${typingUser ? '' : 'hidden'}`} id="typing-indicator">
                    <div className="typing-dots"><span></span><span></span><span></span></div>
                    <span className="typing-name" id="typing-text">
                        {typingUser ? `${typingUser} печатает` : ''}
                    </span>
                </div>
                <div className="chat-input-wrapper">
                    <input
                        type="text"
                        placeholder="Напишите сообщение..."
                        className="chat-input"
                        value={inputText}
                        onChange={e => {
                            setInputText(e.target.value);
                            handleTyping();
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="chat-send-btn" onClick={handleSend} type="button">
                        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                            <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>

            {ctxMenu && (
                <div
                    className="msg-ctx-menu"
                    style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="ctx-item" onClick={handleCopy}>
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2"/></svg>
                        Копировать текст
                    </button>
                    {ctxMenu.isMine && (
                        <button className="ctx-item ctx-item-danger" onClick={handleDeleteMsg}>
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            Удалить сообщение
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Chat;