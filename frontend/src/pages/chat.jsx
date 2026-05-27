import './chat.css';
import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { GetMessages } from '@bindings/client/pages/chat';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import { Events } from '@wailsio/runtime';

function Chat({ chatId }) {
    const myId       = localStorage.getItem("id");
    const username   = localStorage.getItem("username");
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const messagesEndRef    = useRef(null);
    const isInitialMount    = useRef(true);
    const [isLoading, setIsLoading] = useState(false);

    // Нормализуем id для надёжного сравнения (int с сервера vs string из localStorage)
    const isMine = (senderId) => String(senderId) === String(myId);

    // ── Очистка при смене чата ──
    useEffect(() => {
        setMessages([]);
        setIsLoading(true);
        isInitialMount.current = true;
    }, [chatId]);

    // ── Загрузка истории ──
    useEffect(() => {
        if (!chatId) return;
        const token = localStorage.getItem('jwt_token');
        setIsLoading(true);
        GetMessages(chatId, token)
            .then(result => setMessages(result || []))
            .catch(err => console.error('Ошибка загрузки:', err))
            .finally(() => setIsLoading(false));
    }, [chatId]);

    // ── WebSocket: получение новых сообщений реал-тайм ──
    useEffect(() => {
        if (!chatId) return;

        const unsubscribe = Events.On("server_message", (event) => {
            const msg = event.data;
            if (!msg || msg.type !== "NEW_MESSAGE") return;

            // Проверяем, что сообщение относится к текущему чату
            if (String(msg.chat_id) !== String(chatId)) return;

            // Чужие сообщения добавляем сразу;
            // свои уже добавлены оптимистично при отправке — пропускаем
            if (isMine(msg.sender_id)) return;

            setMessages(prev => {
                // Дедупликация по id (если у сообщения есть server id)
                if (msg.id && prev.some(m => String(m.id) === String(msg.id))) return prev;
                return [...prev, msg];
            });
        });

        return () => unsubscribe();
    }, [chatId]);

    // ── Скролл к последнему сообщению ──
    useLayoutEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            const behavior = isInitialMount.current ? "auto" : "smooth";
            messagesEndRef.current.scrollIntoView({ behavior });
            isInitialMount.current = false;
        }
    }, [messages]);

    // ── Отправка ──
    const handleSendMessage = async (e) => {
        if (e.key !== 'Enter' || inputText.trim() === "") return;

        const text   = inputText.trim();
        const tempId = `tmp_${Date.now()}`;

        // Оптимистичное добавление
        setMessages(prev => [...prev, {
            id:        tempId,
            chat_id:   chatId,
            sender_id: myId,   // string — чтобы isMine() работал
            username,
            text,
        }]);
        setInputText("");

        try {
            await SendWSMessage(JSON.stringify({
                chat_id:   chatId,
                sender_id: myId,
                text,
                username,
            }));
        } catch (err) {
            console.error("Ошибка отправки:", err);
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
        <div className="chat-window">
            <div className="messages-list">
                {isLoading && (
                    <div className="chat-loading">
                        <div className="spinner" />
                        <p>Загрузка сообщений...</p>
                    </div>
                )}

                {!isLoading && messages.length === 0 && (
                    <div className="no-messages-empty">Сообщений пока нет...</div>
                )}

                {messages.map((msg, index) => (
                    <div
                        key={msg.id || index}
                        className={`message-bubble ${isMine(msg.sender_id) ? 'sent' : 'received'}`}
                    >
                        {/* Имя отправителя — только для чужих сообщений */}
                        {!isMine(msg.sender_id) && (
                            <div className="message-sender">{msg.username}</div>
                        )}
                        <div className="message-text">{msg.text}</div>
                    </div>
                ))}

                <div ref={messagesEndRef} style={{ height: "1px" }} />
            </div>

            <div className="chat-input-container">
                <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    className="chat-input"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleSendMessage}
                />
            </div>
        </div>
    );
}

export default Chat;
