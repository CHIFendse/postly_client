import { useCallback, useEffect, useRef, useState } from 'react';
import { isMine, isTmpId } from '../lib/messages';

const LONG_PRESS_MS = 400;
const LONG_PRESS_TOLERANCE = 12;
const MENU_WIDTH = 178;
const MENU_HEIGHT_FULL = 88;
const MENU_HEIGHT_SHORT = 50;

// Контекстное меню сообщения: правый клик на десктопе, долгое нажатие на мобилке
export default function useMessageContextMenu() {
    const [menu, setMenu] = useState(null);
    const longPressRef = useRef(null);
    // После долгого нажатия браузер шлёт click — он не должен сразу закрыть меню
    const suppressClickRef = useRef(false);

    const close = useCallback(() => setMenu(null), []);

    const openAt = (x, y, msg) => {
        // Неподтверждённое сообщение удалить можно, только если отправка упала
        const canDelete = isMine(msg.sender_id) && (!isTmpId(msg.id) || msg.status === 'error');
        const mh = canDelete ? MENU_HEIGHT_FULL : MENU_HEIGHT_SHORT;
        setMenu({
            x: Math.min(x, window.innerWidth - MENU_WIDTH),
            y: y + mh > window.innerHeight ? y - mh : y + 4,
            msgId: msg.id,
            canDelete,
            text: msg.text || ''
        });
    };

    const cancelLongPress = () => {
        if (!longPressRef.current) return;
        clearTimeout(longPressRef.current.timer);
        longPressRef.current = null;
    };

    const onContextMenu = (e, msg) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(e.clientX, e.clientY, msg);
    };

    const onTouchStart = (e, msg) => {
        const t = e.touches[0];
        const startX = t.clientX;
        const startY = t.clientY;
        cancelLongPress();
        longPressRef.current = {
            startX,
            startY,
            timer: setTimeout(() => {
                navigator.vibrate?.(40);
                suppressClickRef.current = true;
                openAt(startX, startY, msg);
                longPressRef.current = null;
            }, LONG_PRESS_MS)
        };
    };

    const onTouchMove = e => {
        const lp = longPressRef.current;
        if (!lp) return;
        const t = e.touches[0];
        if (
            Math.abs(t.clientX - lp.startX) > LONG_PRESS_TOLERANCE ||
            Math.abs(t.clientY - lp.startY) > LONG_PRESS_TOLERANCE
        ) {
            cancelLongPress();
        }
    };

    useEffect(() => {
        const h = () => {
            if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
            }
            setMenu(null);
        };
        document.addEventListener('click', h);
        return () => {
            document.removeEventListener('click', h);
            if (longPressRef.current) clearTimeout(longPressRef.current.timer);
        };
    }, []);

    return {
        menu,
        close,
        bubbleHandlers: { onContextMenu, onTouchStart, onTouchMove, onTouchEnd: cancelLongPress }
    };
}
