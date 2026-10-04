import { API_BASE } from '../pages/chat/lib/api';

const avatarCache = new Map();
const AVATAR_CHANGED_EVENT = 'postly-avatar-changed';

export function getAvatarUrl(userId, version = '') {
    if (!userId) return '';
    const revision = version || localStorage.getItem(`avatar_revision_${userId}`) || '';
    const suffix = revision ? `&v=${encodeURIComponent(revision)}` : '';
    return `/avatar?user_id=${encodeURIComponent(userId)}${suffix}`;
}

export async function loadAvatarObjectUrl(url) {
    if (!url) return null;
    const isCurrentAvatar = url.includes('/avatar?user_id=');
    if (!isCurrentAvatar && avatarCache.has(url)) {
        return avatarCache.get(url);
    }

    {
        const token = localStorage.getItem('jwt_token');
        const request = fetch(`${API_BASE}${url}`, {
            cache: isCurrentAvatar ? 'no-store' : 'default',
            headers: { Authorization: `Bearer ${token}` }
        }).then(async response => {
            if (!response.ok) return null;
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        });
        request.catch(() => avatarCache.delete(url));
        if (!isCurrentAvatar) avatarCache.set(url, request);
        return request;
    }
}

export function clearAvatarCache(userId) {
    const version = String(Date.now());
    localStorage.setItem(`avatar_revision_${userId}`, version);
    const prefix = getAvatarUrl(userId).split('&')[0];
    for (const [url, value] of avatarCache) {
        if (url.split('&')[0] !== prefix) continue;
        avatarCache.delete(url);
        value.then(objectUrl => objectUrl && URL.revokeObjectURL(objectUrl)).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent(AVATAR_CHANGED_EVENT, {
        detail: { userId, version }
    }));
}

export { AVATAR_CHANGED_EVENT };

async function avatarRequest(path, options = {}) {
    const token = localStorage.getItem('jwt_token');
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });
    if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(`${path}: ${response.status}${message ? ` - ${message}` : ''}`);
    }
    return response.json();
}

export async function uploadAvatar(file) {
    const data = await avatarRequest('/getAvatarUploadUrl', {
        method: 'POST',
        body: JSON.stringify({
            file_name: file.name,
            content_type: file.type
        })
    });

    const upload = await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
    });
    if (!upload.ok) throw new Error(`avatar upload: ${upload.status}`);

    return avatarRequest('/setAvatar', {
        method: 'POST',
        body: JSON.stringify({ s3_key: data.s3_key })
    });
}

export function deleteAvatar(s3Key) {
    return avatarRequest('/deleteAvatar', {
        method: 'POST',
        body: JSON.stringify({ s3_key: s3Key })
    });
}

export function getAvatars(userId = '') {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return avatarRequest(`/getAvatars${query}`);
}
