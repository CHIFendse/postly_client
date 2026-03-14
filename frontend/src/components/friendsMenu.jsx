import './friendsMenu.css'
import { useState, useEffect } from 'react';
import { GetUserChats } from '../../wailsjs/go/pages/Chat';

function FriendsMenu({ currentUserId, activeChatId, onSelectChat }) {
    const [chats, setChats] = useState([]);
    // const [activeChatId, setActiveChatId] = useState(null);
    const token = localStorage.getItem('jwt_token')
    useEffect(() => {
        
        if (currentUserId) {
            GetUserChats(currentUserId, token)
                .then((result) => {
                    setChats(result || []);
                })
                .catch((err) => {
                    console.error("Ошибка загрузки чатов:", err);
                });
            console.log(chats)
        }
    }, [currentUserId]);
    return (
        <div className="friends-menu">
            <div className="friends-header">Чаты</div>
            <div className="friends-list">
                {chats.map((chat) => (
                    <div
                        className={`friend-item ${chat.id === activeChatId ? 'active' : ''}`}
                        key={chat.id} 
                        onClick={() => onSelectChat(chat.id, chat.username)}
                    >
                        <div className="avatar-placeholder"></div>
                        <span>{chat.username}</span>
                    </div>
                ))}
                {chats.length === 0 && (
                    <div style={{padding: '10px', color: '#949ba4', fontSize: '12px'}}>
                        Чаты не найдены
                    </div>
                )}
            </div>
        </div>
    );
}

export default FriendsMenu;