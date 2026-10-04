import './MessageAttachment.css';
import MessageImage from './MessageImage';
import { FileIcon } from './icons';
import { formatFileSize } from '../lib/format';

// Картинка или файл внутри пузыря сообщения, с прогрессом загрузки
export default function MessageAttachment({ attachment: att, status, progress, onOpenImage, onOpenFile }) {
    const uploading = status === 'uploading';
    const pending = uploading || status === 'sending';
    const pct = progress || 0;

    if (att.kind === 'image') {
        return (
            <div className="message-attachment">
                <div className="message-attachment-media">
                    <MessageImage fileUrl={att.url} alt={att.name || 'Изображение'} onOpen={onOpenImage} />
                    {pending && (
                        <div className="message-upload-overlay">
                            <div className="message-upload-spinner" />
                            {uploading && <span>{pct}%</span>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="message-attachment">
            <button
                className={`message-attachment-file${att.url ? ' is-ready' : ''}`}
                type="button"
                title={att.url ? 'Скачать файл' : att.name}
                onClick={e => {
                    e.stopPropagation();
                    onOpenFile(att.url, att.name);
                }}
            >
                <div className="message-attachment-file-icon">
                    {pending ? <div className="message-upload-spinner" /> : <FileIcon size={21} />}
                </div>
                <div className="message-attachment-file-info">
                    <div className="message-attachment-file-name">{att.name}</div>
                    <div className="message-attachment-file-size">
                        {uploading
                            ? `${formatFileSize(att.size * pct / 100)} из ${formatFileSize(att.size)}`
                            : formatFileSize(att.size)}
                    </div>
                    {uploading && (
                        <div className="message-upload-bar">
                            <div style={{ width: `${pct}%` }} />
                        </div>
                    )}
                </div>
            </button>
        </div>
    );
}
