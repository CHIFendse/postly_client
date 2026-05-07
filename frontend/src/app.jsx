import { useState, useEffect } from 'react';
import Auth from './pages/auth';
import VoiceChat from './pages/voiceChat'; 
import { SetToken, Connect } from '@bindings/client/pages/chatws';
// Импортируем наш новый метод из биндингов AuthService
import { VerifyToken } from '@bindings/client/pages/authservice';


function App() {
    const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('jwt_token');
        if (typeof saved !== 'string' || saved.length < 10 || saved === "null" || saved === "undefined") {
            return null;
        }
        return saved;
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isNetworkError, setIsNetworkError] = useState(false);

    useEffect(() => {
        if (token) {
            SetToken(token).catch(err => console.error("Ошибка установки токена в Go:", err));
        }
        window.document.title = `Token: ${token ? 'EXISTS' : 'EMPTY'}`;
    }, [token]);

    useEffect(() => {
        const checkToken = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                // ВЫЗОВ GO-МЕТОДА вместо fetch
                const isValid = await VerifyToken(token);
                
                if (!isValid) {
                    handleLogout();
                }
                setIsNetworkError(false);
            } catch (err) {
                console.error("Ошибка при проверке токена через Go:", err);
                setIsNetworkError(true);
            } finally {
                setIsLoading(false);
            }
        };

        checkToken();
    }, [token]);
    useEffect(() => {
        const initWS = async () => {
            if (token) {
                try {
                    await SetToken(token); // Устанавливаем токен именно для ChatWS
                    await Connect("");     // Коннектимся
                    console.log("WebSocket запущен");
                } catch (err) {
                    console.error(err);
                }
            }
        };

        if (!isLoading && token) {
            initWS();
        }
    }, [token, isLoading]);

    // Обработчики входа/выхода остаются такими же...
    const handleLogin = (newToken, newUsername, newUserId) => {
        if (newToken) {
            localStorage.setItem('jwt_token', newToken);
            localStorage.setItem('username', newUsername);
            localStorage.setItem('id', newUserId)
            setToken(newToken);
        }
    };

    const handleLogout = () => {
        localStorage.clear(); // Быстрый способ очистить всё сразу
        setToken(null);
    };

    // Рендеринг состояний
    if (isNetworkError) {
        return (
            <div style={{background: '#383731', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{color: '#f04747'}}>Нет соединения с сервером :(</span>
            </div>
        );
    }

    if (token === null) {
        return <Auth onLogin={handleLogin} />;
    }

    if (isLoading) {
        return (
            <div style={{background: '#383731', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                Загрузка...
            </div>
        );
    }

    return (
        <div className="app-container" style={{ backgroundColor: '#383731', minHeight: '100vh', color: 'white' }}>
            <main>
                <VoiceChat token={token} handleLogout={handleLogout} /> 
            </main>
        </div>
    );
}

export default App;