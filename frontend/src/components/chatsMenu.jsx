import './chatsMenu.css'
import { useState, useEffect } from 'react';
import { GetUserChats } from '../../wailsjs/go/pages/Chat';
import  { CreateChat, GetGroups } from '../../wailsjs/go/components/Chats'
function ChatsMenu({ currentUserId, activeChatId, onSelectChat, refreshTrigger, onChatCreated, view }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const token = localStorage.getItem('jwt_token');

     useEffect(() => {
        if (currentUserId) {
            const fetchMethod = view === 'groups' ? GetGroups : GetUserChats;

            fetchMethod(currentUserId, token)
                .then((result) => {
                    setChats(result || []);
                })
                .catch((err) => {
                    console.error("Ошибка загрузки данных:", err);
                    setChats([])
                });
        }
    }, [currentUserId, refreshTrigger, view]);


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
        <div className="chats-menu">
            <input
                    type="text"
                    placeholder="Найти друга..."
                    className="search-chat"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleSendMessage}
                />
            <div className="chats-header">{view === 'groups' ? 'Группы' : 'Чаты'}</div>
            <div className="chats-list">
                {chats.map((chat) => (
                    <div
                        className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                        key={chat.id} 
                        onClick={() => onSelectChat(chat.id, chat.name)}
                    >
                        <div className="avatar-placeholder"></div>
                        <span>{chat.name}</span>
                    </div>
                ))}
                {chats.length === 0 && (
                    <div style={{padding: '10px', color: '#949ba4', fontSize: '12px'}}>
                        {view === 'groups' ? 'Группы не найдены' : 'Чаты не найдены'}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatsMenu;