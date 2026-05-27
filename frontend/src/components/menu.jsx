import './menu.css';
import groupsIcon from '../assets/images/group.svg';
import chatsIcon  from '../assets/images/messages.svg';

function Menu({ setView, isOpen, onClose, username, onLogout, onSettingsClick, currentView }) {

    const handleChatsClick = () => {
        setView('chats');
        localStorage.setItem("lastView", "chats");
    };

    const handleGroupsClick = () => {
        setView('groups');
        localStorage.setItem("lastView", "groups");
    };

    const handleLogout = () => {
        if (onLogout) onLogout();
        if (onClose)  onClose();
    };

    return (
        <div className={`menu ${isOpen ? 'open' : ''}`}>

            {/* ── Верх: навигация ── */}
            <div className="menu-top">
                {/* Чаты */}
                <div className="menu-item">
                    <button
                        className={`menu-button ${currentView === 'chats' ? 'menu-btn-active' : ''}`}
                        onClick={handleChatsClick}
                        title="Чаты"
                    >
                        <img src={chatsIcon} className="menu-icon" alt="chats" />
                    </button>
                    <span className="menu-label">Чаты</span>
                </div>

                {/* Группы */}
                <div className="menu-item">
                    <button
                        className={`menu-button ${currentView === 'groups' ? 'menu-btn-active' : ''}`}
                        onClick={handleGroupsClick}
                        title="Группы"
                    >
                        <img src={groupsIcon} className="menu-icon" alt="groups" />
                    </button>
                    <span className="menu-label">Группы</span>
                </div>
            </div>

            {/* ── Середина: настройки ── */}
            <div className="menu-middle">
                <div className="menu-item">
                    <button
                        className="menu-button"
                        onClick={() => { onSettingsClick(); onClose?.(); }}
                        title="Настройки"
                    >
                        {/* Иконка шестерёнки (SVG встроена, без зависимости от файла) */}
                        <svg
                            width="26" height="26"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="menu-icon-svg"
                        >
                            <path
                                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                                stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round"
                            />
                            <path
                                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                                stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    <span className="menu-label">Настройки</span>
                </div>
            </div>

            {/* ── Низ: пользователь + выход ── */}
            <div className="menu-bottom">
                <div className="menu-username" title={username}>{username}</div>
                <button className="menu-logout-btn" onClick={handleLogout}>
                    Выйти
                </button>
            </div>
        </div>
    );
}

export default Menu;
