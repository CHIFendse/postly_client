// messagesCache.js
export const _msgsCache = new Map();
export const MSGS_TTL = 30_000;

// file_url → Promise<blob:-ссылка> для вложений, скачанных с токеном
export const _fileBlobCache = new Map();

export function clearMessagesCache() {
    _msgsCache.clear();
    _fileBlobCache.forEach(p => p.then(url => URL.revokeObjectURL(url)).catch(() => {}));
    _fileBlobCache.clear();
}

// Подтверждение с сервера приходит без tmp-id — сопоставляем по тексту и имени файла
export function isPendingMatch(local, incoming) {
    return String(local.id || '').startsWith('tmp_') &&
        (local.text || '') === (incoming.text || '') &&
        (local.attachment?.name || '') === (incoming.file_name || '');
}

// Локальное превью (blob) оставляем, чтобы картинка не мигала при подмене
export function confirmPending(local, incoming) {
    return {
        ...local,
        id: incoming.id || incoming.msg_id,
        created_at: incoming.created_at || local.created_at,
        message_type: incoming.message_type,
        file_url: incoming.file_url,
        status: null,
        progress: null
    };
}

// Применяет NEW_MESSAGE к списку. Идемпотентно: повторный вызов с тем же
// сообщением ничего не меняет — его вызывают и chat.jsx, и chatsMenu.jsx.
// Возвращает тот же массив, если менять нечего.
export function applyNewMessage(list, msg, isMine) {
    const msgId = msg.id || msg.msg_id;
    if (msgId && list.some(m => String(m.id) === String(msgId))) return list;

    if (isMine) {
        // Сервер подтверждает по порядку — берём самое старое ожидающее
        const idx = list.findIndex(m => isPendingMatch(m, msg));
        if (idx !== -1) {
            const updated = [...list];
            updated[idx] = confirmPending(updated[idx], msg);
            return updated;
        }
    }

    return [...list, { ...msg, id: msgId, created_at: msg.created_at || new Date().toISOString() }];
}

export function applyNewMessageToCache(msg, isMine) {
    const chatId = String(msg.chat_id);
    const cached = _msgsCache.get(chatId);
    if (!cached) return;
    const data = applyNewMessage(cached.data, msg, isMine);
    if (data !== cached.data) _msgsCache.set(chatId, { data, ts: Date.now() });
}
