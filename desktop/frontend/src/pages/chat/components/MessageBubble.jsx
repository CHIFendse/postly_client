import './MessageBubble.css';
import HighlightText from './HighlightText';
import MessageAttachment from './MessageAttachment';
import { formatTime, getMessageAttachment, isMine } from '../lib/messages';

export default function MessageBubble({
    msg,
    bubbleRef,
    searchQuery,
    isMatch,
    isActive,
    onContextMenu,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onRetry,
    onOpenImage,
    onOpenFile
}) {
    const mine = isMine(msg.sender_id);
    const att = getMessageAttachment(msg);
    const isImage = att?.kind === 'image';
    const failed = msg.status === 'error';
    const timeStr = formatTime(msg.created_at);

    const className = [
        'message-bubble',
        mine ? 'sent' : 'received',
        isImage && 'has-image',
        isImage && !msg.text && 'media-only',
        failed && 'is-failed',
        isActive ? 'msg-search-active' : isMatch && 'msg-search-match'
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={bubbleRef}
            className={className}
            onContextMenu={e => {
                e.stopPropagation();
                onContextMenu(e, msg);
            }}
            onTouchStart={e => onTouchStart(e, msg)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={e => e.stopPropagation()}
        >
            {!mine && <div className="message-sender">{msg.username}</div>}

            {att && (
                <MessageAttachment
                    attachment={att}
                    status={msg.status}
                    progress={msg.progress}
                    onOpenImage={onOpenImage}
                    onOpenFile={onOpenFile}
                />
            )}

            <div className="message-text">
                <HighlightText text={msg.text || ''} query={searchQuery} active={isActive} />
            </div>
            <div className="message-meta">
                {failed && (
                    <button
                        className="message-retry"
                        type="button"
                        title="Отправить ещё раз"
                        onClick={e => {
                            e.stopPropagation();
                            onRetry(msg);
                        }}
                    >
                        Не отправлено · Повторить
                    </button>
                )}
                {timeStr && <span className="message-time">{timeStr}</span>}
            </div>
        </div>
    );
}
