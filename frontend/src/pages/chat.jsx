import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Events } from '@wailsio/runtime';
// ИСПРАВЛЕНИЕ: В v3 биндинги лежат по новому пути. 
// Замени 'postly' на имя своего проекта из go.mod, если оно отличается.
import { GetMessages, GetUserChats } from '@bindings/client/pages/chat';
import { SendWSMessage, SetToken } from '@bindings/client/pages/chatws';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const username = localStorage.getItem("username");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);
    const [isLoading, setIsLoading] = useState(false);
    // 1. Очистка чата при смене ID
    useEffect(() => {
    setMessages([]);
    setIsLoading(true);
    isInitialMount.current = true;
}, [chatId]);

    useEffect(() => {
    if (!chatId) return;
    const token = localStorage.getItem('jwt_token');
    
    setIsLoading(true); // На всякий случай подтверждаем загрузку
    GetMessages(chatId, token)
        .then((result) => {
            setMessages(result || []);
        })
        .catch(err => console.error(err))
        .finally(() => {
            setIsLoading(false); 
        });
}, [chatId]);

    // 3. Загрузка истории
    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem('jwt_token');
        
        GetMessages(chatId, token)
            .then((result) => {
                setMessages(result || []);
            })
            .catch(err => console.error(err));
    }, [chatId]);

    // 4. Плавный скролл (с защитой от пустых обновлений)
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
            const tempId = Date.now().toString(); // Временный ID

            // 1. Создаем объект сообщения локально
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
            Events.Emit("server_message", localMsg);

            try {
                // 3. Отправляем на сервер
                await SendWSMessage(JSON.stringify({
                    chat_id: chatId,
                    sender_id: myId,
                    text: text,
                    username: username,
                }));
            } catch (err) {
                console.error("Ошибка отправки:", err);
                // Тут можно пометить сообщение как "не доставлено"
            } 
        }
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
                        {msg.text}
                    </div>
                ))}

                {isLoading && (
                    <div className="chat-loading">
                        <div className="spinner"></div>
                        <p>Загрузка сообщений...</p>
                    </div>
                )}

                {/* Если загрузка закончилась и сообщений реально 0 — показываем текст */}
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