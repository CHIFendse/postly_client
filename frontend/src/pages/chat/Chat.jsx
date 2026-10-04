import './Chat.css';
import { useEffect, useRef, useState } from 'react';
import { DeleteMessage } from '@bindings/client/pages/chat';
import Header from '../../components/header';
import UserProfile from '../../components/userProfile';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import AttachmentPreview from './components/AttachmentPreview';
import MessageContextMenu from './components/MessageContextMenu';
import ImageViewer from './components/ImageViewer';
import useChatMessages from './hooks/useChatMessages';
import useMessageSender from './hooks/useMessageSender';
import useTypingNotifier from './hooks/useTypingNotifier';
import useMessageContextMenu from './hooks/useMessageContextMenu';
import useImageCrop from './hooks/useImageCrop';
import { downloadFile } from './lib/api';
import { cropImage } from './lib/cropImage';
import { createAttachment, isImageType, renameAttachment } from './lib/files';
import { getAvatarColor } from '../../utils/avatarHelper';
import { isTmpId } from './lib/messages';

function Chat({
    chatId,
    chatName,
    chatUserId,
    token,
    searchQuery = '',
    searchNavIdx = 0,
    onMatchesFound,
    onMessageSent,
    onMenuToggle
}) {
    const { messages, isLoading, typingUser, updateMessages } = useChatMessages(chatId, token, onMessageSent);
    const { sendMessage, retryMessage } = useMessageSender({ token, updateMessages });
    const typing = useTypingNotifier(chatId);
    const ctx = useMessageContextMenu();

    const [inputText, setInputText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const crop = useImageCrop(isImageType(attachment?.type) ? attachment.url : null);

    const inputTextRef = useRef('');
    const attachmentRef = useRef(null);
    const sendingRef = useRef(false);
    const handleSendRef = useRef(null);

    const replaceAttachment = (next, { revoke = true } = {}) => {
        const prev = attachmentRef.current;
        if (revoke && prev?.url && prev.url !== next?.url) URL.revokeObjectURL(prev.url);
        attachmentRef.current = next;
        setAttachment(next);
    };

    const setText = text => {
        inputTextRef.current = text;
        setInputText(text);
    };

    useEffect(() => {
        ctx.close();
        setPreviewImage(null);
        setIsProfileOpen(false);
        replaceAttachment(null);
    }, [chatId]);

    useEffect(() => () => {
        if (attachmentRef.current?.url) URL.revokeObjectURL(attachmentRef.current.url);
    }, []);

    useEffect(() => {
        if (!attachment && !previewImage) return undefined;

        const handleKey = e => {
            if (e.key === 'Enter') {
                if (previewImage || !attachment || e.defaultPrevented) return;
                if (e.shiftKey || e.isComposing || e.repeat) return;
                e.preventDefault();
                handleSendRef.current?.();
                return;
            }
            if (e.key !== 'Escape') return;
            if (previewImage) setPreviewImage(null);
            else replaceAttachment(null);
        };

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [attachment, previewImage]);

    const handleSend = async () => {
        if (sendingRef.current) return;
        const text = inputTextRef.current.trim();
        const current = attachmentRef.current;
        const targetChatId = chatId;
        if ((!text && !current) || !targetChatId) return;

        sendingRef.current = true;
        setIsSending(true);
        try {
            let toSend = current;
            const region = isImageType(current?.type) ? crop.getRegion() : null;
            if (region) {
                try {
                    toSend = await cropImage(current, region);
                } catch (err) {
                    console.error('Ошибка кадрирования изображения:', err);
                }
            }
            typing.cancel();
            setText('');
            replaceAttachment(null, { revoke: false });
            sendMessage(targetChatId, text, toSend);
        } finally {
            sendingRef.current = false;
            setIsSending(false);
        }
    };
    handleSendRef.current = handleSend;

    const handleKeyDown = e => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (!e.repeat) handleSend();
    };

    const handleCopy = () => {
        if (ctx.menu?.text) navigator.clipboard?.writeText(ctx.menu.text).catch(() => {});
        ctx.close();
    };

    const handleDelete = async () => {
        const menu = ctx.menu;
        ctx.close();
        if (!menu?.canDelete) return;

        const id = menu.msgId;
        const targetChatId = chatId;
        const removeById = list => list.filter(m => String(m.id) !== String(id));

        // Неотправленное сообщение живёт только локально
        if (isTmpId(id)) {
            const local = messages.find(m => m.id === id);
            if (local?.status !== 'error') return;
            if (local.attachment?.url) URL.revokeObjectURL(local.attachment.url);
            updateMessages(targetChatId, removeById);
            return;
        }

        try {
            await DeleteMessage(String(id), localStorage.getItem('jwt_token'));
            updateMessages(targetChatId, removeById);
        } catch (err) {
            console.error('deleteMessage error:', err);
        }
    };

    const openFile = (url, name) => {
        if (!url) return;
        downloadFile(url, name).catch(err => console.error('Ошибка скачивания файла:', err));
    };

    if (!chatId) return (
        <div className="chat-placeholder">
            <div className="placeholder-content"><p>Выберите чат</p></div>
        </div>
    );

    return (
        <div className="chat-window" onClick={ctx.close}>
            <Header
                token={token}
                chatName={chatName}
                chatId={chatId}
                onMenuToggle={onMenuToggle}
                onProfileToggle={() => setIsProfileOpen(prev => !prev)}
            />

            <div className="chat-main">
                <div className="chat-content">
                    <MessageList
                        chatId={chatId}
                        messages={messages}
                        isLoading={isLoading}
                        searchQuery={searchQuery}
                        searchNavIdx={searchNavIdx}
                        onMatchesFound={onMatchesFound}
                        bubbleHandlers={{
                            ...ctx.bubbleHandlers,
                            onRetry: msg => retryMessage(chatId, msg),
                            onOpenImage: (src, downloadUrl) => setPreviewImage({ src, downloadUrl }),
                            onOpenFile: openFile
                        }}
                    />

                    <ChatInput
                        value={inputText}
                        typingUser={typingUser}
                        onChange={text => {
                            setText(text);
                            typing.notify();
                        }}
                        onKeyDown={handleKeyDown}
                        onSend={handleSend}
                        onFileSelect={file => {
                            const next = createAttachment(file);
                            if (next) replaceAttachment(next);
                        }}
                    />
                </div>

                {isProfileOpen && (
                    <UserProfile
                        chatName={chatName}
                        chatId={chatId}
                        userId={chatUserId}
                        onClose={() => setIsProfileOpen(false)}
                        getAvatarColor={getAvatarColor}
                    />
                )}
            </div>

            {attachment && (
                <AttachmentPreview
                    attachment={attachment}
                    crop={crop}
                    isSending={isSending}
                    onRename={raw => replaceAttachment(renameAttachment(attachmentRef.current, raw))}
                    onCancel={() => replaceAttachment(null)}
                    onSend={handleSend}
                />
            )}

            {ctx.menu && (
                <MessageContextMenu menu={ctx.menu} onCopy={handleCopy} onDelete={handleDelete} />
            )}

            {previewImage && (
                <ImageViewer src={previewImage.src} downloadUrl={previewImage.downloadUrl} onClose={() => setPreviewImage(null)} />
            )}
        </div>
    );
}

export default Chat;
