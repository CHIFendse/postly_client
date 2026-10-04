import './ChatInput.css';
import { useEffect, useRef, useState } from 'react';
import { FileIcon, ImageIcon, PaperclipIcon, SendIcon } from './icons';

export default function ChatInput({ value, typingUser, onChange, onKeyDown, onSend, onFileSelect }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Клик мимо меню вложений закрывает его
    useEffect(() => {
        if (!menuOpen) return undefined;
        const close = () => setMenuOpen(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [menuOpen]);

    const handleFileChange = e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        setMenuOpen(false);
        if (file) onFileSelect(file);
    };

    return (
        <div className="chat-input-container">
            <div className={`typing-indicator ${typingUser ? '' : 'hidden'}`}>
                <div className="typing-dots"><span></span><span></span><span></span></div>
                <span className="typing-name">
                    {typingUser ? `${typingUser} печатает` : ''}
                </span>
            </div>

            <div className="chat-attach-wrapper">
                <button
                    className="chat-attach-btn"
                    type="button"
                    aria-label="Прикрепить файл"
                    title="Прикрепить файл"
                    onClick={e => {
                        e.stopPropagation();
                        setMenuOpen(prev => !prev);
                    }}
                >
                    <PaperclipIcon className="chat-attach-icon" />
                </button>

                {menuOpen && (
                    <div className="attachment-menu" onClick={e => e.stopPropagation()}>
                        <button className="attachment-menu-item" type="button" onClick={() => imageInputRef.current?.click()}>
                            <span className="attachment-menu-icon"><ImageIcon /></span>
                            <span>Изображение</span>
                        </button>
                        <button className="attachment-menu-item" type="button" onClick={() => fileInputRef.current?.click()}>
                            <span className="attachment-menu-icon"><FileIcon size={19} /></span>
                            <span>Файл</span>
                        </button>
                    </div>
                )}

                <input
                    ref={imageInputRef}
                    className="chat-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <input
                    ref={fileInputRef}
                    className="chat-file-input"
                    type="file"
                    onChange={handleFileChange}
                />
            </div>

            <div className="chat-input-wrapper">
                <input
                    type="text"
                    placeholder="Напишите сообщение..."
                    className="chat-input"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                />
                <button className="chat-send-btn" onClick={onSend} type="button">
                    <SendIcon />
                </button>
            </div>
        </div>
    );
}
