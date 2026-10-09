import './mainHeader.css'

function MainHeader({handleLogout, username, setChat, setChatName, setView}){
    const toMain = () => {
        localStorage.removeItem("lastActiveChatId")
        localStorage.removeItem("lastChatName")
        setChat("");
        setChatName("");
        setView("chats")
        localStorage.setItem("lastView", "chats");
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
        </header>
    );
};

export default MainHeader;