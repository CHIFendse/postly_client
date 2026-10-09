import { useEffect, useRef, useState } from 'react';
import useImageCrop from '../pages/chat/hooks/useImageCrop';
import { cropImage } from '../pages/chat/lib/cropImage';
import { createAttachment, isImageType } from '../pages/chat/lib/files';
import '../pages/chat/components/AttachmentPreview.css';
import './AvatarCropModal.css';

const DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export default function AvatarCropModal({ file, onCancel, onConfirm }) {
    const [attachment] = useState(() => (file ? createAttachment(file) : null));
    const attachmentRef = useRef(attachment);
    const [busy, setBusy] = useState(false);
    const crop = useImageCrop(isImageType(attachment?.type) ? attachment.url : null);

    useEffect(() => () => {
        if (attachmentRef.current?.url) URL.revokeObjectURL(attachmentRef.current.url);
    }, []);

    if (!attachment) return null;

    const confirm = async () => {
        const region = crop.getRegion();
        if (!region) return;
        setBusy(true);
        try {
            const cropped = await cropImage(attachment, region);
            await onConfirm(cropped.file);
        } finally {
            setBusy(false);
        }
    };

    const frame = crop.frame;
    return (
        <div className="avatar-crop-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
            <div className="avatar-crop-panel" onClick={e => e.stopPropagation()}>
                <div className="avatar-crop-header">
                    <strong>Обрезать аватарку</strong>
                    <button type="button" onClick={onCancel} title="Закрыть">×</button>
                </div>
                <div ref={crop.stageRef} className="chat-attachment-image-stage avatar-crop-stage">
                    <img
                        ref={crop.imageRef}
                        className="chat-attachment-crop-image"
                        src={attachment.url}
                        alt="Предпросмотр аватарки"
                        draggable="false"
                        onLoad={crop.onImageLoad}
                        style={{ width: `${crop.imageSize.width}px`, height: `${crop.imageSize.height}px` }}
                    />
                    {frame && (
                        <div
                            className="chat-attachment-image avatar-crop-frame"
                            onPointerDown={crop.onFramePointerDown}
                            onPointerMove={crop.onFramePointerMove}
                            onPointerUp={crop.onFramePointerUp}
                            onPointerCancel={crop.onFramePointerUp}
                            style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
                        >
                            <div className="chat-attachment-crop-grid avatar-crop-grid" />
                            {DIRECTIONS.map(direction => (
                                <span
                                    key={direction}
                                    className={`crop-resize-handle crop-resize-${direction}`}
                                    onPointerDown={e => crop.onResizePointerDown(e, direction)}
                                    onPointerMove={crop.onResizePointerMove}
                                    onPointerUp={crop.onResizePointerUp}
                                    onPointerCancel={crop.onResizePointerUp}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="avatar-crop-footer">
                    <button type="button" onClick={onCancel} disabled={busy}>Отмена</button>
                    <button type="button" onClick={confirm} disabled={busy || !frame}>
                        {busy ? 'Загрузка...' : 'Установить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
