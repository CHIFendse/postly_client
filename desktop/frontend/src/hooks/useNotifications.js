import { useEffect, useRef } from 'react';
import { Events, Window } from '@wailsio/runtime';
import { useInitData } from '../context/InitDataContext';
import {
    getNotifSettings,
    showNotification,
    ensureNotificationPermission,
    wasSelfAction,
} from '../utils/notifier';

/*
 * Единое место, где события сервера превращаются в уведомления:
 *  - счётчики непрочитанных по чатам (бейдж в списке + число в заголовке окна);
 *  - системные уведомления ОС (если окно не в фокусе) через Go-сервис Notifier;
 *  - реакция на клик по уведомлению: открыть нужный чат / вкладку «Друзья».
 *
 * Подписка на 'server_message' одна и живёт всё время, пока открыт основной экран.
 */

const PREVIEW_LIMIT = 120;
const BURST_WINDOW_MS = 4000;
const BASE_TITLE = 'Postly';

const isFocused = () => document.hasFocus() && !document.hidden;

const clip = text => (text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text);

// Текст сообщения для превью (вложения описываем словами)
function describeMessage(msg) {
    switch (msg.message_type) {
        case 'image': return 'Фотография';
        case 'voice': return 'Голосовое сообщение';
        case 'video': return 'Видео';
        case 'file': return msg.file_name ? `Файл: ${msg.file_name}` : 'Файл';
        default: return msg.text || '';
    }
}

