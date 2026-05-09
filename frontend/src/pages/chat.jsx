import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Events } from '@wailsio/runtime';
// ИСПРАВЛЕНИЕ: В v3 биндинги лежат по новому пути. 
// Замени 'postly' на имя своего проекта из go.mod, если оно отличается.
import { GetMessages, GetUserChats } from '@bindings/client/pages/chat';
import { SendWSMessage, SetToken } from '@bindings/client/pages/chatws';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);

    // 1. Очистка чата при смене ID
    useEffect(() => {
        setMessages([]);
        isInitialMount.current = true;
    }, [chatId]);

    useEffect(() => {
        if (!chatId) return;

        // Слушаем события, которые приходят из ЕДИНОГО сокета
        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            // Просто фильтруем сообщения: если чат совпадает — добавляем в список
            if (msg && msg.type === "NEW_MESSAGE" && String(msg.chat_id) === String(chatId)) {
                setMessages((prev) => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            }
        });

        return () => unsubscribe();
    }, [chatId]); // Здесь только подписка на событие, без вызова Connect

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
                text: text,
                type: "NEW_MESSAGE"
            };
            setInputText("");

            try {
                // 3. Отправляем на сервер
                await SendWSMessage(JSON.stringify({
                    chat_id: chatId,
                    sender_id: myId,
                    text: text,
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
                {messages.length === 0 && (
                    <div style={{padding: '10px', color: '#c7781e', fontSize: '18px'}}>
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