import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { InitClient, GetFriendRequests } from '@bindings/client/components/chatsmenu';

/*
 * Единое хранилище данных первого экрана: чаты, группы, друзья, заявки.
 * Всё приходит одним запросом /init_client при входе, дальше данные меняются
 * локально (по событиям WS и действиям пользователя) или обновляются через reload().
 * Переключение вкладок (чаты / группы / друзья) больше НЕ ходит на сервер.
 *
 * Здесь же живут счётчики непрочитанных сообщений по чатам (unread). Пока сервер
 * не отдаёт свои счётчики, они считаются на клиенте и хранятся в localStorage
 * отдельно для каждого пользователя.
 */

const InitDataContext = createContext(null);

const EMPTY = {
    chats: [],
    groups: [],
    friends: [],
    friendRequests: [],
    sentRequests: [],
};

const normalizeChat = c => ({
    id: c.id,
    name: c.name,
    last_message: c.last_message ?? '',
    username: c.username ?? '',
    user_id: c.user_id ?? '',
    avatar_url: c.avatar_url ?? '',
    updated_at: c.updated_at ?? 0,
});

const asArray = v => (Array.isArray(v) ? v : []);

/* ── Непрочитанные: localStorage по ключу unread_<id пользователя> ── */
const unreadKey = () => `unread_${localStorage.getItem('id') || ''}`;

const readUnread = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(unreadKey()) || '{}');
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch (_) {
        return {};
    }
};

const writeUnread = map => {
    try { localStorage.setItem(unreadKey(), JSON.stringify(map)); } catch (_) {}
};

export function InitDataProvider({ token, children }) {
    const [data, setData] = useState(EMPTY);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [unread, setUnread] = useState(() => (token ? readUnread() : {}));

    const tokenRef = useRef(token);
    const inFlight = useRef(null);
    const queued = useRef(false);

    useEffect(() => { tokenRef.current = token; }, [token]);

    // Один запрос в полёте; если во время него пришла новая просьба обновиться
    // (например, событие WS), после завершения делаем ещё один, чтобы не потерять изменения.
    // Промис резолвится свежими данными (или null при ошибке), чтобы вызывающий код
    // мог сразу ими пользоваться, не дожидаясь перерисовки.
    const reload = useCallback(() => {
        const t = tokenRef.current;
        if (!t) return Promise.resolve(null);
        if (inFlight.current) {
            queued.current = true;
            return inFlight.current;
        }

        const run = async () => {
            let next = null;
            try {
                const res = await InitClient(t);
                if (tokenRef.current !== t) return null; // за время запроса сменился пользователь
                next = {
                    chats: asArray(res?.chats).map(normalizeChat),
                    groups: asArray(res?.groups).map(normalizeChat),
                    friends: asArray(res?.friends),
                    friendRequests: asArray(res?.friend_requests),
                    sentRequests: asArray(res?.sent_requests),
                };
                setData(next);
                setLoaded(true);
                setError(null);
            } catch (e) {
                console.error('init_client error:', e);
                setError(e);
            } finally {
                inFlight.current = null;
                if (queued.current) {
                    queued.current = false;
                    reload();
                }
            }
            return next;
        };

        inFlight.current = run();
        return inFlight.current;
    }, []);

    // Лёгкое обновление только входящих заявок (WS FRIEND_REQUEST и запасной опрос).
    // Возвращает свежий список (или null при ошибке).
    const refreshFriendRequests = useCallback(async () => {
        const t = tokenRef.current;
        if (!t) return null;
        try {
            const arr = asArray(await GetFriendRequests(t));
            if (tokenRef.current !== t) return null;
            setData(prev => ({ ...prev, friendRequests: arr }));
            return arr;
        } catch (_) {
            return null;
        }
    }, []);

    // Вход / выход / смена пользователя
    useEffect(() => {
        setData(EMPTY);
        setLoaded(false);
        setError(null);
        setUnread(token ? readUnread() : {});
        if (token) reload();
    }, [token, reload]);

    // Удалённые чаты больше не должны хранить счётчик
    useEffect(() => {
        if (!loaded) return;
        const ids = new Set([...data.chats, ...data.groups].map(c => String(c.id)));
        setUnread(prev => {
            const keys = Object.keys(prev);
            if (keys.every(k => ids.has(k))) return prev;
            const next = {};
            for (const k of keys) if (ids.has(k)) next[k] = prev[k];
            writeUnread(next);
            return next;
        });
    }, [loaded, data.chats, data.groups]);

    // Локальные изменения списков: принимают значение или функцию (prev) => next
    const makeSetter = key => updater =>
        setData(prev => ({
            ...prev,
            [key]: typeof updater === 'function' ? updater(prev[key]) : updater,
        }));

    const setters = useMemo(() => ({
        setChats: makeSetter('chats'),
        setGroups: makeSetter('groups'),
        setFriends: makeSetter('friends'),
        setFriendRequests: makeSetter('friendRequests'),
        setSentRequests: makeSetter('sentRequests'),
    }), []);

    // ── Счётчики непрочитанных ──
    const incrementUnread = useCallback((chatId, n = 1) => {
        const id = String(chatId);
        setUnread(prev => {
            const next = { ...prev, [id]: (prev[id] || 0) + n };
            writeUnread(next);
            return next;
        });
    }, []);

    const clearUnread = useCallback(chatId => {
        const id = String(chatId);
        setUnread(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            writeUnread(next);
            return next;
        });
    }, []);

    const totalUnread = useMemo(
        () => Object.values(unread).reduce((sum, n) => sum + n, 0),
        [unread]
    );

    const value = useMemo(() => ({
        ...data,
        loaded,
        error,
        reload,
        refreshFriendRequests,
        unread,
        totalUnread,
        incrementUnread,
        clearUnread,
        ...setters,
    }), [data, loaded, error, reload, refreshFriendRequests, unread, totalUnread,
        incrementUnread, clearUnread, setters]);

    return <InitDataContext.Provider value={value}>{children}</InitDataContext.Provider>;
}

export function useInitData() {
    const ctx = useContext(InitDataContext);
    if (!ctx) throw new Error('useInitData must be used inside <InitDataProvider>');
    return ctx;
}
