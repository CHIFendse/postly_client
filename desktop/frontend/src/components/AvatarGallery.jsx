import { useEffect, useState } from 'react';
import { downloadFile } from '../pages/chat/lib/api';
import './AvatarGallery.css';

export default function AvatarGallery({ avatars, initialIndex = 0, onClose, onDelete }) {
    const [index, setIndex] = useState(initialIndex);
    const [contextMenu, setContextMenu] = useState(null);
    const current = avatars[index];

    useEffect(() => setIndex(Math.min(initialIndex, Math.max(0, avatars.length - 1))), [initialIndex, avatars.length]);

    useEffect(() => {
        const onKeyDown = event => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
            if (event.key === 'ArrowRight') setIndex(value => Math.min(avatars.length - 1, value + 1));
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [avatars.length, onClose]);

    if (!current) return null;

    const showContextMenu = event => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const saveCurrent = () => {
        setContextMenu(null);
        downloadFile(current.downloadUrl, 'avatar').catch(error => console.error('Ошибка скачивания аватарки:', error));
    };

    return (
        <div className="avatar-gallery" onClick={onClose}>
            <button className="avatar-gallery-close" type="button" onClick={onClose} title="Закрыть">×</button>
            <div
                className="avatar-gallery-stage"
                onClick={event => {
                    event.stopPropagation();
                    if (event.target === event.currentTarget) onClose();
                }}
            >
                <button
                    className="avatar-gallery-arrow avatar-gallery-prev"
                    type="button"
                    disabled={index === 0}
                    onClick={() => setIndex(value => Math.max(0, value - 1))}
                    title="Предыдущая аватарка"
                >‹</button>
                <img
                    className="avatar-gallery-image"
                    src={current.src}
                    alt="Аватарка пользователя"
                    onContextMenu={showContextMenu}
                />
                <button
                    className="avatar-gallery-arrow avatar-gallery-next"
                    type="button"
                    disabled={index === avatars.length - 1}
                    onClick={() => setIndex(value => Math.min(avatars.length - 1, value + 1))}
                    title="Следующая аватарка"
                >›</button>
            </div>
            <div
                className="avatar-gallery-bottom"
                onClick={event => {
                    event.stopPropagation();
                    if (event.target === event.currentTarget) onClose();
                }}
            >
                <div className="avatar-gallery-counter">{index + 1} / {avatars.length}</div>
                <div className="avatar-gallery-thumbs">
                    {avatars.map((avatar, avatarIndex) => (
                        <button
                            key={avatar.s3Key || avatar.url || avatarIndex}
                            className={`avatar-gallery-thumb ${avatarIndex === index ? 'active' : ''}`}
                            type="button"
                            onClick={() => setIndex(avatarIndex)}
                        >
                            <img src={avatar.src} alt="" />
                        </button>
                    ))}
                </div>
            </div>
            {contextMenu && (
                <div
                    className="avatar-gallery-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={event => event.stopPropagation()}
                >
                    <button type="button" onClick={saveCurrent}>Сохранить как...</button>
                    {onDelete && (
                        <button type="button" className="danger" onClick={() => {
                            setContextMenu(null);
                            onDelete(current, index);
                        }}>
                            Удалить аватарку
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
