import './userProfile.css';

import { useState, useEffect } from 'react';
import { GetFriends, SendFriendRequest, DeleteFriend } from '@bindings/client/components/chatsmenu';
import Avatar from './Avatar';
import AvatarGallery from './AvatarGallery';
import ImageViewer from '../pages/chat/components/ImageViewer';
import { AVATAR_CHANGED_EVENT, getAvatarUrl, getAvatars, loadAvatarObjectUrl } from '../utils/avatarApi';
function UserProfile({
    chatName,
    chatId,
    userId,
    onClose,
    getAvatarColor
}) {
    const [isFriend, setIsFriend] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [avatarSrc, setAvatarSrc] = useState(null);
    const [avatarVersion, setAvatarVersion] = useState('');
    const [avatarHistory, setAvatarHistory] = useState([]);
    const [showAvatar, setShowAvatar] = useState(false);
    const token = localStorage.getItem("jwt_token");
    useEffect(() => {
        let active = true;
        setAvatarSrc(null);
        if (!userId) return undefined;
        loadAvatarObjectUrl(getAvatarUrl(userId, avatarVersion)).then(src => {
            if (active) setAvatarSrc(src);
        }).catch(() => {});
        getAvatarsForUser(userId).then(history => {
            if (active) setAvatarHistory(history);
        }).catch(() => {
            if (active) setAvatarHistory([]);
        });
        return () => { active = false; };
    }, [userId, avatarVersion]);
    useEffect(() => {
        const refresh = event => {
            if (event.detail?.userId === userId) setAvatarVersion(event.detail.version);
        };
        window.addEventListener(AVATAR_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(AVATAR_CHANGED_EVENT, refresh);
    }, [userId]);

    const getAvatarsForUser = async targetUserId => {
        const entries = await getAvatars(targetUserId);
        return Promise.all((Array.isArray(entries) ? entries : []).map(async entry => ({
            ...entry,
            src: await loadAvatarObjectUrl(entry.url),
            downloadUrl: entry.url
        })));
    };
        useEffect(() => {
        let isMounted = true;
        
        // Убрали chatName из параметров функции (async () вместо async (chatName))
        const viewFriendStatus = async () => {
            try {
                if (!token || !chatName) return;
                const arr = await GetFriends(token);
                const found = arr.some(friend => friend.username === chatName);

                if (isMounted) {
                    setIsFriend(found);
                    setLoading(false);
                }
            } catch (_) {
                if (isMounted) {
                    setIsFriend(false);
                    setLoading(false);
                }
            }
        };
        
        setLoading(true);
        viewFriendStatus();

        return () => { isMounted = false; };
    }, [chatName, token]);

    const handleFriendAction = async () => {
        if (actionLoading) return; // Защита от спам-кликов
        setActionLoading(true);

        try {
            if (isFriend) {
                await DeleteFriend(chatName, token);
                setIsFriend(false); // Оптимистичное обновление интерфейса
            } else {
                await SendFriendRequest(chatName, token);
                // Если это запрос в друзья, возможно статус изменится не сразу, 
                // но для интерактива можно временно переключить или оставить как есть
                setIsFriend(true); 
            }
        } catch (err) {
            console.error("Ошибка при изменении статуса друга:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const firstLetter =
        chatName
            ? chatName.charAt(0).toUpperCase()
            : '?';

    return (
        <>
        <aside className="user-profile">

            <div className="user-profile-header">

                <h2>
                    Профиль
                </h2>

                <button
                    className="user-profile-close"
                    type="button"
                    onClick={onClose}
                >
                    ×
                </button>

            </div>

            
            <div className="user-profile-content">
                <Avatar
                    userId={userId}
                    name={chatName}
                    size={102}
                    className="user-profile-avatar"
                    color={getAvatarColor(chatName)}
                    onClick={avatarSrc ? () => setShowAvatar(true) : undefined}
                />


                <div className="user-profile-name">
                    {chatName}
                </div>


                <div className="user-profile-divider" />


                <button
                    className="user-profile-action"
                    type="button"
                >
                    Позвонить
                </button>


                {loading ? (
                    <button className="user-profile-action" type="button" disabled>
                        Загрузка...
                    </button>
                ) : (
                    <button
                        className={`user-profile-action ${isFriend ? "remove-btn" : "add-btn"}`}
                        type="button"
                        disabled={actionLoading} // Блокируем кнопку на время запроса
                        onClick={handleFriendAction} // Исправленный вызов!
                    >
                        {actionLoading ? "Обработка..." : (isFriend ? "Удалить из друзей" : "Добавить в друзья")}
                    </button>
                )}

            </div>

        </aside>
        {showAvatar && avatarHistory.length > 0 && (
            <AvatarGallery avatars={avatarHistory} onClose={() => setShowAvatar(false)} />
        )}
        {showAvatar && avatarHistory.length === 0 && avatarSrc && (
            <ImageViewer src={avatarSrc} downloadUrl={getAvatarUrl(userId)} onClose={() => setShowAvatar(false)} />
        )}
        </>
    );
}

export default UserProfile;