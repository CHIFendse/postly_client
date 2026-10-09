import { useEffect, useState } from 'react';
import { AVATAR_CHANGED_EVENT, getAvatarUrl, loadAvatarObjectUrl } from '../utils/avatarApi';
import './Avatar.css';

export default function Avatar({ userId, name, size = 40, className = '', version = '', color = '#4e5058', onClick }) {
    const [src, setSrc] = useState(null);
    const [failed, setFailed] = useState(false);
    const [cacheVersion, setCacheVersion] = useState('');
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    const url = getAvatarUrl(userId, version || cacheVersion);

    useEffect(() => {
        const refresh = event => {
            if (event.detail?.userId === userId) setCacheVersion(event.detail.version);
        };
        window.addEventListener(AVATAR_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(AVATAR_CHANGED_EVENT, refresh);
    }, [userId]);

    useEffect(() => {
        let active = true;
        setSrc(null);
        setFailed(false);
        if (!url) return undefined;
        loadAvatarObjectUrl(url).then(next => {
            if (active) {
                setSrc(next);
                setFailed(!next);
            }
        }).catch(() => active && setFailed(true));
        return () => { active = false; };
    }, [url]);

    return (
        <div
            className={`avatar-image ${className}`}
            style={{ width: size, height: size, minWidth: size, backgroundColor: color, cursor: onClick ? 'zoom-in' : undefined }}
            onClick={onClick}
        >
            {src && !failed
                ? <img src={src} alt={name || 'Аватар'} onError={() => setFailed(true)} />
                : <span>{letter}</span>}
        </div>
    );
}
