import './mainHeader.css'

function MainHeader({handleLogout, username}){
    // const [isRegister, setIsRegister] = useState(false);
    //     const [error, setError] = useState('');
    //     const [form, setForm] = useState({
    //         user: '',
    //         pass: '',
    //         email: '',
    //         phone: ''
    //     });
    
    //     const handleSubmit = async (e) => {
    //         e.preventDefault();
    //         setError('');
    
    //         const endpoint = isRegister ? '/register' : '/login';
            
    //         try {
    //             const response = await fetch(`http://localhost:8081${endpoint}`, {
    //                 method: 'POST',
    //                 headers: { 'Content-Type': 'application/json' },
    //                 body: JSON.stringify({
    //                     username: form.user,
    //                     password: form.pass,
    //                     email: form.email,
    //                     phone: form.phone
    //                 })
    //             });
    
    //             const data = await response.json();
    
    //             if (!response.ok) {
    //                 throw new Error(data.message || 'Ошибка сервера');
    //             }
    
    //             if (isRegister) {
    //                 alert("Регистрация успешна! Теперь войдите.");
    //                 setIsRegister(false);
    //                 setForm({ user: '', pass: '', email: '', phone: '' }); // Очистка для входа
    //             } else {
    //                 onLogin(data.token); 
    //             }
    //         } catch (err) {
    //             setError(err.message);
    //         }
    //     };
    return (
            <header className="main-header">
                <nav className="preview">
                    <span>POSTLY</span>
                </nav>
                <div className='right-group'>
                    <nav className='username'>{username}</nav>
                    <button className='btn-exit' onClick={handleLogout}>Выйти</button>
                </div>
            </header>
        );
};

export default MainHeader;