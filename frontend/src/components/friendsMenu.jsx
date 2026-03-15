import './friendsMenu.css'
import { useState, useEffect } from 'react';
import { GetUserChats } from '../../wailsjs/go/pages/Chat';
import  {CreateChat} from '../../wailsjs/go/components/Friends'
function FriendsMenu({ currentUserId, activeChatId, onSelectChat, refreshTrigger, onChatCreated }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const token = localStorage.getItem('jwt_token');

    useEffect(() => {
        if (currentUserId) {
            GetUserChats(currentUserId, token)
                .then((result) => {
                    setChats(result || []);
                })
                .catch((err) => {
                    console.error("Ошибка загрузки чатов:", err);
                });
        }
    }, [currentUserId, refreshTrigger]);


    const handleSendMessage = async (e) => {
        if (e.key === 'Enter' && inputText.trim() !== "") {
            const userId = localStorage.getItem('id');
            const token = localStorage.getItem('jwt_token');
            const targetUsername = inputText.trim();

            try {
                const newChatId = await CreateChat(userId, targetUsername, token);
                
                console.log("Чат успешно создан или найден, ID:", newChatId);
                if (onChatCreated) onChatCreated();
                onSelectChat(newChatId, targetUsername);
                setInputText("");
                
            } catch (err) {
                console.error("Ошибка при создании чата:", err);
            }
        }
    };


    return (
        <div className="friends-menu">
            <input
                    type="text"
                    placeholder="Найти друга..."
                    className="search-friend"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleSendMessage}
                />
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