import './createGroupModal.css'
import { useState, useEffect, useRef } from 'react';
import { getAvatarColor, getFirstLetter } from '../utils/avatarHelper';

function CreateGroupModal({ isOpen, onClose, onCreate, token }) {
    const [groupName, setGroupName] = useState("");
    const [searchUser, setSearchUser] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]); // [{username, id}]
    const [avatarColor, setAvatarColor] = useState("#4e5058");
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [searchError, setSearchError] = useState("");
    const fileInputRef = useRef(null);
    const currentUserId = localStorage.getItem("id");

    useEffect(() => {
        if (groupName.trim() !== "") {
            const colors = ['#5865f2', '#57f287', '#eb459e', '#ed4245', '#faa81a', '#9b59b6', '#1abc9c', '#e67e22', '#3498db', '#e74c3c'];
            const index = groupName.trim().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
            setAvatarColor(colors[index]);
        } else {
            setAvatarColor("#4e5058");
        }
    }, [groupName]);

    const handleAddUser = () => {
        const username = searchUser.trim();
        if (username === "") return;
        
        if (selectedUsers.find(u => u.username === username)) {
            setSearchError("Пользователь уже добавлен");
            return;
        }

        // Добавляем только username, без поиска ID
        setSelectedUsers([...selectedUsers, { username }]);
        setSearchUser("");
        setSearchError("");
    };

    const handleRemoveUser = (username) => {
        setSelectedUsers(selectedUsers.filter(u => u.username !== username));
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Размер файла не должен превышать 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setAvatarUrl(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleCreate = () => {
        if (groupName.trim() === "") return;
        
        onCreate({
            admin_id: String(currentUserId),
            name: groupName.trim(),
            is_private: isPrivate,
            members: selectedUsers.map(u => u.username), // Только username'ы
            avatar_color: avatarColor,
            avatar_file: avatarUrl
        });
        
        setGroupName("");
        setSearchUser("");
        setSelectedUsers([]);
        setAvatarUrl(null);
        setIsPrivate(false);
    };

    const handleClose = () => {
        setGroupName("");
        setSearchUser("");
        setSelectedUsers([]);
        setAvatarUrl(null);
        setIsPrivate(false);
        setSearchError("");
        onClose();
    };

    const avatarLetter = groupName.trim() !== "" ? getFirstLetter(groupName) : "";

    if (!isOpen) return null;

    return (
        <div className="create-group-overlay" onClick={handleClose}>
            <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
                <div className="create-group-header">
                    <h3 className="create-group-title">Создать группу</h3>
                    <button className="create-group-close" onClick={handleClose}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                <div className="avatar-section">
                    <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                    <div 
                        className="group-avatar" 
                        style={{ 
                            backgroundColor: avatarUrl ? 'transparent' : (groupName.trim() !== "" ? avatarColor : "#4e5058"),
                            backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                        onClick={handleAvatarClick}
                    >
                        {!avatarUrl && (
                            groupName.trim() !== "" ? (
                                <span>{avatarLetter}</span>
                            ) : (
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                    <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
                                </svg>
                            )
                        )}
                    </div>
                    <span className="avatar-hint">
                        {avatarUrl ? 'Нажмите, чтобы изменить аватар' : 'Добавьте аватар группы'}
                    </span>
                </div>

                <div className="group-name-section">
                    <label className="section-label">Название группы</label>
                    <input
                        type="text"
                        placeholder="Введите название группы"
                        className="create-group-input"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        maxLength={50}
                        autoFocus
                    />
                </div>

                <div className="privacy-section">
                    <label className="section-label">Тип группы</label>
                    <div className="privacy-toggle">
                        <button 
                            className={`privacy-option ${!isPrivate ? 'active' : ''}`}
                            onClick={() => setIsPrivate(false)}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm4 9h-3v3h-2v-3H6V9h3V6h2v3h3v2z" fill="currentColor"/>
                            </svg>
                            <div className="privacy-text">
                                <span className="privacy-label">Публичная</span>
                                <span className="privacy-desc">Любой может найти и вступить</span>
                            </div>
                        </button>
                        <button 
                            className={`privacy-option ${isPrivate ? 'active' : ''}`}
                            onClick={() => setIsPrivate(true)}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M15 8h-1V6c0-2.21-1.79-4-4-4S6 3.79 6 6v2H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2zM8 6c0-1.1.9-2 2-2s2 .9 2 2v2H8V6z" fill="currentColor"/>
                            </svg>
                            <div className="privacy-text">
                                <span className="privacy-label">Приватная</span>
                                <span className="privacy-desc">Только по приглашению</span>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="add-users-section">
                    <label className="section-label">Участники</label>
                    <div className="add-user-row">
                        <input
                            type="text"
                            placeholder="Добавить пользователя"
                            className="add-user-input"
                            value={searchUser}
                            onChange={(e) => {
                                setSearchUser(e.target.value);
                                setSearchError("");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddUser();
                            }}
                        />
                        <button className="add-user-btn" onClick={handleAddUser}>Добавить</button>
                    </div>
                    {searchError && (
                        <div className="search-error">{searchError}</div>
                    )}

                    {selectedUsers.length > 0 && (
                        <div className="selected-users">
                            {selectedUsers.map(user => (
                                <div key={user.username} className="selected-user-tag">
                                    <span>{user.username}</span>
                                    <button 
                                        className="remove-user-btn"
                                        onClick={() => handleRemoveUser(user.username)}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="create-group-actions">
                    <button className="create-group-cancel" onClick={handleClose}>
                        Отмена
                    </button>
                    <button 
                        className="create-group-submit"
                        onClick={handleCreate}
                        disabled={groupName.trim() === ""}
                    >
                        Создать группу
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupModal;