import './chatsMenu.css'
import { useState, useEffect, useMemo } from 'react';
import { Events } from '@wailsio/runtime';
import { GetUserChats } from '@bindings/client/pages/chat';
import { CreateChat, GetGroups } from '@bindings/client/components/chats';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';

function ChatsMenu({ currentUserId, activeChatId, onSelectChat, refreshTrigger, onChatCreated, view }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const token = localStorage.getItem('jwt_token');

    useEffect(() => {
        const unsubscribe = Events.On("server_message", (event) => {
            try {
                const rawData = event.data || event;
                const messageData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                
                // Если пришло уведомление о новом чате
                if (messageData.type === 'NEW_CHAT') {
                    console.log("Уведомление: создан новый чат");
                    
                    // Просто вызываем функцию обновления, которая уже есть в пропсах
                    if (onChatCreated) {
                        onChatCreated(); 
                    }
                    
                    // Либо принудительно обновляем список, если refreshTrigger не используется
                    fetchChats(); 
                }
                
                if (messageData.type === 'NEW_MESSAGE') {
                    const chatExists = chats.some(c => c.id === messageData.data.chat_id);
                    if (!chatExists) {
                        onChatCreated?.();
                    }
                }
            } catch (err) {
                console.error("Ошибка обработки события в меню:", err);
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [chats, onChatCreated]); // Следим за списком чатов
     useEffect(() => {
        if (currentUserId) {
            // В v3 функции возвращают Promise, логика вызова через .then сохраняется
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
                // 1. Получаем объект ответа от Go
                const result = await CreateChat(
                    String(userId), 
                    String(targetUsername), 
                    String(token)
                );
                
                // 2. Извлекаем ID из объекта { "id": "..." }
                const actualChatId = result.id; 

                console.log("Чат успешно создан или найден, ID:", actualChatId);
                
                if (onChatCreated) onChatCreated();
                
                // 3. Передаем уже СТРОКУ (ID), а не весь объект
                onSelectChat(actualChatId, targetUsername);
                
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
                {chats.map((chat) => {
                    // ВЫЧИСЛЯЕМ ЗДЕСЬ: для каждого чата свой цвет и буква
                    const chatColor = getAvatarColor(chat.name);
                    const chatLetter = getFirstLetter(chat.name);

                    return (
                        <div
                            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                            key={chat.id} 
                            onClick={() => onSelectChat(chat.id, chat.name)}
                        >
                            {/* Применяем вычисленные значения */}
                            <div className="avatar" style={{ backgroundColor: chatColor }}>
                                <span>{chatLetter}</span>
                            </div>
                            <span className="chat-name-text">{chat.name}</span>
                        </div>
                    );
                })}
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