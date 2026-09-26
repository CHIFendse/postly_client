import './userProfile.css';

import { useState, useEffect } from 'react';
import { GetFriends, SendFriendRequest, DeleteFriend } from '@bindings/client/components/chatsmenu';
function UserProfile({
    chatName,
    chatId,
    onClose,
    getAvatarColor
}) {
    const [isFriend, setIsFriend] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const token = localStorage.getItem("jwt_token");
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
                <div className="user-profile-avatar" style={{backgroundColor: getAvatarColor(chatName)}}>
                    {firstLetter}
                </div>


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
    );
}

export default UserProfile;