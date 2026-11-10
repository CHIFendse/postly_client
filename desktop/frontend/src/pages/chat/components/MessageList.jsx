import './MessageList.css';
import { useEffect, useMemo, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { getDateLabel, isMine } from '../lib/messages';

const STICK_TO_BOTTOM_PX = 120;
const NO_MATCHES = [];

export default function MessageList({
    chatId,
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    onLoadMore,
    searchQuery,
    searchNavIdx,
    onMatchesFound,
    bubbleHandlers
}) {
    const listRef = useRef(null);
    const triggerRef = useRef(null); 
    const msgRefs = useRef({});
    const stickToBottomRef = useRef(true);

    const onLoadMoreRef = useRef(onLoadMore);
    onLoadMoreRef.current = onLoadMore;

    // ---- Intersection Observer для подгрузки истории ----
    useEffect(() => {
        const triggerEl = triggerRef.current;
        const listEl = listRef.current;

        if (!triggerEl || !listEl || isLoading || isLoadingMore || !hasMore || messages.length === 0) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting) {
                    onLoadMoreRef.current?.();
                }
            },
            {
                root: listEl,
                rootMargin: '350px 0px 0px 0px',
                threshold: 0,
            }
        );

        observer.observe(triggerEl);

        return () => {
            observer.disconnect();
        };
    }, [isLoading, isLoadingMore, hasMore, messages.length]);
    
    // ---- Поиск ----  
    const matchIndices = useMemo(() => {
        if (!searchQuery) return NO_MATCHES;
        const q = searchQuery.toLowerCase();
        const indices = [];
        messages.forEach((m, i) => {
            if (m.text?.toLowerCase().includes(q)) indices.push(i);
        });
        return indices;
    }, [searchQuery, messages]);

    const matchSet = useMemo(() => new Set(matchIndices), [matchIndices]);
    const activeMatchIdx = matchIndices.length
        ? matchIndices[searchNavIdx % matchIndices.length]
        : -1;

    const onMatchesFoundRef = useRef(onMatchesFound);
    onMatchesFoundRef.current = onMatchesFound;

    useEffect(() => {
        onMatchesFoundRef.current?.(matchIndices.length);
    }, [matchIndices]);

    const activeMsg = messages[activeMatchIdx];
    const activeKey = activeMsg ? (activeMsg.id || activeMatchIdx) : null;

    useEffect(() => {
        if (activeKey == null) return;
        msgRefs.current[activeKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [activeKey, searchNavIdx]);

    const handleScroll = () => {
        const list = listRef.current;
        if (!list) return;
        // В column-reverse 0 — это физический низ (самые свежие сообщения)
        stickToBottomRef.current = Math.abs(list.scrollTop) < STICK_TO_BOTTOM_PX;
    };
    
    // При смене чата сбрасываем вьюпорт на самые свежие сообщения
    useEffect(() => {
        msgRefs.current = {};
        stickToBottomRef.current = true;
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [chatId]);

    // Следим за новыми сообщениями (только когда меняется самое свежее messages[0])
    const latestMsgIdRef = useRef(messages[0]?.id);

    useEffect(() => {
        if (!messages.length || searchQuery) return;

        const currentLatest = messages[0];
        const prevLatestId = latestMsgIdRef.current;
        latestMsgIdRef.current = currentLatest?.id;

        // Если messages[0] не изменился — значит, добавились старые сообщения вверх списка. Ничего не трогаем!
        if (prevLatestId === currentLatest?.id) {
            return;
        }

        // Если пришло действительно НОВОЕ сообщение снизу — прокручиваем к нему
        const isNewMessageFromMe = isMine(currentLatest?.sender_id);
        if (stickToBottomRef.current || isNewMessageFromMe) {
            if (listRef.current) {
                listRef.current.scrollTop = 0;
            }
        }
    }, [messages, searchQuery]);

    const items = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const key = msg.id || i;

        items.push(
            <MessageBubble
                key={key}
                msg={msg}
                bubbleRef={el => { msgRefs.current[key] = el; }}
                searchQuery={searchQuery}
                isMatch={matchSet.has(i)}
                isActive={i === activeMatchIdx}
                {...bubbleHandlers}
            />
        );
        const currentLabel = getDateLabel(msg.created_at);
        const nextMsg = messages[i + 1];
        const nextLabel = nextMsg ? getDateLabel(nextMsg.created_at) : null;

        if (currentLabel && currentLabel !== nextLabel) {
            items.push(
                <div key={`sep-${currentLabel}-${i}`} className="date-separator">
                    <span>{currentLabel}</span>
                </div>
            );
        }
    }

    return (
        <div className="messages-list" ref={listRef} onScroll={handleScroll}>
            {/* 1. Сообщения: messages[0] физически внизу экрана */}
            {items}

            {/* 2. Триггер подгрузки истории (физически вверху экрана) */}
            {hasMore && !isLoading && messages.length > 0 && (
                <div 
                    ref={triggerRef} 
                    className="invisible-trigger" 
                    style={{ height: '1px', width: '100%', pointerEvents: 'none' }} 
                />
            )}

            {/* 3. Индикатор загрузки старых сообщений (вверху) */}
            {isLoadingMore && (
                <div className="chat-loading">
                    <div className="spinner" />
                    <p>Загрузка истории...</p>
                </div>
            )}

            {/* 4. Первичная загрузка чата */}
            {isLoading && (
                <div className="chat-loading">
                    <div className="spinner" />
                    <p>Загрузка...</p>
                </div>
            )}

            {!isLoading && messages.length === 0 && (
                <div className="no-messages-empty">Сообщений пока нет...</div>
            )}
        </div>
    );
}