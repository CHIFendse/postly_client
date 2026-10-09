import { useCallback, useEffect, useRef, useState } from 'react';
import { GetMessages } from '@bindings/client/pages/chat';
import { SetToken } from '@bindings/client/pages/chatws';
import { Events } from '@wailsio/runtime';
import {
    _msgsCache,
    MSGS_TTL,
    applyNewMessage,
    applyNewMessageToCache
} from '../../../components/messagesCache';
import { isMine } from '../lib/messages';

const TYPING_HIDE_MS = 3500;

// Сообщения открытого чата: загрузка с кэшем и события с сервера по WS.
// Ключ кэша — всегда строка: chatId приходит то строкой (из localStorage),
// то числом (из списка чатов), а события WS кладутся по String(chat_id)
export default function useChatMessages(chatId, token, onMessageSent) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const typingClearRef = useRef(null);

    const chatIdRef = useRef(chatId);
    chatIdRef.current = chatId;
    // Родитель передаёт колбэк инлайном — подписку на WS из-за него не пересоздаём
    const onMessageSentRef = useRef(onMessageSent);
    onMessageSentRef.current = onMessageSent;

    const hideTyping = () => {
        clearTimeout(typingClearRef.current);
        setTypingUser(null);
    };

    // Меняет сообщения чата и в кэше, и на экране (если чат сейчас открыт).
    // fn — чистая функция от списка
    const updateMessages = useCallback((targetChatId, fn) => {
        const key = String(targetChatId);
        const cached = _msgsCache.get(key);
        if (cached) _msgsCache.set(key, { data: fn(cached.data), ts: cached.ts });
        if (key !== String(chatIdRef.current)) return;
        setMessages(prev => {
            const next = fn(prev);
            // Загрузка не удалась и кэша нет — заводим, чтобы локальные
            // сообщения пережили смену чата; ts: 0 — при открытии перезапросим
            if (!cached) _msgsCache.set(key, { data: next, ts: 0 });
            return next;
        });
    }, []);

    useEffect(() => {
        hideTyping();
        if (!chatId) {
            setMessages([]);
            setIsLoading(false);
            return undefined;
        }

        const key = String(chatId);
        const tok = token || localStorage.getItem('jwt_token');
        if (tok) SetToken(tok).catch(err => console.error('SetToken error:', err));

        const hit = _msgsCache.get(key);
        setMessages(hit ? hit.data : []);
        setIsLoading(!hit);
        if (hit && Date.now() - hit.ts < MSGS_TTL) return undefined;

        let isCancelled = false;
        GetMessages(chatId, tok)
            .then(r => {
                if (isCancelled) return;
                const fresh = r || [];
                _msgsCache.set(key, { data: fresh, ts: Date.now() });
                setMessages(fresh);
            })
            .catch(err => {
                if (!isCancelled) console.error('GetMessages error:', err);
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => { isCancelled = true; };
    }, [chatId, token]);

    useEffect(() => {
        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            const msgChatId = String(msg.chat_id);
            const isActive = msgChatId === String(chatIdRef.current);

            switch (msg.type) {
                case 'TYPING':
                    if (!isActive || isMine(msg.sender_id)) return;
                    setTypingUser(msg.username);
                    clearTimeout(typingClearRef.current);
                    typingClearRef.current = setTimeout(() => setTypingUser(null), TYPING_HIDE_MS);
                    return;

                case 'DELETE_MESSAGE': {
                    const mid = msg.message_id || msg.id;
                    if (mid) updateMessages(msgChatId, list => list.filter(m => String(m.id) !== String(mid)));
                    return;
                }

                case 'CLEAR_CHAT':
                    _msgsCache.set(msgChatId, { data: [], ts: Date.now() });
                    if (isActive) setMessages([]);
                    return;

                case 'NEW_CHAT':
                case 'DELETE_CHAT':
                case 'FRIEND_REQUEST':
                    onMessageSentRef.current?.(msg);
                    return;

                case 'NEW_MESSAGE': {
                    // Общая с chatsMenu.jsx идемпотентная логика — второй вызов на то же
                    // событие ничего не меняет, поэтому дублей в кэше не бывает
                    const mine = isMine(msg.sender_id);
                    applyNewMessageToCache(msg, mine);
                    if (!isActive) return;
                    hideTyping();
                    setMessages(prev => applyNewMessage(prev, msg, mine));
                    if (mine) onMessageSentRef.current?.(msg);
                    return;
                }

                default:
            }
        });

        return () => {
            unsub();
            clearTimeout(typingClearRef.current);
        };
    }, [updateMessages]);

    return { messages, isLoading, typingUser, updateMessages };
}
