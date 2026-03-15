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


    useEffect(() => {
        const quit = EventsOn("server_message", (data) => {
            try {
                
                const newMessage = JSON.parse(data);
                if (!newMessage.id) {
                    newMessage.id = Date.now() + Math.random(); 
                }
                console.error("Сообщение:", newMessage);
                setMessages((prevMessages) => [...prevMessages, newMessage]);
            } catch (err) {
                console.error("Ошибка парсинга сообщения:", err);
            }
            });
            return () => quit(); // Отписка при закрытии компонента
        }, []);
    // Функция скролла теперь принимает тип анимации

    const scrollToBottom = (behavior = "auto") => {

        if (messagesEndRef.current) {

            messagesEndRef.current.scrollIntoView({ behavior });

        }

    };


    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            // 1. Передаем токен в Go
            SetToken(token).then(() => {
                // 2. Инициируем соединение
                Connect();
            });
        }
    }, []);
        // 1. Загрузка при смене чата

    useEffect(() => {

        if (chatId) {
            const token = localStorage.getItem('jwt_token');
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