/*
 * Системные уведомления (тосты ОС) + настройки уведомлений.
 *
 * Go-сервис Notifier пишется отдельно (см. контракт в задании). Фронтенд не зависит
 * от его наличия на этапе сборки: import.meta.glob вернёт пустой объект, если
 * сгенерированного файла bindings/client/components/notifier.ts ещё нет. Тогда
 * системные уведомления просто не показываются, а счётчики и значок в заголовке
 * работают как обычно. Как только Go-сервис появится и привязки будут
 * сгенерированы, уведомления заработают без изменений во фронтенде.
 */

const bindingModules = import.meta.glob('../../bindings/client/components/notifier.ts', { eager: true });
const api = Object.values(bindingModules)[0] || null;

export const notificationsAvailable = () => api !== null;

/* ── Настройки (хранятся на устройстве) ── */
const SETTINGS_KEY = 'notif_settings_v1';

export const DEFAULT_NOTIF_SETTINGS = {
    enabled: true,            // общий выключатель
    messages: true,           // новые сообщения
    friends: true,            // заявки в друзья и принятие заявки
    preview: true,            // показывать текст сообщения
    onlyWhenUnfocused: true,  // показывать системное уведомление, только когда окно не в фокусе
};

export function getNotifSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return { ...DEFAULT_NOTIF_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch (_) {
        return { ...DEFAULT_NOTIF_SETTINGS };
    }
}

export function saveNotifSettings(patch) {
    const next = { ...getNotifSettings(), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
}

/* ── Показ уведомления ── */
export async function ensureNotificationPermission() {
    if (!api) return false;
    try {
        if (await api.Authorized()) return true;
        return Boolean(await api.RequestAuthorization());
    } catch (_) {
        return false;
    }
}

export async function showNotification({ id, title, body = '', kind = '', chatId = '' }) {
    if (!api) return false;
    try {
        await api.Show(String(id), title, body, kind, chatId ? String(chatId) : '');
        return true;
    } catch (e) {
        console.warn('notification failed:', e);
        return false;
    }
}

/* ── Свои действия, чтобы не уведомлять человека о том, что он сделал сам ──
   Например, принявший заявку тоже получает событие FRIEND_ACCEPTED. */
const selfActions = new Map();

export function markSelfAction(kind) {
    selfActions.set(kind, Date.now());
}

export function wasSelfAction(kind, withinMs = 8000) {
    const t = selfActions.get(kind);
    return t !== undefined && Date.now() - t < withinMs;
}
