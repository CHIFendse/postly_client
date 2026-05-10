import './chatsMenu.css'
import { useState, useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import { GetUserChats } from '@bindings/client/pages/chat';
import { CreateChat, GetGroups } from '@bindings/client/components/chats';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';

function ChatsMenu({ currentUserId, activeChatId, onSelectChat, refreshTrigger, onChatCreated, view, isOpen, onClose }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const token = localStorage.getItem('jwt_token');
    const username = localStorage.getItem('username');

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
                    const chatIndex = prevChats.findIndex(c => c.id === msg.chat_id);
                    
                    if (chatIndex !== -1) {
                        const updatedChats = [...prevChats];
                        updatedChats[chatIndex] = {
                            ...updatedChats[chatIndex],
                            last_message: msg.text,
                            sender_id: msg.sender_id,
                            username: msg.username,
                            updated_at: msg.updated_at || Math.floor(Date.now() / 1000)
                        };
                        const [movedChat] = updatedChats.splice(chatIndex, 1);
                        return [movedChat, ...updatedChats];
                    } else {
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
            const fetchMethod = view === 'groups' ? GetGroups : GetUserChats;

            fetchMethod(currentUserId, token)
                .then((result) => {
                    setChats(result || []);
                })
                .catch((err) => {
                    console.error("Ошибка загрузки данных:", err);
                    setChats([]);
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

                if (onChatCreated) onChatCreated();
                onSelectChat(actualChatId, targetUsername);
                
                if (onClose) onClose();
                
                setInputText("");
            } catch (err) {
                console.error("Ошибка:", err);
            }
        }
    };

    const handleSelectChat = (id, name) => {
        onSelectChat(id, name);
        if (window.innerWidth <= 850 && onClose) {
            onClose();
        }
    };

    return (
        <div className={`chats-menu ${isOpen ? 'open' : ''}`}>
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
                    const chatColor = getAvatarColor(chat.name);
                    const chatLetter = getFirstLetter(chat.name);

                    return (
                        <div
                            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                            key={chat.id} 
                            onClick={() => handleSelectChat(chat.id, chat.name)}
                        >
                            <div className="avatar" style={{ backgroundColor: chatColor }}>
                                <span>{chatLetter}</span>
                            </div>
                            
                            <div className="chat-content">
                                <div className="chat-row">
                                    <span className="chat-name-text">{chat.name}</span>
                                    
                                    {chat.last_message && chat.last_message.trim() !== "" && (
                                        <span className="chat-time">
                                            {chat.updated_at > 0 && 
                                                new Date(chat.updated_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            }
                                        </span>
                                    )}
                                </div>

                                <div className="last-message-info">
                                    {chat.last_message && chat.last_message.trim() !== "" ? (
                                        <>
                                            {chat.username == username ? (
                                                <span className="last-message-sender">Вы: </span>
                                            ) : (
                                                <span className="last-message-sender">{chat.username}: </span>
                                            )}
                                            <span className="last-message">{chat.last_message}</span>
                                        </>
                                    ) : (
                                        <span className="no-messages">Нет сообщений...</span>
                                    )}
                                </div>
                            </div>
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