import './ImageViewer.css';
import { useEffect, useState } from 'react';
import { downloadFile } from '../lib/api';

// Полноэкранный просмотр картинки из сообщения
export default function ImageViewer({ src, downloadUrl = src, onClose }) {
    const [contextMenu, setContextMenu] = useState(null);
    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        document.addEventListener('click', closeMenu);
        return () => document.removeEventListener('click', closeMenu);
    }, []);

    const close = e => {
        e.stopPropagation();
        onClose();
    };
    const openContextMenu = e => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <div className="image-preview-overlay" onClick={onClose}>
            <button className="image-preview-close" type="button" aria-label="Закрыть" onClick={close}>×</button>
            <img src={src} alt="Предпросмотр" onClick={close} onContextMenu={openContextMenu} />
            {contextMenu && (
                <div
                    className="image-preview-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setContextMenu(null);
                            downloadFile(downloadUrl, 'image').catch(err => console.error('Ошибка скачивания изображения:', err));
                        }}
                    >
                        Сохранить как...
                    </button>
                </div>
            )}
        </div>
    );
}
