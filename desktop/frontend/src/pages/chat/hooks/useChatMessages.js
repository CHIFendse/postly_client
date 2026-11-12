import { useCallback, useEffect, useRef, useState } from 'react';
import { GetMessages, GetMoreMessages } from '@bindings/client/pages/chat';
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

export default function useChatMessages(chatId, token, onMessageSent) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [typingUser, setTypingUser] = useState(null);

    const typingClearRef = useRef(null);
    const chatIdRef = useRef(chatId);
    chatIdRef.current = chatId;

    const onMessageSentRef = useRef(onMessageSent);
    onMessageSentRef.current = onMessageSent;

    const isLoadingMoreRef = useRef(false);
    const hasMoreRef = useRef(true);
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const hideTyping = () => {
        clearTimeout(typingClearRef.current);
        setTypingUser(null);
    };

    const updateMessages = useCallback((targetChatId, fn) => {
        const key = String(targetChatId);
        const cached = _msgsCache.get(key);
        if (cached) {
            _msgsCache.set(key, { data: fn(cached.data), ts: cached.ts });
        }
        if (key !== String(chatIdRef.current)) return;
        setMessages(prev => {
            const next = fn(prev);
            if (!cached) {
                _msgsCache.set(key, { data: next, ts: 0 });
            }
            return next;
        });
    }, []);

    const loadMoreMessages = useCallback(async () => {
        const currentChatId = chatIdRef.current;
        if (!currentChatId || isLoadingMoreRef.current || !hasMoreRef.current) return;

        const currentList = messagesRef.current;
        if (!currentList || currentList.length === 0) return;

        const oldestMsg = currentList[currentList.length - 1];
        if (!oldestMsg) return;

        const msgId = String(oldestMsg.id || oldestMsg.Id || '');
        const createdAt = Number(oldestMsg.created_at || oldestMsg.createdAt || 0);

        if (!msgId || createdAt === 0 || isNaN(createdAt)) {
            console.warn('Пропущен вызов пагинации: некорректный опорный элемент', oldestMsg);
            return;
        }

        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);

        const tok = localStorage.getItem('jwt_token') || token;

        try {
            const olderBatch = await GetMoreMessages(currentChatId, tok, msgId, createdAt);
            if (!olderBatch || olderBatch.length === 0) {
                hasMoreRef.current = false;
                setHasMore(false);
                return;
            }
            updateMessages(currentChatId, prev => [...prev, ...olderBatch]);
        } catch (err) {
            console.error('GetMoreMessages error:', err);
        } finally {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    }, [token, updateMessages]);

    // Инициализация и загрузка истории строго при смене chatId
    useEffect(() => {
        hideTyping();
        hasMoreRef.current = true;
        setHasMore(true);
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);

        if (!chatId) {
            setMessages([]);
            setIsLoading(false);
            return undefined;
        }

        const key = String(chatId);
        const tok = localStorage.getItem('jwt_token') || token;
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

        return () => {
            isCancelled = true;
        };
    }, [chatId]);

    // Обработка WebSocket-событий
    useEffect(() => {
        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            const msgChatId = String(msg.chat_id || '');
            const isActive = msgChatId === String(chatIdRef.current);

            switch (msg.type) {
                case 'TYPING':
                    if (!isActive || isMine(msg.sender_id)) return;
                    setTypingUser(msg.username);
                    clearTimeout(typingClearRef.current);
                    typingClearRef.current = setTimeout(() => setTypingUser(null), TYPING_HIDE_MS);
                    return;

                case 'DELETE_MESSAGE': {
                    const mid = String(msg.message_id || msg.id || '');
                    if (!mid) return;
                    // Проверяем оба регистра ключа id
                    updateMessages(msgChatId, list =>
                        (list || []).filter(m => String(m.id || m.Id || '') !== mid)
                    );
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

    return {
        messages,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMoreMessages,
        typingUser,
        updateMessages
    };
}