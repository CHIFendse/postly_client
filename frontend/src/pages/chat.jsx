import './chat.css'
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { GetMessages} from '../../wailsjs/go/pages/Chat';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { SendWSMessage, SetToken, Connect } from '../../wailsjs/go/pages/ChatWS';

function Chat({ chatId }) {
    const myId = localStorage.getItem("id");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);

    // 1. ЭФФЕКТ: Управление соединением и событиями
    useEffect(() => {
        if (!chatId) return;
        setMessages([]); 
        isInitialMount.current = true;

        const token = localStorage.getItem('jwt_token');
        if (token) {
            SetToken(token).then(() => Connect(chatId));
        }

        const quit = EventsOn("server_message", (data) => {
            try {
                const newMessage = JSON.parse(data);
                if (newMessage.chat_id === chatId) {
                    setMessages((prev) => [...prev, newMessage]);
                }
            } catch (err) {
                console.error("Ошибка парсинга WS сообщения:", err);
            }
        });

        return () => {
            console.log("Cleanup для чата:", chatId);
            quit();
        };
    }, [chatId]);

    // 2. ЭФФЕКТ: Загрузка истории сообщений (HTTP)
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
            const currentToken = localStorage.getItem('jwt_token');
            const messageObj = {
                chat_id: chatId,
                sender_id: myId,
                text: inputText.trim(),
                token: currentToken
            }
            SendWSMessage(JSON.stringify(messageObj));
            setInputText("");
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