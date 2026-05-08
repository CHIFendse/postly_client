import './chatsMenu.css'
import { useState, useEffect, useMemo } from 'react';
import { Events } from '@wailsio/runtime';
import { GetUserChats } from '@bindings/client/pages/chat';
import { CreateChat, GetGroups } from '@bindings/client/components/chats';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import { SetToken, Connect } from '@bindings/client/pages/voicechat';


function ChatsMenu({ currentUserId, activeChatId, onSelectChat, refreshTrigger, onChatCreated, view }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const token = localStorage.getItem('jwt_token');

    const fetchChats = async () => {
        const token = localStorage.getItem('jwt_token');
        const result = await GetUserChats(token);
        setChats(result || []);
    };

    useEffect(() => {
        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            if (msg?.type === "NEW_MESSAGE") {
                setChats((prevChats) => {
                    // 1. Находим чат, в который пришло сообщение
                    const chatIndex = prevChats.findIndex(c => c.id === msg.chat_id);
                    
                    if (chatIndex !== -1) {
                        const updatedChats = [...prevChats];
                        // 2. Обновляем текст последнего сообщения и время
                        updatedChats[chatIndex] = {
                            ...updatedChats[chatIndex],
                            last_message: msg.text,
                            updated_at: new Date().toISOString() // или время с сервера
                        };
                        // 3. Перемещаем его в начало списка (сортировка)
                        const [movedChat] = updatedChats.splice(chatIndex, 1);
                        return [movedChat, ...updatedChats];
                    } else {
                        // Если чата нет в списке (например, новый чат), лучше перекачать список
                        fetchChats();
                        return prevChats;
                    }
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = Events.On("server_message", (event) => {
            try {
                const rawData = event.data || event;
                const messageData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                
                console.log("Событие в меню:", messageData.type);

                if (messageData.type === 'NEW_CHAT') {
                    if (onChatCreated) onChatCreated(); 
                }
            } catch (err) {
                console.error("Ошибка в сокете меню:", err);
            }
        });

        return () => unsubscribe && unsubscribe();
    }, [onChatCreated]);


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
            const targetUsername = inputText.trim();
            const userId = localStorage.getItem('id');
            const token = localStorage.getItem('jwt_token');

            try {
                const result = await CreateChat(String(userId), targetUsername, token);
                const actualChatId = result.id;

                // 2. Уведомляем систему, что список чатов надо обновить
                if (onChatCreated) onChatCreated();

                // 3. Переходим в чат
                onSelectChat(actualChatId, targetUsername);
                
                setInputText("");
            } catch (err) {
                console.error("Ошибка:", err);
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