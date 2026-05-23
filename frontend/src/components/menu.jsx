import './menu.css'
import groupsIcon from '../assets/images/group.svg'
import chatsIcon from '../assets/images/messages.svg'
import optionsIcon from '../assets/images/options.svg'
import { useEffect, useRef } from 'react';

function Menu({ setView, isOpen, onClose, username, onLogout }) {
    const menuRef = useRef(null);

    useEffect(() => {
        console.log('Menu isOpen changed:', isOpen);
        console.log('Menu element:', menuRef.current);
        if (menuRef.current) {
            const styles = window.getComputedStyle(menuRef.current);
            console.log('Menu transform:', styles.transform);
        }
    }, [isOpen]);

    const handleOptionsClick = () => {
        
    }
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
        if (onClose) onClose();
    };

    return (
        <div 
            ref={menuRef}
            className={`menu ${isOpen ? 'open' : ''}`}
        >
            {/* Верхняя часть - кнопки чатов и групп */}
            <div className="menu-top">
                <div className="menu-item">
                    <button className="menu-button" onClick={handleChatsClick}>
                        <img src={chatsIcon} className="menu-icon" alt="chats" />
                    </button>
                    <span className="menu-label">Чаты</span>
                </div>
                <div className="menu-item">
                    <button className="menu-button" onClick={handleGroupsClick}>
                        <img src={groupsIcon} className="menu-icon" alt="groups" />
                    </button>
                    <span className="menu-label">Группы</span>
                </div>
            </div>
            
            {/* Средняя часть — настройки */}
            <div className="menu-middle">
                <div className="menu-item">
                    <button className="menu-button" onClick={handleOptionsClick}>
                        <img src={optionsIcon} className="menu-icon" alt="options" />
                    </button>
                    <span className="menu-label">Настройки</span>
                </div>
            </div>
            
            {/* Нижняя часть - пользователь и выход */}
            <div className="menu-bottom">
                <div className="menu-username">{username}</div>
                <button className="menu-logout-btn" onClick={handleLogout}>
                    Выйти
                </button>
            </div>
        </div>
    )
}

export default Menu;