export default function useNotifications({ activeChatId, onOpenChat, onOpenFriends }) {
    const {
        chats,
        groups,
        friends,
        totalUnread,
        reload,
        refreshFriendRequests,
        incrementUnread,
        clearUnread,
    } = useInitData();

    // Всегда актуальные значения для обработчиков, чтобы не пересоздавать подписки
    const chatsRef = useRef(chats);
    const groupsRef = useRef(groups);
    const friendsRef = useRef(friends);
    const activeRef = useRef(activeChatId);
    const openChatRef = useRef(onOpenChat);
    const openFriendsRef = useRef(onOpenFriends);
    chatsRef.current = chats;
    groupsRef.current = groups;
    friendsRef.current = friends;
    activeRef.current = activeChatId;
    openChatRef.current = onOpenChat;
    openFriendsRef.current = onOpenFriends;

    // Состояние «пачек» сообщений по чатам (см. notifyMessage)
    const bursts = useRef(new Map());

    // Разрешение на системные уведомления (на Windows выдаётся сразу)
    useEffect(() => { ensureNotificationPermission(); }, []);

    // Открытый чат при возвращении фокуса считается прочитанным
    useEffect(() => {
        if (activeChatId && isFocused()) clearUnread(activeChatId);
    }, [activeChatId, clearUnread]);

    useEffect(() => {
        const onFocus = () => {
            if (activeRef.current && isFocused()) clearUnread(activeRef.current);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [clearUnread]);

    // Число непрочитанных в заголовке окна
    useEffect(() => {
        const title = totalUnread > 0 ? `${BASE_TITLE} (${totalUnread > 99 ? '99+' : totalUnread})` : BASE_TITLE;
        try { Window.SetTitle(title)?.catch?.(() => {}); } catch (_) {}
    }, [totalUnread]);
    useEffect(() => () => {
        try { Window.SetTitle(BASE_TITLE)?.catch?.(() => {}); } catch (_) {}
    }, []);

    useEffect(() => {
        const findChat = chatId => {
            const id = String(chatId);
            const chat = chatsRef.current.find(c => String(c.id) === id);
            if (chat) return { chat, isGroup: false };
            const group = groupsRef.current.find(c => String(c.id) === id);
            if (group) return { chat: group, isGroup: true };
            return { chat: null, isGroup: false };
        };

        // Нужно ли показывать системное уведомление в текущем состоянии окна
        const allowedNow = (settings, kindEnabled) => {
            if (!settings.enabled || !kindEnabled) return false;
            return settings.onlyWhenUnfocused ? !isFocused() : true;
        };

        // Первое сообщение чата показываем сразу, остальные в течение 4 секунд
        // склеиваем в одно «Ещё N сообщений», чтобы не заспамить экран.
        const notifyMessage = (msg, chat, isGroup, settings) => {
            const chatId = String(msg.chat_id);
            const text = clip(describeMessage(msg));
            const sender = msg.username || chat?.name || 'Новое сообщение';
            const title = isGroup ? (chat?.name || sender) : sender;
            const bodyText = settings.preview ? text : 'Новое сообщение';
            const body = isGroup && settings.preview ? `${sender}: ${bodyText}` : bodyText;

            const show = (t, b) => showNotification({
                id: `msg-${chatId}-${Date.now()}`,
                title: t,
                body: b,
                kind: 'message',
                chatId,
            });

            const now = Date.now();
            const st = bursts.current.get(chatId);

            if (!st || now - st.shownAt > BURST_WINDOW_MS) {
                bursts.current.set(chatId, { shownAt: now, extra: 0, timer: null });
                show(title, body);
                return;
            }

            st.extra += 1;
            if (!st.timer) {
                st.timer = setTimeout(() => {
                    const cur = bursts.current.get(chatId);
                    if (!cur) return;
                    if (cur.extra > 0) show(title, `Ещё новых сообщений: ${cur.extra}`);
                    cur.shownAt = Date.now();
                    cur.extra = 0;
                    cur.timer = null;
                }, Math.max(0, BURST_WINDOW_MS - (now - st.shownAt)));
            }
        };

        const unsubMessages = Events.On('server_message', async event => {
            const msg = event.data;
            if (!msg) return;

            switch (msg.type) {
                case 'NEW_MESSAGE': {
                    const myId = String(localStorage.getItem('id') || '');
                    if (String(msg.sender_id) === myId) return; // свои сообщения не считаем

                    const chatId = String(msg.chat_id);
                    const isActiveAndVisible = String(activeRef.current) === chatId && isFocused();

                    // Счётчик непрочитанных не зависит от настроек системных уведомлений
                    if (!isActiveAndVisible) incrementUnread(chatId);

                    const settings = getNotifSettings();
                    if (isActiveAndVisible || !allowedNow(settings, settings.messages)) return;

                    const { chat, isGroup } = findChat(chatId);
                    notifyMessage(msg, chat, isGroup, settings);
                    break;
                }

                case 'FRIEND_REQUEST': {
                    // Одно событие — одно обновление заявок (ChatsMenu это событие не обрабатывает)
                    const list = await refreshFriendRequests();
                    const settings = getNotifSettings();
                    if (!allowedNow(settings, settings.friends)) return;
                    const req = (list || []).find(r => String(r.id) === String(msg.request_id));
                    showNotification({
                        id: `friend-req-${msg.request_id || Date.now()}`,
                        title: 'Новая заявка в друзья',
                        body: `${req?.username || 'Пользователь'} хочет добавить вас в друзья`,
                        kind: 'friend_request',
                    });
                    break;
                }

                case 'FRIEND_ACCEPTED': {
                    // Событие приходит обеим сторонам; принявший заявку сам об этом знает
                    const fresh = await reload();
                    if (wasSelfAction('friend_accepted')) return;
                    const settings = getNotifSettings();
                    if (!allowedNow(settings, settings.friends)) return;
                    const source = fresh?.friends || friendsRef.current;
                    const friend = source.find(f => String(f.id) === String(msg.friend_id));
                    showNotification({
                        id: `friend-acc-${msg.friend_id || Date.now()}`,
                        title: 'Заявка принята',
                        body: `${friend?.username || 'Пользователь'} теперь у вас в друзьях`,
                        kind: 'friend_accepted',
                    });
                    break;
                }

                default:
                    break;
            }
        });

        // Клик по системному уведомлению (окно поднимает Go-сервис)
        const unsubClick = Events.On('notification_clicked', event => {
            const d = event.data || {};
            if (d.kind === 'message' && d.chat_id) {
                const { chat, isGroup } = findChat(d.chat_id);
                openChatRef.current?.(String(d.chat_id), chat?.name || '', chat?.user_id || '', isGroup);
            } else if (d.kind === 'friend_request' || d.kind === 'friend_accepted') {
                openFriendsRef.current?.();
            }
        });

        return () => {
            unsubMessages();
            unsubClick();
            bursts.current.forEach(st => st.timer && clearTimeout(st.timer));
            bursts.current.clear();
        };
    }, [incrementUnread, refreshFriendRequests, reload]);
}
