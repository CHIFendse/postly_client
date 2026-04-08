import React, { useState } from 'react';
import './auth.css'

function Auth({ onLogin }) {
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        user: '',
        pass: '',
        email: '',
        phone: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const endpoint = isRegister ? '/register' : '/login';
        
        try {
            const response = await fetch(`http://84.22.132.243:8081${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.user,
                    password: form.pass,
                    email: form.email,
                    phone: form.phone
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка сервера');
            }

            if (isRegister) {
                alert("Регистрация успешна! Теперь войдите.");
                setIsRegister(false);
                setForm({ user: '', pass: '', email: '', phone: '' });
            } else {
                onLogin(data.token, data.username, data.id); 
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className='container'>
            <form onSubmit={handleSubmit} className='form'>
                <h2>{isRegister ? 'Создать аккаунт' : 'Добро пожаловать!'}</h2>
                {error && <p style={{ color: '#f04747' }}>{error}</p>}

                <input 
                    type="text" 
                    placeholder="Логин"
                    value={form.user}
                    style={styles.input}
                    onChange={e => setForm({...form, user: e.target.value})}
                    required 
                />
                
                <input 
                    type="password" 
                    placeholder="Пароль"
                    value={form.pass}
                    style={styles.input}
                    onChange={e => setForm({...form, pass: e.target.value})}
                    required 
                />

                {isRegister && (
                    <>
                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={form.email}
                            style={styles.input}
                            onChange={e => setForm({...form, email: e.target.value})}
                        />
                        <input 
                            type="text" 
                            placeholder="Телефон" 
                            value={form.phone}
                            style={styles.input}
                            onChange={e => setForm({...form, phone: e.target.value})}
                        />
                    </>
                )}
                <button type="submit" className='button'>
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>

                <p 
                    onClick={() => setIsRegister(!isRegister)} 
                    className='switch-text'
                >
                    {isRegister ? 'Уже есть аккаунт?' : 'Нужен аккаунт?'}
                </p>
            </form>
        </div>
    );
}

const styles = {
    
};

export default Auth;