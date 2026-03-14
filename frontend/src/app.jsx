import React, { useState, useEffect } from 'react';
import Auth from './pages/auth';
import VoiceChat from './pages/voiceChat'; 
import { SetToken } from '../wailsjs/go/pages/VoiceChat';

function App() {
    const [token, setToken] = useState(() => {
        const saved = localStorage.getItem('jwt_token');
        
        // ЖЕСТКАЯ ПРОВЕРКА: если не строка, если слишком короткий, если мусор
        if (typeof saved !== 'string' || saved.length < 10 || saved === "null" || saved === "undefined") {
            return null;
        }
        return saved;
    });
    
    const [isLoading, setIsLoading] = useState(true);

    // 1. Синхронизация токена с Go-частью
    useEffect(() => {
        if (token) {
            // Как только токен появился или обновился, прокидываем его в VoiceChat.go
            SetToken(token).catch(err => console.error("Ошибка установки токена в Go:", err));
        }
        window.document.title = `Token: ${token ? 'EXISTS' : 'EMPTY'}`;
    }, [token]);

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('http://84.22.132.243:8081/verify', {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 401) {
                    handleLogout(); // Токен реально протух
                } else if (!response.ok) {
                    console.warn("Сервер недоступен, но сессию сохраняем");
                }
            } catch (err) {
                console.error("Ошибка сети при проверке токена");
                // Не разлогиниваем при ошибке сети, чтобы можно было работать офлайн/локально
            } finally {
                setIsLoading(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleLogin = (newToken, newUsername, newUserId) => {
        if (newToken) {
            localStorage.setItem('jwt_token', newToken);
            localStorage.setItem('username', newUsername);
            localStorage.setItem('id', newUserId)
            setToken(newToken);
        }
    };
    // localStorage.removeItem('jwt_token');
    // setToken(null);
    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('username');
        localStorage.removeItem('id');
        localStorage.removeItem('lastActiveChatId')
        setToken(null);
    };

    // БАРЬЕР: Если токена нет (null), мы возвращаем ТОЛЬКО Auth и выходим из функции
    if (token === null) {
        return <Auth onLogin={handleLogin} />;
    }

    if (isLoading) {
        return <div style={{background: '#383731', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Проверка...</div>;
    }

    return (
        <div className="app-container" style={{ backgroundColor: '#383731', minHeight: '100vh', color: 'white' }}>
            <main >
                <VoiceChat token={token} handleLogout={handleLogout} /> 
            </main>
        </div>
    );
}

export default App;