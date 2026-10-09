import './AttachmentPreview.css';
import { FileIcon, SendIcon } from './icons';
import { formatFileSize } from '../lib/format';
import { getFileBaseName, getFileExtension, isImageType } from '../lib/files';

const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function AttachmentNameInput({ name, onRename }) {
    return (
        <div className="chat-attachment-name-row">
            <input
                id="attachment-name"
                type="text"
                value={getFileBaseName(name)}
                onChange={e => onRename(e.target.value)}
                spellCheck="false"
                aria-label="Имя файла"
            />
            <span className="chat-attachment-extension">{getFileExtension(name)}</span>
        </div>
    );
}

function ImageCropStage({ attachment, crop }) {
    const { frame } = crop;
    return (
        <div ref={crop.stageRef} className="chat-attachment-image-stage">
            <img
                ref={crop.imageRef}
                className="chat-attachment-crop-image"
                src={attachment.url}
                alt={attachment.name}
                draggable="false"
                onLoad={crop.onImageLoad}
                style={{ width: `${crop.imageSize.width}px`, height: `${crop.imageSize.height}px` }}
            />

            {frame && (
                <div
                    className="chat-attachment-image"
                    onPointerDown={crop.onFramePointerDown}
                    onPointerMove={crop.onFramePointerMove}
                    onPointerUp={crop.onFramePointerUp}
                    onPointerCancel={crop.onFramePointerUp}
                    style={{
                        left: `${frame.left}px`,
                        top: `${frame.top}px`,
                        width: `${frame.width}px`,
                        height: `${frame.height}px`
                    }}
                >
                    <div className="chat-attachment-crop-grid" />
                    <span className="crop-corner crop-corner-tl" />
                    <span className="crop-corner crop-corner-tr" />
                    <span className="crop-corner crop-corner-bl" />
                    <span className="crop-corner crop-corner-br" />
                    {RESIZE_DIRECTIONS.map(direction => (
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
    );
}

// Окно перед отправкой вложения: кадрирование фото и переименование
export default function AttachmentPreview({ attachment, crop, isSending, onRename, onCancel, onSend }) {
    const isImage = isImageType(attachment.type);

    return (
        <div
            className="chat-attachment-preview"
            role="dialog"
            aria-modal="true"
            aria-label="Предпросмотр вложения"
            onClick={e => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div className="chat-attachment-preview-backdrop" onClick={onCancel} />

            <div className="chat-attachment-preview-panel" onClick={e => e.stopPropagation()}>
                <div className="chat-attachment-preview-header">
                    <button
                        className="chat-attachment-preview-close"
                        type="button"
                        aria-label="Закрыть"
                        title="Закрыть"
                        onClick={onCancel}
                    >×</button>
                    <div className="chat-attachment-preview-title">
                        {isImage ? 'Отправить фото' : 'Отправить файл'}
                    </div>
                    <div className="chat-attachment-preview-header-meta">
                        {formatFileSize(attachment.size)}
                    </div>
                </div>

                {isImage ? (
                    <>
                        <ImageCropStage attachment={attachment} crop={crop} />
                        <div className="chat-attachment-toolbar">
                            <div className="chat-attachment-caption-row">
                                <div className="chat-attachment-caption-icon">✎</div>
                                <AttachmentNameInput name={attachment.name} onRename={onRename} />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="chat-attachment-file-layout">
                        <div className="chat-attachment-file">
                            <div className="chat-attachment-file-icon">
                                <FileIcon size={38} strokeWidth={1.7} />
                            </div>
                            <div className="chat-attachment-file-info">
                                <div className="chat-attachment-file-name">{attachment.name}</div>
                                <div className="chat-attachment-file-size">{formatFileSize(attachment.size)} · {attachment.type || 'Файл'}</div>
                            </div>
                        </div>

                        <div className="chat-attachment-file-name-edit">
                            <div className="chat-attachment-caption-icon">✎</div>
                            <AttachmentNameInput name={attachment.name} onRename={onRename} />
                        </div>
                    </div>
                )}

                <div className="chat-attachment-preview-footer">
                    <button className="chat-attachment-cancel" type="button" onClick={onCancel}>
                        Отмена
                    </button>
                    <button
                        className="chat-attachment-confirm"
                        type="button"
                        onClick={onSend}
                        disabled={isSending}
                    >
                        {isSending
                            ? <div className="message-upload-spinner chat-attachment-confirm-spinner" />
                            : <SendIcon />}
                        Отправить
                    </button>
                </div>
            </div>
        </div>
    );
}
