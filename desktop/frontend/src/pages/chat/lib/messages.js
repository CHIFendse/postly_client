function getTokenUserId() {
    const token = localStorage.getItem('jwt_token');
    if (!token) return '';
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
        return String(decoded.user_id || decoded.sub || '');
    } catch (_) {
        return '';
    }
}

// JWT является источником истины. Старый localStorage.id мог остаться от
// другого аккаунта после обновления desktop-клиента.
export const getMyId = () => {
    const tokenUserId = getTokenUserId();
    if (tokenUserId) {
        if (localStorage.getItem('id') !== tokenUserId) localStorage.setItem('id', tokenUserId);
        return tokenUserId;
    }
    return localStorage.getItem('id');
};
export const getMyUsername = () => localStorage.getItem('username');

export const isMine = senderId => String(senderId) === String(getMyId());

// Сообщение, которое сервер ещё не подтвердил
export const isTmpId = id => String(id || '').startsWith('tmp_');

// Локальное вложение (ещё не отправлено) или поля file_* с сервера → единый вид
export function getMessageAttachment(msg) {
    if (msg.attachment) return msg.attachment;
    let kind = [msg.message_type, msg.type].find(t => t === 'image' || t === 'file');
    if (!kind && msg.file_url) {
        kind = /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(msg.file_name || '') ? 'image' : 'file';
    }
    if (!kind) return null;
    return {
        kind,
        url: msg.file_url,
        name: msg.file_name || (kind === 'image' ? 'Изображение' : 'Файл'),
        size: Number(msg.file_size) || 0
    };
}

export function getDateLabel(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - dDay) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    if (diff === 2) return 'Позавчера';
    const opts = d.getFullYear() === new Date().getFullYear()
        ? { day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('ru-RU', opts);
}

export const formatTime = dateStr => (dateStr
    ? new Date(dateStr).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    : '');
