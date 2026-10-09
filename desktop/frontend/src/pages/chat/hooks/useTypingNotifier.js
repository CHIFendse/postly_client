import { useCallback, useEffect, useRef } from 'react';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import { getMyId, getMyUsername } from '../lib/messages';

const TYPING_DEBOUNCE_MS = 400;

// Шлёт собеседникам TYPING, пока пользователь набирает текст
export default function useTypingNotifier(chatId) {
    const timerRef = useRef(null);
    const chatIdRef = useRef(chatId);
    chatIdRef.current = chatId;

    const cancel = useCallback(() => clearTimeout(timerRef.current), []);

    const notify = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            if (!chatIdRef.current) return;
            try {
                await SendWSMessage(JSON.stringify({
                    type: 'TYPING',
                    chat_id: chatIdRef.current,
                    sender_id: getMyId(),
                    username: getMyUsername()
                }));
            } catch (err) {
                console.error('Typing error:', err);
            }
        }, TYPING_DEBOUNCE_MS);
    }, []);

    // Смена чата или размонтирование — отложенный TYPING уже не нужен
    useEffect(() => cancel, [chatId, cancel]);

    return { notify, cancel };
}
