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
    console.log("CHAT RENDER CHECK: ", chatId);
    useEffect(() => {
        if (!chatId) return;

        const unsubscribe = Events.On("server_message", (event) => {
            // В v3 объект события содержит поле data
            const msg = event.data; 

            console.log("Получен объект из события:", msg);

            // Проверяем, что объект не пустой
            if (msg && msg.type === "NEW_MESSAGE") {
                // Если chat_id все еще пустой из-за бэкенда, 
                // проверка msg.chat_id === chatId не сработает.
                // Пока для теста можно закомментировать проверку ID:
                if (msg.chat_id === chatId || msg.chat_id === "") {
                    setMessages((prev) => [...prev, {
                        ...msg,
                        // Если текст пустой, выведем хоть что-то для теста
                        text: msg.text || "Тестовое сообщение (пустое в JSON)"
                    }]);
                }
            }
        });

        return () => unsubscribe();
    }, [chatId]);
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
            
            // Формируем объект сообщения
            const messageObj = {
                chat_id: chatId,
                sender_id: myId,
                text: inputText.trim(),
            };

            try {
                // ПЕРЕД отправкой сообщения НЕ НУЖНО каждый раз вызывать Connect.
                // Это должно быть сделано ОДИН РАЗ при загрузке приложения.
                
                await SendWSMessage(JSON.stringify(messageObj));
                setInputText(""); 
            } catch (err) {
                console.error("Ошибка отправки. Соединение живое?", err);
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