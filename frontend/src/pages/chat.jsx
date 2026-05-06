import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Events } from '@wailsio/runtime';
// ИСПРАВЛЕНИЕ: В v3 биндинги лежат по новому пути. 
// Замени 'postly' на имя своего проекта из go.mod, если оно отличается.
import { GetMessages } from '@bindings/client/pages/chat';
import { SendWSMessage, SetToken, Connect } from '@bindings/client/pages/chatws';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);
    // Подписка на новые сообщения
    useEffect(() => {
        if (!chatId) return;

        console.log("Подписываемся на чат:", chatId);

        const unsubscribe = Events.On("server_message", (event) => {
            try {
                // В v3 Wails данные события часто приходят в поле data
                const rawData = event.data || event;
                const messageData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                
                // Важно: проверяем, что это именно сообщение, а не системное уведомление
                const newMessage = messageData.data || messageData;

                if (newMessage && newMessage.chat_id === chatId) {
                    setMessages((prev) => {
                        // Проверка на дубликаты (чтобы сообщение не двоилось)
                        if (prev.find(m => m.id === newMessage.id && m.id !== undefined)) {
                            return prev;
                        }
                        return [...prev, newMessage];
                    });
                }
            } catch (err) {
                console.error("Ошибка парсинга сообщения:", err);
            }
        });

        return () => {
            console.log("Отписка от чата:", chatId);
            if (unsubscribe) unsubscribe();
        };
    }, [chatId]); // Подписка пересоздается только при смене ID чата

    // Загрузка истории сообщений (HTTP через Go Bindings)
    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem('jwt_token');
        
        GetMessages(chatId, token)
            .then((result) => {
                setMessages(result || []);
            })
            .catch((err) => console.error("Ошибка загрузки истории:", err));
    }, [chatId]);

    const scrollToBottom = (behavior = "auto") => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    useLayoutEffect(() => {
        if (messages.length > 0) {
            const behavior = isInitialMount.current ? "auto" : "smooth";
            scrollToBottom(behavior);
            isInitialMount.current = false;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        if (e.key === 'Enter' && inputText.trim() !== "") {
            const currentToken = localStorage.getItem('jwt_token');
            const messageObj = {
                chat_id: chatId,
                sender_id: myId,
                text: inputText.trim(),
                token: currentToken
            }
            // Вызываем биндинг
            try {
                await SendWSMessage(JSON.stringify(messageObj));
                setInputText("");
            } catch (err) {
                console.error("Ошибка отправки сообщения:", err);
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