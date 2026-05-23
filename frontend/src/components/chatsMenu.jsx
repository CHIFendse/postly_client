import './chatsMenu.css'
import { useState, useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import { GetUserChats } from '@bindings/client/pages/chat';
import { CreateChat, GetGroups } from '@bindings/client/components/chats';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';
import CreateGroupModal from './createGroupModal';

function ChatsMenu({ activeChatId, onSelectChat, refreshTrigger, onChatCreated, view, isOpen, onClose }) {
    const [chats, setChats] = useState([]);
    const [inputText, setInputText] = useState("");
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const username = localStorage.getItem('username');

    const fetchChats = async () => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        
        if (!freshToken || !userId) {
            console.error("Нет токена или ID пользователя");
            setChats([]);
            return;
        }

        if (view === 'groups') {
            try {
                const result = await GetGroups(String(userId), freshToken);
                console.log('GetGroups result:', result);
                setChats(result || []);
            } catch (err) {
                console.error("Ошибка загрузки групп:", err);
                setChats([]);
            }
        } else {
            try {
                const result = await GetUserChats(String(userId), freshToken);
                console.log('GetChats result:', result);
                setChats(result || []);
            } catch (err) {
                console.error("Ошибка загрузки чатов:", err);
                setChats([]);
            }
        }
    };

    useEffect(() => {
        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            console.log('ChatsMenu received WS message:', msg); // ← ДОБАВЬ ЛОГ
            
            if (msg?.type === "NEW_MESSAGE") {
                setChats((prevChats) => {
                    console.log('Current chats:', prevChats.map(c => c.id)); // ← ЛОГ
                    console.log('Message chat_id:', msg.chat_id); // ← ЛОГ
                    
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
        fetchChats();
    }, [refreshTrigger, view]);

    const handleSendMessage = async (e) => {
        if (e.key === 'Enter' && inputText.trim() !== "") {
            const targetUsername = inputText.trim();
            const userId = localStorage.getItem('id');
            const freshToken = localStorage.getItem('jwt_token');

            try {
                const result = await CreateChat(String(userId), targetUsername, freshToken);
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

    const handleCreateGroup = async (groupData) => {
        const freshToken = localStorage.getItem('jwt_token');
        const userId = localStorage.getItem('id');
        
        console.log('Creating group with data:', groupData); // ← Лог
        
        try {
            const response = await fetch('http://84.22.132.243:8081/createGroup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshToken}`
                },
                body: JSON.stringify({
                    admin_id: String(userId),
                    name: groupData.name,
                    is_private: groupData.is_private,
                    members: groupData.members 
                })
            });

            if (response.status === 201) {
                const data = await response.json();
                console.log("Группа создана:", data);
                
                setShowCreateGroup(false);
                if (onChatCreated) onChatCreated();
                fetchChats();
                
                if (data.id) {
                    onSelectChat(data.id, data.name);
                }
                return;
            }

            const errorData = await response.json().catch(() => ({}));
            alert(errorData.error || errorData.message || `Ошибка ${response.status}`);
            
        } catch (err) {
            console.error("Ошибка создания группы:", err);
            alert('Не удалось создать группу. Проверьте соединение.');
        }
    };
    const handleSearchGroup = (e) => {
        setInputText(e.target.value);
    };

    return (
        <div className={`chats-menu ${isOpen ? 'open' : ''}`}>
            <div className="search-row">
                <input
                    type="text"
                    placeholder={view === 'groups' ? "Найти группу..." : "Найти друга..."}
                    className="search-chat"
                    value={inputText}
                    onChange={view === 'groups' ? handleSearchGroup : (e) => setInputText(e.target.value)}
                    onKeyDown={view === 'groups' ? undefined : handleSendMessage}
                />
                {view === 'groups' ? (
                    <button 
                        className={`create-group-btn ${showCreateGroup ? 'active' : ''}`}
                        onClick={() => setShowCreateGroup(!showCreateGroup)}
                        title={showCreateGroup ? "Закрыть" : "Создать группу"}
                    >
                        {showCreateGroup ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4L12 12M12 4L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                        )}
                    </button>
                ) : null}
            </div>

            <CreateGroupModal 
                isOpen={showCreateGroup}
                onClose={() => setShowCreateGroup(false)}
                onCreate={handleCreateGroup}
                currentUserId={localStorage.getItem('id')}
            />

            <div className="chats-header">{view === 'groups' ? 'Группы' : 'Чаты'}</div>
            <div className="chats-list">
                {chats
                    .filter(chat => {
                        if (view === 'groups' && inputText.trim() !== '') {
                            return chat.name.toLowerCase().includes(inputText.toLowerCase());
                        }
                        return true;
                    })
                    .map((chat) => {
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
                                        
                                        {chat.last_message && chat.last_message.trim() !== "" && chat.updated_at > 0 && (
                                            <span className="chat-time">
                                                {new Date(chat.updated_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>

                                    <div className="last-message-info">
                                        {chat.last_message && chat.last_message.trim() !== "" ? (
                                            <>
                                                {chat.username === username ? (
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