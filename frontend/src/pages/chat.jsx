import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { GetMessages } from '@bindings/client/pages/chat';
import { SendWSMessage } from '@bindings/client/pages/chatws';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const username = localStorage.getItem("username");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);
    const [isLoading, setIsLoading] = useState(false);

    // Очистка при смене чата
    useEffect(() => {
        setMessages([]);
        setIsLoading(true);
        isInitialMount.current = true;
    }, [chatId]);

    // Загрузка сообщений
    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem('jwt_token');
        
        setIsLoading(true);
        GetMessages(chatId, token)
            .then((result) => {
                console.log('Загружены сообщения:', result);
                setMessages(result || []);
            })
            .catch(err => console.error('Ошибка загрузки:', err))
            .finally(() => setIsLoading(false));
    }, [chatId]);

    // Скролл
    useLayoutEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            const behavior = isInitialMount.current ? "auto" : "smooth";
            messagesEndRef.current.scrollIntoView({ behavior });
            isInitialMount.current = false;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        if (e.key === 'Enter' && inputText.trim() !== "") {
            const text = inputText.trim();
            const tempId = Date.now().toString();

            console.log('Sending message to chat_id:', chatId);

            const localMsg = {
                id: tempId,
                chat_id: chatId,
                sender_id: myId,
                username: username,
                text: text,
                type: "NEW_MESSAGE",
            };
            setMessages((prev) => [...prev, localMsg]);
            setInputText("");

            try {
                await SendWSMessage(JSON.stringify({
                    chat_id: chatId,
                    sender_id: myId,
                    text: text,
                    username: username,
                }));
            } catch (err) {
                console.error("Ошибка отправки:", err);
            }
        }
    };

    // Функция получения имени отправителя
    const getSenderName = async (senderId) => {
        if (senderId === myId) return 'Вы';
        return senderId.substring(0, 8); // Временно показываем часть ID
    };

    if (!chatId) {
        return (
            <div className="chat-placeholder">
                <div className="placeholder-content">
                    <p>Выберите чат, чтобы начать общение</p>
                </div>
            </div>
        );
    }

    return (
        <div className='chat-window'>
            <div className='messages-list'>
                {messages.map((msg, index) => (
                    <div
                        key={msg.id || index}
                        className={`message-bubble ${msg.sender_id === myId ? 'sent' : 'received'}`}
                    >
                        {msg.sender_id !== myId && (
                            
                            <div className="message-sender">{msg.username}</div>
                        )}
                        <div className="message-text">{msg.text}</div>
                    </div>
                ))}

                {isLoading && (
                    <div className="chat-loading">
                        <div className="spinner"></div>
                        <p>Загрузка сообщений...</p>
                    </div>
                )}

                {!isLoading && messages.length === 0 && (
                    <div className="no-messages-empty">
                        Сообщений пока нет...
                    </div>
                )}
                
                <div ref={messagesEndRef} style={{ height: "1px", marginTop: "-1px" }} />
            </div>
            <div className="chat-input-container">
                <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    className="chat-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleSendMessage}
                />
            </div>
        </div>
    );
}

export default Chat;