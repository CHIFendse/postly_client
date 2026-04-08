import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { GetMessages, AddMessage } from '../../wailsjs/go/pages/Chat';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const token = localStorage.getItem('jwt_token');
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);

    // Функция скролла теперь принимает тип анимации
    const scrollToBottom = (behavior = "auto") => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    // 1. Загрузка при смене чата
    useEffect(() => {
        if (chatId) {
            isInitialMount.current = true; // Сбрасываем флаг для нового чата
            GetMessages(chatId, token)
                .then((result) => {
                    setMessages(result || []);
                })
                .catch((err) => console.error("Ошибка загрузки:", err));
        }
    }, [chatId]);

    // 2. Скролл при изменении массива сообщений
    useLayoutEffect(() => {
        if (messages.length > 0) {
            const behavior = isInitialMount.current ? "auto" : "smooth";
            scrollToBottom(behavior);
            isInitialMount.current = false;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        if (e.key === 'Enter' && inputText.trim() !== "") {
            try {
                await AddMessage(chatId, myId, inputText, token);
                setInputText("");
                const result = await GetMessages(chatId, token);
                setMessages(result || []);
            } catch (err) {
                console.error("Ошибка при отправке:", err);
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
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
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

                {/* КРИТИЧЕСКИ ВАЖНО: Этот элемент должен быть здесь! */}
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