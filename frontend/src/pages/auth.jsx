import React, { useState } from 'react';
import './auth.css'
// Импортируем биндинги (путь может зависеть от твоих настроек wails)
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
                alert("Регистрация успешна! Теперь войдите.");
                setIsRegister(false);
                setForm({ user: '', pass: '', email: '', phone: '' });
            } else {
                // Вызываем метод из Go
                const data = await Login(form.user, form.pass);
                // Передаем данные в родительский компонент
                onLogin(data.token, data.username, data.id); 
            }
        } catch (err) {
            // Ошибки из Go придут прямо сюда
            setError(err.toString());
        }
    };

    return (
        <div className='container'>
            <form onSubmit={handleSubmit} className='form'>
                <h2>{isRegister ? 'Создать аккаунт' : 'Добро пожаловать!'}</h2>
                {error && <p style={{ color: '#f04747', fontSize: '14px' }}>{error}</p>}

                <input 
                    type="text" 
                    placeholder="Логин"
                    value={form.user}
                    className="auth-input"
                    onChange={e => setForm({...form, user: e.target.value})}
                    required 
                />
                
                <input 
                    type="password" 
                    placeholder="Пароль"
                    value={form.pass}
                    className="auth-input"
                    onChange={e => setForm({...form, pass: e.target.value})}
                    required 
                />

                {isRegister && (
                    <>
                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={form.email}
                            className="auth-input"
                            onChange={e => setForm({...form, email: e.target.value})}
                        />
                        <input 
                            type="text" 
                            placeholder="Телефон" 
                            value={form.phone}
                            className="auth-input"
                            onChange={e => setForm({...form, phone: e.target.value})}
                        />
                    </>
                )}
                <button type="submit" className='button'>
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>

                <p onClick={() => setIsRegister(!isRegister)} className='switch-text'>
                    {isRegister ? 'Уже есть аккаунт?' : 'Нужен аккаунт?'}
                </p>
            </form>
        </div>
    );
}

export default Auth;