import React, { useState } from 'react';
import './auth.css';
import { Login, Register } from '@bindings/client/pages/authservice';

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
            try {
                setError(JSON.parse(err.message).message);
            } catch {
                setError('Ошибка входа. Попробуйте снова.');
            }
        }
    };

    return (
        <div className='auth-container'>
            <form onSubmit={handleSubmit} className='form'>
                {/* Лого */}
                <div className="form-logo">✦ Postly</div>

                <h2>{isRegister ? 'Создать аккаунт' : 'Добро пожаловать!'}</h2>

                {error && <p className="auth-error">{error}</p>}

                <input
                    type="text"
                    placeholder="Логин"
                    value={form.user}
                    className="auth-input"
                    onChange={e => setForm({...form, user: e.target.value})}
                    required
                    autoComplete="username"
                />

                <input
                    type="password"
                    placeholder="Пароль"
                    value={form.pass}
                    className="auth-input"
                    onChange={e => setForm({...form, pass: e.target.value})}
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                />

                {isRegister && (
                    <>
                        <input
                            type="email"
                            placeholder="Email"
                            value={form.email}
                            className="auth-input"
                            onChange={e => setForm({...form, email: e.target.value})}
                            autoComplete="email"
                        />
                        <input
                            type="tel"
                            placeholder="Телефон"
                            value={form.phone}
                            className="auth-input"
                            onChange={e => setForm({...form, phone: e.target.value})}
                            autoComplete="tel"
                        />
                    </>
                )}

                <button type="submit" className='button'>
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>

                <p onClick={() => { setIsRegister(!isRegister); setError(''); }} className='switch-text'>
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
