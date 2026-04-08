import './mainHeader.css'

function MainHeader({handleLogout, username, setChat, setChatName, setView}){
    const toMain = () => {
        localStorage.removeItem("lastActiveChatId")
        localStorage.removeItem("lastChatName")
        setChat("");
        setChatName("");
        setView("chats")
    }
    return (
            <header className="main-header">
                <button 
                className="preview"
                title="Вернуться на главную"
                onClick={toMain}
                >
                    <nav>POSTLY</nav>
                </button>
                <div className='right-group'>
                    <nav className='username'>{username}</nav>
                    <button className='btn-exit' onClick={handleLogout}>Выйти</button>
                </div>
            </header>
        );
};

export default MainHeader;