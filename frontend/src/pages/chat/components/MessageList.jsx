import './MessageList.css';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { getDateLabel, isMine } from '../lib/messages';

const STICK_TO_BOTTOM_PX = 120;
const NO_MATCHES = [];

export default function MessageList({
    chatId,
    messages,
    isLoading,
    searchQuery,
    searchNavIdx,
    onMatchesFound,
    bubbleHandlers
}) {
    const listRef = useRef(null);
    const msgRefs = useRef({});
    const isInitialMount = useRef(true);
    const stickToBottomRef = useRef(true);
    const resizeObserverRef = useRef(null);
    const searchQueryRef = useRef(searchQuery);
    searchQueryRef.current = searchQuery;

    // ---- Поиск ----
    // Считаем при рендере, а не в эффекте: иначе подсветка отстаёт на рендер
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

    // Родитель передаёт колбэк инлайном — держим его в ref, иначе эффект
    // срабатывает на каждый рендер родителя и уходит в бесконечный цикл
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

    // ---- Прижатие к низу ----
    // Высота сообщений меняется уже после отрисовки (картинки грузятся
    // через fetch с токеном), поэтому одной прокрутки при открытии мало —
    // ResizeObserver докручивает, пока пользователь внизу.
    const scrollToBottom = () => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    };

    const handleScroll = () => {
        const list = listRef.current;
        if (!list) return;
        stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX;
    };

    useLayoutEffect(() => {
        isInitialMount.current = true;
        stickToBottomRef.current = true;
        msgRefs.current = {};
    }, [chatId]);

    useLayoutEffect(() => {
        if (!messages.length || searchQuery) return;
        const last = messages[messages.length - 1];
        // Своё сообщение всегда показываем; чужое — только если пользователь внизу
        if (isInitialMount.current || stickToBottomRef.current || isMine(last?.sender_id)) {
            stickToBottomRef.current = true;
            scrollToBottom();
        }
        isInitialMount.current = false;
    }, [messages, searchQuery]);

    useEffect(() => {
        const list = listRef.current;
        if (!list || typeof ResizeObserver === 'undefined') return;
        if (!resizeObserverRef.current) {
            resizeObserverRef.current = new ResizeObserver(() => {
                if (stickToBottomRef.current && !searchQueryRef.current) scrollToBottom();
            });
        }
        // observe() для уже отслеживаемого элемента ничего не делает
        Array.from(list.children).forEach(el => resizeObserverRef.current.observe(el));
    }, [messages]);

    useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

    // ---- Отрисовка ----
    const items = [];
    let lastLabel = null;
    messages.forEach((msg, i) => {
        const label = getDateLabel(msg.created_at);
        if (label && label !== lastLabel) {
            lastLabel = label;
            items.push(
                <div key={`sep-${i}`} className="date-separator"><span>{label}</span></div>
            );
        }

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
    });

    return (
        <div className="messages-list" ref={listRef} onScroll={handleScroll}>
            <div className="messages-spacer" />

            {isLoading && (
                <div className="chat-loading"><div className="spinner" /><p>Загрузка...</p></div>
            )}

            {!isLoading && messages.length === 0 && (
                <div className="no-messages-empty">Сообщений пока нет...</div>
            )}

            {items}

            <div style={{ height: '1px' }} />
        </div>
    );
}
