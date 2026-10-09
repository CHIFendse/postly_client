import { useEffect, useState } from 'react';
import useFileObjectUrl from '../hooks/useFileObjectUrl';
import { downloadFile } from '../lib/api';
import './MessageImage.css';

export default function MessageImage({ fileUrl, alt, onOpen }) {
    const { src, error } = useFileObjectUrl(fileUrl);
    const [failed, setFailed] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    useEffect(() => setFailed(false), [src]);
    useEffect(() => {
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const handleContextMenu = e => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    if (error || failed) {
        return <div className="message-attachment-image-failed">Изображение недоступно</div>;
    }
    if (!src) {
        return (
            <div className="message-attachment-image-loading">
                <div className="message-upload-spinner" />
            </div>
        );
    }
    return (
        <>
        <img
            className="message-attachment-image"
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            onContextMenu={handleContextMenu}
            onClick={e => {
                e.stopPropagation();
                onOpen(src, fileUrl);
            }}
        />
        {contextMenu && (
            <div
                className="message-image-context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => {
                        setContextMenu(null);
                        downloadFile(fileUrl, alt || 'image').catch(err => console.error('Ошибка скачивания изображения:', err));
                    }}
                >
                    Сохранить как...
                </button>
            </div>
        )}
        </>
    );
}
