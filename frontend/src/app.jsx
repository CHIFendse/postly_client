import { useState, useEffect } from 'react';
import Auth from './pages/auth';
import VoiceChat from './pages/voiceChat';
import { ThemeProvider } from './context/ThemeContext';
import { SetToken, Connect } from '@bindings/client/pages/chatws';
import { VerifyToken } from '@bindings/client/pages/authservice';

/* ──────────────────────────────────────────────
   Экран-заглушка (загрузка / ошибка)
   ────────────────────────────────────────────── */
function FullscreenScreen({ children }) {
    return (
        <div style={{
            height: '100vh',
            background: 'var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            color: 'var(--txt-secondary)',
            fontSize: '15px',
            fontFamily: 'inherit',
        }}>
            {children}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Спиннер загрузки
   ────────────────────────────────────────────── */
function LoadingSpinner() {
    return (
        <FullscreenScreen>
            <div style={{
                width: '32px', height: '32px',
                border: '3px solid var(--clr-primary-dim)',
                borderTopColor: 'var(--clr-primary)',
                borderRadius: '50%',
                animation: 'spinGlobal 0.9s linear infinite',
            }} />
            <span>Загрузка...</span>
            <style>{`
                @keyframes spinGlobal {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </FullscreenScreen>
    );
}

/* ──────────────────────────────────────────────
   App
   ────────────────────────────────────────────── */
function App() {
    const [token, setToken] = useState(localStorage.getItem('jwt_token'));
    const [isLoading, setIsLoading] = useState(true);
    const [isNetworkError, setIsNetworkError] = useState(false);

    // Проверяем токен при старте
    useEffect(() => {
        const checkToken = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const isValid = await VerifyToken(token);
                if (!isValid) handleLogout();
                setIsNetworkError(false);
            } catch (err) {
                console.error("Ошибка проверки токена:", err);
                setIsNetworkError(true);
            } finally {
                setIsLoading(false);
            }
        };
        checkToken();
    }, [token]);

    // Поднимаем WebSocket после успешной загрузки
    useEffect(() => {
        if (!isLoading && token) {
            (async () => {
                try {
                    await SetToken(token);
                    await Connect("");
                    console.log("WebSocket запущен");
                } catch (err) {
                    console.error("WS ошибка:", err);
                }
            })();
        }
    }, [token, isLoading]);

    const handleLogin = (newToken, newUsername, newUserId) => {
        if (newToken) {
            localStorage.setItem('jwt_token', newToken);
            localStorage.setItem('username', newUsername);
            localStorage.setItem('id', newUserId);
            setToken(newToken);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        setToken(null);
    };

    // ── Экраны ──
    if (isNetworkError) {
        return (
            <FullscreenScreen>
                <span style={{ fontSize: '32px' }}>🔌</span>
                <span style={{ color: 'var(--clr-danger)', fontWeight: 600 }}>
                    Нет соединения с сервером
                </span>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        marginTop: '8px',
                        padding: '9px 20px',
                        background: 'var(--clr-primary)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '14px',
                    }}
                >
                    Повторить
                </button>
            </FullscreenScreen>
        );
    }

    if (isLoading) return <LoadingSpinner />;

    if (token === null) return <Auth onLogin={handleLogin} />;

    return <VoiceChat token={token} handleLogout={handleLogout} />;
}

/* ──────────────────────────────────────────────
   Root: оборачиваем в ThemeProvider
   ────────────────────────────────────────────── */
export default function Root() {
    return (
        <ThemeProvider>
            <App />
        </ThemeProvider>
    );
}
