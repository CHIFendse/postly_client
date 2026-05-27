import React, { useState } from 'react';
import './auth.css';
import { Login, Register } from '@bindings/client/pages/authservice';

/* Парсим ошибку из Go-биндинга (может быть JSON, строка или объект) */
function parseGoError(err) {
    try {
        // Go-биндинги бросают строки; внутри может быть JSON
        const raw = typeof err === 'string' ? err : (err?.message ?? String(err));
        const parsed = JSON.parse(raw);
        return parsed.message || parsed.error || parsed.detail || raw;
    } catch {
        // Не JSON — возвращаем как есть
        const raw = typeof err === 'string' ? err : (err?.message ?? String(err));
        if (raw && raw !== 'undefined') return raw;
        return 'Произошла ошибка. Попробуйте снова.';
    }
}

function Auth({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ user: '', pass: '', email: '', phone: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isRegister) {
                await Register(form.user, form.pass, form.email, form.phone);
                const data = await Login(form.user, form.pass);
                onLogin(data.token, data.username, data.id);
                setIsRegister(false);
                setForm({ user: '', pass: '', email: '', phone: '' });
            } else {
                const data = await Login(form.user, form.pass);
                onLogin(data.token, data.username, data.id);
            }
        } catch (err) {
            setError(parseGoError(err));
        }
    };

    const switchMode = () => {
        setIsRegister(v => !v);
        setError('');
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="form">
                <div className="form-logo">✦ Postly</div>
                <h2>{isRegister ? 'Создать аккаунт' : 'Добро пожаловать!'}</h2>

                {error && <p className="auth-error">{error}</p>}

                <input
                    type="text"
                    placeholder="Логин"
                    value={form.user}
                    className="auth-input"
                    onChange={e => setForm({ ...form, user: e.target.value })}
                    autoComplete="username"
                    required
                />

                <input
                    type="password"
                    placeholder="Пароль"
                    value={form.pass}
                    className="auth-input"
                    onChange={e => setForm({ ...form, pass: e.target.value })}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    required
                />

                {isRegister && (
                    <>
                        <input
                            type="email"
                            placeholder="Email"
                            value={form.email}
                            className="auth-input"
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            autoComplete="email"
                        />
                        <input
                            type="tel"
                            placeholder="Телефон (+7...)"
                            value={form.phone}
                            className="auth-input"
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            autoComplete="tel"
                        />
                    </>
                )}

                <button type="submit" className="button">
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>

                <p onClick={switchMode} className="switch-text">
                    {isRegister
                        ? <>Уже есть аккаунт? <span>Войти</span></>
                        : <>Нужен аккаунт? <span>Зарегистрироваться</span></>
                    }
                </p>
            </form>
        </div>
    );
}

export default Auth;
