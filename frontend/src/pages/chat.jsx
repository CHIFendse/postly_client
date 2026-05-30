import './chat.css';
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { GetMessages } from '@bindings/client/pages/chat';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import { Events } from '@wailsio/runtime';

// Module-level messages cache: chatId → { data: [], ts: 0 }
const _msgsCache = new Map();
const MSGS_TTL = 30_000;

export function clearMessagesCache() { _msgsCache.clear(); }

const API_BASE = 'https://api.postly-mes.ru:8081';

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
    let remaining = text;
    let lastIdx = 0;
    const q = query.toLowerCase();
    let searchFrom = 0;
    while (true) {
        const idx = text.toLowerCase().indexOf(q, searchFrom);
        if (idx === -1) { parts.push(text.slice(searchFrom)); break; }
        if (idx > searchFrom) parts.push(text.slice(searchFrom, idx));
        parts.push(<mark key={idx} className={active ? 'msg-search-mark-active' : 'msg-search-mark'}>{text.slice(idx, idx + q.length)}</mark>);
        searchFrom = idx + q.length;
    }
    return <>{parts}</>;
}

function Chat({ chatId, searchQuery = '', searchNavIdx = 0, onMatchesFound }) {
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
    const msgRefs        = useRef({});  // id → DOM element

    const isMine = id => String(id) === String(myId);

    // ── Reset on chat change ──
    useEffect(() => {
        setMessages([]); setTypingUser(null); setCtxMenu(null);
        clearTimeout(typingClearRef.current);
        setIsLoading(true);
        isInitialMount.current = true;
        msgRefs.current = {};
    }, [chatId]);

    // ── Load history ──
    useEffect(() => {
        if (!chatId) return;
        const tok = localStorage.getItem('jwt_token');
        const hit = _msgsCache.get(chatId);

        // Show cached immediately — no blank flash
        if (hit) {
            setMessages(hit.data);
            setIsLoading(false);
            if (Date.now() - hit.ts < MSGS_TTL) return; // still fresh
        }

        GetMessages(chatId, tok)
            .then(r => {
                const fresh = r || [];
                _msgsCache.set(chatId, { data: fresh, ts: Date.now() });
                setMessages(fresh);
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, [chatId]);

    // ── WS events ──
    useEffect(() => {
        if (!chatId) return;
        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            if (msg.type === 'TYPING') {
                if (String(msg.chat_id) !== String(chatId) || isMine(msg.sender_id)) return;
                setTypingUser(msg.username);
                clearTimeout(typingClearRef.current);
                typingClearRef.current = setTimeout(() => setTypingUser(null), 3500);
                return;
            }

            if (msg.type === 'DELETE_MESSAGE') {
                if (String(msg.chat_id) !== String(chatId)) return;
                const mid = msg.message_id || msg.id;
                if (!mid) return;
                setMessages(prev => {
                    const next = prev.filter(m => String(m.id) !== String(mid));
                    _msgsCache.set(chatId, { data: next, ts: Date.now() });
                    return next;
                });
                return;
            }

            if (msg.type === 'CLEAR_CHAT') {
                if (String(msg.chat_id) !== String(chatId)) return;
                _msgsCache.set(chatId, { data: [], ts: Date.now() });
                setMessages([]);
                return;
            }

            if (msg.type !== 'NEW_MESSAGE') return;
            if (String(msg.chat_id) !== String(chatId)) return;

            if (isMine(msg.sender_id)) {
                if (msg.id) {
                    setMessages(prev => {
                        const idx = prev.findIndex(m => String(m.id || '').startsWith('tmp_'));
                        if (idx === -1) return prev;
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], id: msg.id };
                        _msgsCache.set(chatId, { data: updated, ts: Date.now() });
                        return updated;
                    });
                }
                return;
            }

            setTypingUser(null);
            clearTimeout(typingClearRef.current);

            setMessages(prev => {
                if (msg.id && prev.some(m => String(m.id) === String(msg.id))) return prev;
                const next = [...prev, { ...msg, created_at: msg.created_at || new Date().toISOString() }];
                _msgsCache.set(chatId, { data: next, ts: Date.now() });
                return next;
            });
        });
        return () => unsub();
    }, [chatId]);

    // ── Scroll to bottom ──
    useLayoutEffect(() => {
        if (messages.length > 0 && messagesEndRef.current && !searchQuery) {
            messagesEndRef.current.scrollIntoView({ behavior: isInitialMount.current ? 'auto' : 'smooth' });
            isInitialMount.current = false;
        }
    }, [messages]);

    // ── Search: find matching messages, report count ──
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

    // ── Search: scroll to current match when idx changes ──
    useEffect(() => {
        if (!searchQuery || !matchIndices.current.length) return;
        const safeIdx = searchNavIdx % matchIndices.current.length;
        const msgIdx = matchIndices.current[safeIdx];
        const msg = messages[msgIdx];
        if (!msg) return;
        const el = msgRefs.current[msg.id || msgIdx];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchNavIdx, searchQuery]);

    // ── Close ctx menu on outside click (suppress synthesized click after long-press) ──
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
            if (!chatId) return;
            try { await SendWSMessage(JSON.stringify({ type: 'TYPING', chat_id: chatId, sender_id: myId, username })); } catch {}
        }, 400);
    }, [chatId]);

    // ── Send message ──
    const handleSend = async e => {
        if (e.key !== 'Enter' || !inputText.trim()) return;
        const text = inputText.trim();
        const tempId = `tmp_${Date.now()}`;
        clearTimeout(typingSendRef.current);
        setMessages(prev => [...prev, { id: tempId, chat_id: chatId, sender_id: myId, username, text, created_at: new Date().toISOString() }]);
        setInputText('');
        try { await SendWSMessage(JSON.stringify({ chat_id: chatId, sender_id: myId, text, username })); }
        catch (err) { console.error(err); }
    };

    // ── Context menu ──
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
            const r = await fetch(`${API_BASE}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                body: JSON.stringify({ message_id: id, user_id: myId, chat_id: chatId }),
            });
            if (r.ok) setMessages(prev => prev.filter(m => String(m.id) !== String(id)));
        } catch (err) { console.error(err); }
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

            {typingUser && (
                <div className="typing-indicator">
                    <span className="typing-name">{typingUser}</span>
                    <span className="typing-dots"><span/><span/><span/></span>
                </div>
            )}

            <div className="chat-input-container">
                <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    className="chat-input"
                    value={inputText}
                    onChange={e => { setInputText(e.target.value); handleTyping(); }}
                    onKeyDown={handleSend}
                />
            </div>

            {/* Context menu — фиксированное, рендерится внутри компонента */}
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
