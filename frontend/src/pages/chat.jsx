import './chat.css';
import Header from '../components/header';
import UserProfile from '../components/userProfile';
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { GetMessages, DeleteMessage } from '@bindings/client/pages/chat';
import { SendWSMessage, Connect, SetToken } from '@bindings/client/pages/chatws';
import { Events } from '@wailsio/runtime';
import {
    _msgsCache,
    _fileBlobCache,
    MSGS_TTL,
    applyNewMessage,
    applyNewMessageToCache
} from '../components/messagesCache';
import paperclip from '../assets/images/paperclip.png';

const API_BASE = 'https://api.postly-mes.ru:8081';
// Выдаёт presigned PUT-ссылку в S3 и ключ объекта.
// Ключ уходит в WS как file_url — сервер сам меняет его на ссылку для скачивания.
const UPLOAD_URL_ENDPOINT = `${API_BASE}/getUploadUrl`;
// Сколько ждём NEW_MESSAGE от сервера, прежде чем показать «Не отправлено»
const CONFIRM_TIMEOUT_MS = 20_000;

async function requestUploadUrl(file, token) {
    const r = await fetch(UPLOAD_URL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            file_name: file.name,
            content_type: file.type || 'application/octet-stream'
        })
    });
    if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`getUploadUrl: сервер вернул ${r.status}${body ? ` — ${body}` : ''}`);
    }
    const data = await r.json();
    const uploadUrl = data.upload_url || data.url;
    const s3Key = data.s3_key || data.key;
    if (!uploadUrl || !s3Key) throw new Error('getUploadUrl: в ответе нет upload_url / s3_key');
    return { uploadUrl, s3Key };
}

function putFile(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = e => {
            if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`S3 PUT: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('S3 PUT: ошибка сети'));
        xhr.send(file);
    });
}

async function uploadAttachment(file, token, onProgress) {
    const { uploadUrl, s3Key } = await requestUploadUrl(file, token);
    await putFile(uploadUrl, file, onProgress);
    return s3Key;
}

// Локальное вложение (ещё не отправлено) или поля file_* с сервера → единый вид
function getMessageAttachment(msg) {
    if (msg.attachment) return msg.attachment;
    let kind = [msg.message_type, msg.type].find(t => t === 'image' || t === 'file');
    if (!kind && msg.file_url) {
        kind = /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(msg.file_name || '') ? 'image' : 'file';
    }
    if (!kind) return null;
    return {
        kind,
        url: msg.file_url,
        name: msg.file_name || (kind === 'image' ? 'Изображение' : 'Файл'),
        size: Number(msg.file_size) || 0
    };
}

// file_url с сервера — относительный путь к /file, требует JWT.
// Скачиваем с заголовком и отдаём blob:-ссылку.
async function fetchFileBlob(fileUrl) {
    const tok = localStorage.getItem('jwt_token');
    const res = await fetch(API_BASE + fileUrl, {
        headers: { Authorization: `Bearer ${tok}` }
    });
    if (!res.ok) throw new Error(`/file: ${res.status}`);
    return res.blob();
}

// Кэш на сессию (_fileBlobCache): картинки не перекачиваются при каждом
// рендере и смене чата; чистится в clearMessagesCache при выходе
function loadFileObjectUrl(fileUrl) {
    if (!_fileBlobCache.has(fileUrl)) {
        const p = fetchFileBlob(fileUrl).then(blob => URL.createObjectURL(blob));
        p.catch(() => _fileBlobCache.delete(fileUrl));
        _fileBlobCache.set(fileUrl, p);
    }
    return _fileBlobCache.get(fileUrl);
}

// blob: и абсолютные ссылки используем как есть — токен на чужой хост не отправляем
const isDirectUrl = url => /^(blob:|data:|https?:)/.test(url || '');

function useFileObjectUrl(fileUrl) {
    const [state, setState] = useState({ src: null, error: false });

    useEffect(() => {
        if (!fileUrl) { setState({ src: null, error: true }); return; }
        if (isDirectUrl(fileUrl)) { setState({ src: fileUrl, error: false }); return; }

        let cancelled = false;
        setState({ src: null, error: false });
        loadFileObjectUrl(fileUrl)
            .then(src => { if (!cancelled) setState({ src, error: false }); })
            .catch(err => {
                console.error('Ошибка загрузки вложения:', err);
                if (!cancelled) setState({ src: null, error: true });
            });
        return () => { cancelled = true; };
    }, [fileUrl]);

    return state;
}

async function downloadFile(fileUrl, fileName) {
    const href = isDirectUrl(fileUrl) ? fileUrl : URL.createObjectURL(await fetchFileBlob(fileUrl));
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (href !== fileUrl) setTimeout(() => URL.revokeObjectURL(href), 10000);
}

function MessageImage({ fileUrl, alt, onOpen }) {
    const { src, error } = useFileObjectUrl(fileUrl);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);

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
        <img
            className="message-attachment-image"
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            onClick={e => {
                e.stopPropagation();
                onOpen(src);
            }}
        />
    );
}

function getDateLabel(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - dDay) / 86400000);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    if (diff === 2) return 'Позавчера';
    const opts = d.getFullYear() === new Date().getFullYear()
        ? { day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('ru-RU', opts);
}

function HighlightText({ text, query, active }) {
    if (!query || !text) return <>{text}</>;
    const parts = [];
    const q = query.toLowerCase();
    let searchFrom = 0;
    while (true) {
        const idx = text.toLowerCase().indexOf(q, searchFrom);
        if (idx === -1) { parts.push(text.slice(searchFrom)); break; }
        if (idx > searchFrom) parts.push(text.slice(searchFrom, idx));
        parts.push(
            <mark key={idx} className={active ? 'msg-search-mark-active' : 'msg-search-mark'}>
                {text.slice(idx, idx + q.length)}
            </mark>
        );
        searchFrom = idx + q.length;
    }
    return <>{parts}</>;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

function getAvatarColor(name = '') {
    const colors = [
        '#e67e22', '#3498db', '#9b59b6', '#1abc9c',
        '#e74c3c', '#f1c40f', '#2ecc71', '#34495e'
    ];
    let hash = 0;
    for (let i = 0; i < String(name).length; i++) {
        hash = ((hash << 5) - hash) + String(name).charCodeAt(i);
        hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
}

function Chat({
    chatId,
    chatName,
    token,
    searchQuery = '',
    searchNavIdx = 0,
    onMatchesFound,
    onMessageSent,
    onMenuToggle
}) {
    const myId = localStorage.getItem('id');
    const username = localStorage.getItem('username');
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [ctxMenu, setCtxMenu] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
    const [attachmentImageScale, setAttachmentImageScale] = useState(78);
    const [cropRatio, setCropRatio] = useState('original');
    const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
    const [cropPan, setCropPan] = useState({ x: 0, y: 0 });
    const [imageAspect, setImageAspect] = useState(16 / 9);
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
    const [cropImageScale, setCropImageScale] = useState(null);
    const cropDragRef = useRef(null);
    const cropFrameRef = useRef(null);
    const cropStageRef = useRef(null);
    const cropImageRef = useRef(null);
    const cropResizeRef = useRef(null);
    const [cropStageSize, setCropStageSize] = useState({ width: 0, height: 0 });
    const [cropFrameRect, setCropFrameRect] = useState(null);
    const cropBoxDragRef = useRef(null);
    const messagesEndRef = useRef(null);
    const isInitialMount = useRef(true);
    const listRef = useRef(null);
    const stickToBottomRef = useRef(true);
    const resizeObserverRef = useRef(null);
    const searchQueryRef = useRef(searchQuery);
    searchQueryRef.current = searchQuery;
    const typingClearRef = useRef(null);
    const typingSendRef = useRef(null);
    const longPressRef = useRef(null);
    const suppressClickRef = useRef(false);
    const msgRefs = useRef({});
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatIdRef = useRef(chatId);
    const attachmentRef = useRef(null);
    const inputTextRef = useRef('');
    const sendingRef = useRef(false);
    const inFlightRef = useRef(new Set());
    const handleSendRef = useRef(null);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
    useEffect(() => { attachmentRef.current = attachment; }, [attachment]);

    const prevLayoutRef = useRef(null);

    const calculateAndApplyLayout = useCallback((stageWidth, stageHeight, natW, natH) => {
        if (!stageWidth || !stageHeight || !natW || !natH) return null;

        const fitScale = Math.min(
            (stageWidth - 40) / natW,
            (stageHeight - 40) / natH
        );

        const renderedW = natW * fitScale;
        const renderedH = natH * fitScale;

        const left = Math.round((stageWidth - renderedW) / 2);
        const top = Math.round((stageHeight - renderedH) / 2);
        const width = Math.round(renderedW);
        const height = Math.round(renderedH);

        const newRect = { left, top, width, height };
        
        setCropImageScale(width / natW);

        prevLayoutRef.current = { left, top, renderedW, renderedH };

        setCropFrameRect(prev => {
            const cropW = Math.max(120, Math.round(renderedW));
            const cropH = Math.max(120, Math.round(renderedH));
            const cropLeft = Math.round(left + (renderedW - cropW) / 2);
            const cropTop = Math.round(top + (renderedH - cropH) / 2);

            return { left: cropLeft, top: cropTop, width: cropW, height: cropH };
        });

        return newRect;
    }, []);

    const stageRefCallback = useCallback(node => {
        cropStageRef.current = node;
        if (!node) return;

        const updateSize = () => {
            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const width = Math.round(rect.width);
            const height = Math.round(rect.height);

            setCropStageSize({ width, height });

            if (imageNaturalSize.width && imageNaturalSize.height) {
                calculateAndApplyLayout(width, height, imageNaturalSize.width, imageNaturalSize.height);
            }
        };

        updateSize();
        requestAnimationFrame(updateSize);
        setTimeout(updateSize, 30);
        setTimeout(updateSize, 80);

        const observer = new ResizeObserver(updateSize);
        observer.observe(node);

        node._resizeObserver = observer;
    }, [imageNaturalSize.width, imageNaturalSize.height, calculateAndApplyLayout]);

    useLayoutEffect(() => {
        const handleResize = () => {
            const stage = cropStageRef.current;
            if (!stage) return;
            const rect = stage.getBoundingClientRect();
            if (rect.width && rect.height) {
                setCropStageSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
                if (imageNaturalSize.width && imageNaturalSize.height) {
                    calculateAndApplyLayout(rect.width, rect.height, imageNaturalSize.width, imageNaturalSize.height);
                }
            }
        };

        window.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
        };
    }, [imageNaturalSize.width, imageNaturalSize.height, calculateAndApplyLayout]);

    const isMine = id => String(id) === String(myId);

    useEffect(() => {
        setMessages([]);
        setTypingUser(null);
        setCtxMenu(null);
        setAttachmentMenuOpen(false);
        setPreviewImage(null);
        setAttachmentImageScale(78);
        setCropRatio('original');
        setCropPosition({ x: 0, y: 0 });
        setCropPan({ x: 0, y: 0 });
        setCropFrameRect(null);
        setImageAspect(16 / 9);
        setImageNaturalSize({ width: 0, height: 0 });
        setCropImageScale(null);
        setIsProfileOpen(false);
        setIsLoading(true);
        isInitialMount.current = true;
        stickToBottomRef.current = true;
        msgRefs.current = {};
        clearTimeout(typingClearRef.current);
        clearTimeout(typingSendRef.current);

        setAttachment(prev => {
            if (prev?.url) URL.revokeObjectURL(prev.url);
            return null;
        });
    }, [chatId]);

    useEffect(() => {
        return () => {
            clearTimeout(typingClearRef.current);
            clearTimeout(typingSendRef.current);
            if (longPressRef.current?.timer) clearTimeout(longPressRef.current.timer);
            if (attachmentRef.current?.url) URL.revokeObjectURL(attachmentRef.current.url);
        };
    }, []);

    useEffect(() => {
        if (!attachment && !previewImage) return undefined;

        const handleEscape = e => {
            if (e.key === 'Enter') {
                // Enter отправляет вложение, где бы ни был фокус (после выбора
                // файла он остаётся вне окна предпросмотра)
                if (previewImage || !attachment || e.defaultPrevented) return;
                if (e.shiftKey || e.isComposing || e.repeat) return;
                e.preventDefault();
                handleSendRef.current?.();
                return;
            }
            if (e.key !== 'Escape') return;
            if (previewImage) {
                setPreviewImage(null);
                return;
            }
            handleRemoveAttachment();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [attachment, previewImage]);

    useEffect(() => {
        if (!chatId) return;
        let isCancelled = false;
        const tok = token || localStorage.getItem('jwt_token');

        if (tok) SetToken(tok).catch(err => console.error('SetToken error:', err));

        const hit = _msgsCache.get(chatId);
        if (hit) {
            setMessages(hit.data);
            setIsLoading(false);
            if (Date.now() - hit.ts < MSGS_TTL) return;
        }

        GetMessages(chatId, tok)
            .then(r => {
                if (isCancelled) return;
                const fresh = r || [];
                _msgsCache.set(chatId, { data: fresh, ts: Date.now() });
                setMessages(fresh);
            })
            .catch(err => {
                if (!isCancelled) console.error('GetMessages error:', err);
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => { isCancelled = true; };
    }, [chatId, token]);

    useEffect(() => {
        const unsub = Events.On('server_message', event => {
            const msg = event.data;
            if (!msg) return;

            const msgChatId = String(msg.chat_id);
            const isActive = msgChatId === String(chatIdRef.current);

            if (msg.type === 'TYPING') {
                if (!isActive || isMine(msg.sender_id)) return;
                setTypingUser(msg.username);
                clearTimeout(typingClearRef.current);
                typingClearRef.current = setTimeout(() => setTypingUser(null), 3500);
                return;
            }

            if (msg.type === 'DELETE_MESSAGE') {
                const mid = msg.message_id || msg.id;
                if (!mid) return;
                const cached = _msgsCache.get(msgChatId);
                if (cached) {
                    const data = cached.data.filter(m => String(m.id) !== String(mid));
                    _msgsCache.set(msgChatId, { data, ts: Date.now() });
                }
                if (isActive) setMessages(prev => prev.filter(m => String(m.id) !== String(mid)));
                return;
            }

            if (msg.type === 'CLEAR_CHAT') {
                _msgsCache.set(msgChatId, { data: [], ts: Date.now() });
                if (isActive) setMessages([]);
                return;
            }

            if (msg.type === 'NEW_CHAT' || msg.type === 'DELETE_CHAT' || msg.type === 'FRIEND_REQUEST') {
                onMessageSent?.(msg);
                return;
            }

            if (msg.type !== 'NEW_MESSAGE') return;

            // Общая с chatsMenu.jsx идемпотентная логика — второй вызов на то же
            // событие ничего не меняет, поэтому дублей в кэше не бывает
            const mine = isMine(msg.sender_id);
            applyNewMessageToCache(msg, mine);

            if (!isActive) return;

            setTypingUser(null);
            clearTimeout(typingClearRef.current);
            setMessages(prev => applyNewMessage(prev, msg, mine));
            if (mine) onMessageSent?.(msg);
        });

        return () => unsub();
    }, []);

    // Прижатие к низу. Высота сообщений меняется уже после отрисовки
    // (картинки грузятся через fetch с токеном), поэтому одной прокрутки
    // при открытии мало — ResizeObserver докручивает, пока пользователь внизу.
    const scrollToBottom = () => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    };

    const handleListScroll = () => {
        const list = listRef.current;
        if (!list) return;
        stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    };

    useLayoutEffect(() => {
        if (!messages.length || searchQuery) return;
        const last = messages[messages.length - 1];
        // Своё сообщение всегда показываем; чужое — только если пользователь внизу
        if (isInitialMount.current || stickToBottomRef.current || isMine(last?.sender_id)) {
            stickToBottomRef.current = true;
            scrollToBottom();
        }
        isInitialMount.current = false;
    }, [messages, searchQuery]);

    useEffect(() => {
        const list = listRef.current;
        if (!list || typeof ResizeObserver === 'undefined') return undefined;
        if (!resizeObserverRef.current) {
            resizeObserverRef.current = new ResizeObserver(() => {
                if (stickToBottomRef.current && !searchQueryRef.current) scrollToBottom();
            });
        }
        // observe() для уже отслеживаемого элемента ничего не делает
        Array.from(list.children).forEach(el => resizeObserverRef.current.observe(el));
    }, [messages]);

    useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

    const matchIndices = useRef([]);
    // Родитель передаёт колбэк инлайном — держим его в ref, иначе эффект
    // срабатывает на каждый рендер родителя и уходит в бесконечный цикл
    const onMatchesFoundRef = useRef(onMatchesFound);
    useEffect(() => { onMatchesFoundRef.current = onMatchesFound; }, [onMatchesFound]);

    useEffect(() => {
        if (!searchQuery) {
            matchIndices.current = [];
            onMatchesFoundRef.current?.(0);
            return;
        }
        const q = searchQuery.toLowerCase();
        const indices = messages
            .map((m, i) => m.text?.toLowerCase().includes(q) ? i : -1)
            .filter(i => i !== -1);
        matchIndices.current = indices;
        onMatchesFoundRef.current?.(indices.length);
    }, [searchQuery, messages]);

    useEffect(() => {
        if (!searchQuery || !matchIndices.current.length) return;
        const safeIdx = searchNavIdx % matchIndices.current.length;
        const msgIdx = matchIndices.current[safeIdx];
        const msg = messages[msgIdx];
        if (!msg) return;
        const el = msgRefs.current[msg.id || msgIdx];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [searchNavIdx, searchQuery, messages]);

    useEffect(() => {
        const h = () => {
            if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
            }
            setCtxMenu(null);
            setAttachmentMenuOpen(false);
        };
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    const handleTyping = useCallback(() => {
        clearTimeout(typingSendRef.current);
        typingSendRef.current = setTimeout(async () => {
            if (!chatIdRef.current) return;
            try {
                await SendWSMessage(JSON.stringify({
                    type: 'TYPING',
                    chat_id: chatIdRef.current,
                    sender_id: myId,
                    username
                }));
            } catch (err) {
                console.error('Typing error:', err);
            }
        }, 400);
    }, [myId, username]);

    const getFileExtension = name => {
        const clean = String(name || '').split(/[\\/]/).pop();
        const dot = clean.lastIndexOf('.');
        return dot > 0 ? clean.slice(dot) : '';
    };

    const getFileBaseName = name => {
        const ext = getFileExtension(name);
        return ext ? String(name).slice(0, -ext.length) : String(name || '');
    };

    const createAttachment = file => {
        if (!file) return;

        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            window.alert('Файл слишком большой. Максимальный размер — 50 МБ.');
            return;
        }

        const url = URL.createObjectURL(file);
        const next = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url,
            file,
            originalName: file.name
        };

        setAttachment(prev => {
            if (prev?.url) URL.revokeObjectURL(prev.url);
            return next;
        });
        setAttachmentImageScale(78);
        setCropRatio('original');
        setCropPosition({ x: 0, y: 0 });
        setCropPan({ x: 0, y: 0 });
        setImageNaturalSize({ width: 0, height: 0 });
        setCropImageScale(null);
        setCropFrameRect(null);

        if (file.type?.startsWith('image/')) {
            const probe = new Image();
            probe.onload = () => {
                const w = probe.naturalWidth;
                const h = probe.naturalHeight;
                setImageNaturalSize({ width: w, height: h });
                setImageAspect(w / h || 16 / 9);

                const stage = cropStageRef.current;
                if (stage) {
                    const rect = stage.getBoundingClientRect();
                    if (rect.width && rect.height) {
                        setCropStageSize({ width: rect.width, height: rect.height });
                        calculateAndApplyLayout(rect.width, rect.height, w, h);
                    }
                }
            };
            probe.src = url;
        }
        setAttachmentMenuOpen(false);
    };

    const handleRenameAttachment = e => {
        const originalName = attachment?.originalName || attachment?.name || '';
        const ext = getFileExtension(originalName);
        const raw = e.target.value;
        const base = raw.replace(new RegExp(`${ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '');
        setAttachment(prev => prev ? { ...prev, name: `${base || 'Без имени'}${ext}` } : prev);
    };

    const getCropMetrics = () => {
        const frameW = cropFrameRect?.width || 0;
        const frameH = cropFrameRect?.height || 0;
        const naturalW = imageNaturalSize.width;
        const naturalH = imageNaturalSize.height;

        const stage = cropStageRef.current;
        const stageW = cropStageSize.width || stage?.getBoundingClientRect().width || 0;
        const stageH = cropStageSize.height || stage?.getBoundingClientRect().height || 0;

        if (!frameW || !frameH || !naturalW || !naturalH || !stageW || !stageH) return null;

        const fitScale = Math.min(
            (stageW - 40) / naturalW,
            (stageH - 40) / naturalH
        );

        const renderedW = naturalW * fitScale;
        const renderedH = naturalH * fitScale;

        const scaleX = renderedW / naturalW;
        const scaleY = renderedH / naturalH;

        const maxX = Math.max(0, (renderedW - frameW) / 2);
        const maxY = Math.max(0, (renderedH - frameH) / 2);

        return {
            frameW,
            frameH,
            naturalW,
            naturalH,
            baseScale: fitScale,
            renderedW,
            renderedH,
            scaleX,
            scaleY,
            maxX,
            maxY
        };
    };

    const getActualCropMetrics = () => {
        const metrics = getCropMetrics();
        const stage = cropStageRef.current;
        const image = cropImageRef.current;

        if (!metrics || !stage || !image) return metrics;

        const stageRect = stage.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();

        if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height) {
            return metrics;
        }

        const renderedW = imageRect.width;
        const renderedH = imageRect.height;
        const imageLeft = imageRect.left - stageRect.left;
        const imageTop = imageRect.top - stageRect.top;
        const scaleX = renderedW / metrics.naturalW;
        const scaleY = renderedH / metrics.naturalH;
        const maxX = Math.max(0, (renderedW - metrics.frameW) / 2);
        const maxY = Math.max(0, (renderedH - metrics.frameH) / 2);

        return {
            ...metrics,
            renderedW,
            renderedH,
            scaleX,
            scaleY,
            imageLeft,
            imageTop,
            maxX,
            maxY
        };
    };

    const handleCropResizePointerDown = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();

        if (!cropFrameRect) return;

        e.currentTarget.setPointerCapture?.(e.pointerId);

        cropResizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startRect: {
                left: cropFrameRect.left,
                top: cropFrameRect.top,
                width: cropFrameRect.width,
                height: cropFrameRect.height
            },
            direction
        };
    };

    const handleCropResizePointerMove = e => {
        const resize = cropResizeRef.current;
        if (!resize || !cropStageSize.width || !cropStageSize.height) return;

        const start = resize.startRect;
        const dir = resize.direction;
        const dx = e.clientX - resize.startX;
        const dy = e.clientY - resize.startY;
        const metrics = getActualCropMetrics();
        if (!metrics) return;

        const minW = 90;
        const minH = 90;
        const imageLeft = metrics.imageLeft ?? ((cropStageSize.width - metrics.renderedW) / 2 + cropPan.x);
        const imageTop = metrics.imageTop ?? ((cropStageSize.height - metrics.renderedH) / 2 + cropPan.y);
        const imageRight = imageLeft + metrics.renderedW;
        const imageBottom = imageTop + metrics.renderedH;

        let left = start.left;
        let top = start.top;
        let right = start.left + start.width;
        let bottom = start.top + start.height;

        if (dir.includes('e')) right = Math.min(imageRight, Math.max(left + minW, start.left + start.width + dx));
        if (dir.includes('w')) left = Math.max(imageLeft, Math.min(right - minW, start.left + dx));
        if (dir.includes('s')) bottom = Math.min(imageBottom, Math.max(top + minH, start.top + start.height + dy));
        if (dir.includes('n')) top = Math.max(imageTop, Math.min(bottom - minH, start.top + dy));

        // Жесткие рамки границ картинки при ресайзе
        left = Math.max(imageLeft, Math.min(imageRight - minW, left));
        right = Math.max(left + minW, Math.min(imageRight, right));
        top = Math.max(imageTop, Math.min(imageBottom - minH, top));
        bottom = Math.max(top + minH, Math.min(imageBottom, bottom));

        setCropFrameRect({
            left: Math.round(left),
            top: Math.round(top),
            width: Math.round(right - left),
            height: Math.round(bottom - top)
        });
    };

    const handleCropResizePointerUp = e => {
        cropResizeRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    const handleCropPointerDown = e => {
        if (!attachment?.type?.startsWith('image/') || !cropFrameRect) return;
        // Если кликнули по ручкам ресайза, не запускаем перетаскивание всей рамки
        if (e.target.classList.contains('crop-resize-handle') || e.target.classList.contains('crop-corner')) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);

        cropBoxDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startRect: { ...cropFrameRect }
        };
    };

    const handleCropPointerMove = e => {
        const drag = cropBoxDragRef.current;
        if (!drag || !cropFrameRect) return;

        const metrics = getActualCropMetrics();
        if (!metrics) return;

        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        const imageLeft = metrics.imageLeft ?? ((cropStageSize.width - metrics.renderedW) / 2 + cropPan.x);
        const imageTop = metrics.imageTop ?? ((cropStageSize.height - metrics.renderedH) / 2 + cropPan.y);
        const imageRight = imageLeft + metrics.renderedW;
        const imageBottom = imageTop + metrics.renderedH;

        // Вычисляем новые координаты рамки с учётом её размеров, чтобы она не вылезала за края картинки
        let newLeft = drag.startRect.left + dx;
        let newTop = drag.startRect.top + dy;

        newLeft = Math.max(imageLeft, Math.min(imageRight - cropFrameRect.width, newLeft));
        newTop = Math.max(imageTop, Math.min(imageBottom - cropFrameRect.height, newTop));

        setCropFrameRect(prev => prev ? {
            ...prev,
            left: Math.round(newLeft),
            top: Math.round(newTop)
        } : null);
    };

    const handleCropPointerUp = e => {
        if (!cropBoxDragRef.current) return;
        cropBoxDragRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    const handleFileSelect = e => {
        const file = e.target.files?.[0];
        if (file) createAttachment(file);
        e.target.value = '';
    };

    const handleRemoveAttachment = () => {
        setAttachment(prev => {
            if (prev?.url) URL.revokeObjectURL(prev.url);
            return null;
        });
    };

    const cropImageForSend = async sourceAttachment => {
        if (!sourceAttachment?.type?.startsWith('image/')) return sourceAttachment;

        const image = new Image();
        image.src = sourceAttachment.url;
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });

        const naturalW = image.naturalWidth;
        const naturalH = image.naturalHeight;
        if (!naturalW || !naturalH) return sourceAttachment;

        const metrics = getActualCropMetrics();
        if (!metrics) return sourceAttachment;

        const imageLeft = metrics.imageLeft ?? ((cropStageSize.width - metrics.renderedW) / 2 + cropPan.x);
        const imageTop = metrics.imageTop ?? ((cropStageSize.height - metrics.renderedH) / 2 + cropPan.y);
        const sourceScaleX = metrics.scaleX;
        const sourceScaleY = metrics.scaleY;

        const rawSx = (cropFrameRect.left - imageLeft) / sourceScaleX;
        const rawSy = (cropFrameRect.top - imageTop) / sourceScaleY;
        const rawCropW = cropFrameRect.width / sourceScaleX;
        const rawCropH = cropFrameRect.height / sourceScaleY;

        const sx = Math.max(0, Math.min(naturalW, rawSx));
        const sy = Math.max(0, Math.min(naturalH, rawSy));
        const cropW = Math.max(1, Math.min(naturalW - sx, rawCropW));
        const cropH = Math.max(1, Math.min(naturalH - sy, rawCropH));

        const maxOutput = 2400;
        const outputScale = Math.min(1, maxOutput / Math.max(cropW, cropH));
        const outW = Math.max(1, Math.round(cropW * outputScale));
        const outH = Math.max(1, Math.round(cropH * outputScale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return sourceAttachment;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, cropW, cropH, 0, 0, outW, outH);

        const originalExt = getFileExtension(sourceAttachment.originalName || sourceAttachment.name || '');
        const outputType = sourceAttachment.type === 'image/png'
            ? 'image/png'
            : sourceAttachment.type === 'image/webp'
                ? 'image/webp'
                : 'image/jpeg';
        const outputExt = originalExt || (outputType === 'image/png' ? '.png' : outputType === 'image/webp' ? '.webp' : '.jpg');
        const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, .92));
        if (!blob) return sourceAttachment;

        const oldUrl = sourceAttachment.url;
        const newUrl = URL.createObjectURL(blob);
        const base = getFileBaseName(sourceAttachment.name || sourceAttachment.originalName) || 'Изображение';
        const finalName = `${base}${outputExt}`;

        if (oldUrl && oldUrl !== newUrl) URL.revokeObjectURL(oldUrl);

        return {
            ...sourceAttachment,
            name: finalName,
            size: blob.size,
            type: outputType,
            url: newUrl,
            file: new File([blob], finalName, { type: outputType }),
            originalName: sourceAttachment.originalName || sourceAttachment.name
        };
    };

    // Текст и вложение берём из ref: повторный Enter/клик, пришедший до
    // перерисовки, иначе увидел бы старое состояние и отправил дубль
    const handleSend = async () => {
        if (sendingRef.current) return;
        const text = inputTextRef.current.trim();
        const current = attachmentRef.current;
        const targetChatId = chatId;
        if ((!text && !current) || !targetChatId) return;

        sendingRef.current = true;
        setIsSending(true);
        try {
            let attachmentToSend = current;
            if (attachmentToSend?.type?.startsWith('image/')) {
                try {
                    attachmentToSend = await cropImageForSend(attachmentToSend);
                } catch (err) {
                    console.error('Ошибка кадрирования изображения:', err);
                    attachmentToSend = current;
                }
            }
            submitMessage(targetChatId, text, attachmentToSend);
        } finally {
            sendingRef.current = false;
            setIsSending(false);
        }
    };

    const submitMessage = (chatId, text, attachmentToSend) => {
        const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const nowIso = new Date().toISOString();
        clearTimeout(typingSendRef.current);

        const localMessage = {
            id: tempId,
            chat_id: chatId,
            sender_id: myId,
            username,
            text,
            created_at: nowIso,
            status: 'sending',
            attachment: attachmentToSend ? {
                id: attachmentToSend.id,
                kind: attachmentToSend.type?.startsWith('image/') ? 'image' : 'file',
                name: attachmentToSend.name,
                size: attachmentToSend.size,
                type: attachmentToSend.type,
                url: attachmentToSend.url,
                file: attachmentToSend.file
            } : null
        };

        setMessages(prev => {
            const next = [...prev, localMessage];
            _msgsCache.set(chatId, { data: next, ts: Date.now() });
            return next;
        });
        inputTextRef.current = '';
        attachmentRef.current = null;
        setInputText('');
        setAttachment(null);
        setCropPosition({ x: 0, y: 0 });
        setCropPan({ x: 0, y: 0 });

        deliverMessage(chatId, localMessage);
    };

    // Обновляет сообщение и в кэше, и на экране (если чат ещё открыт).
    // patch — объект или функция от текущего сообщения
    const patchMessage = (targetChatId, id, patch) => {
        const apply = list => list.map(m => (
            m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m
        ));
        const cached = _msgsCache.get(targetChatId);
        if (cached) _msgsCache.set(targetChatId, { data: apply(cached.data), ts: cached.ts });
        if (String(chatIdRef.current) === String(targetChatId)) setMessages(prev => apply(prev));
    };

    // Сервер принимает только map[string]string — все значения строками
    const deliverMessage = async (targetChatId, localMsg) => {
        // Защита от двойного запуска (двойной клик по «Повторить»)
        if (inFlightRef.current.has(localMsg.id)) return;
        inFlightRef.current.add(localMsg.id);
        try {
            await deliverMessageOnce(targetChatId, localMsg);
        } finally {
            inFlightRef.current.delete(localMsg.id);
        }
    };

    const deliverMessageOnce = async (targetChatId, localMsg) => {
        const att = localMsg.attachment;
        const tok = token || localStorage.getItem('jwt_token');
        const payload = {
            type: att ? att.kind : 'text',
            chat_id: String(targetChatId),
            sender_id: String(myId),
            username: username || '',
            text: localMsg.text || ''
        };

        if (att) {
            patchMessage(targetChatId, localMsg.id, { status: 'uploading', progress: 0 });
            try {
                let lastPct = 0;
                const s3Key = await uploadAttachment(att.file, tok, p => {
                    const pct = Math.round(p * 100);
                    if (pct === lastPct) return;
                    lastPct = pct;
                    patchMessage(targetChatId, localMsg.id, { progress: pct });
                });
                payload.file_url = s3Key;
                payload.file_name = att.name;
                payload.file_size = String(att.size);
            } catch (err) {
                console.error('Ошибка загрузки файла:', err);
                patchMessage(targetChatId, localMsg.id, { status: 'error', progress: null });
                return;
            }
            patchMessage(targetChatId, localMsg.id, { status: 'sending', progress: null });
        }

        try {
            await SendWSMessage(JSON.stringify(payload));
        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            patchMessage(targetChatId, localMsg.id, { status: 'error' });
            return;
        }

        // Сервер не подтвердил (NEW_MESSAGE не пришёл) — даём повторить.
        // После подтверждения tmp-id заменён на настоящий, и патч ничего не найдёт.
        setTimeout(() => {
            patchMessage(targetChatId, localMsg.id, m => (m.status === 'sending' ? { status: 'error' } : {}));
        }, CONFIRM_TIMEOUT_MS);
    };

    const handleRetry = msg => {
        if (msg.status !== 'error') return;
        deliverMessage(chatId, msg);
    };

    const openFile = (url, name) => {
        if (!url) return;
        downloadFile(url, name).catch(err => console.error('Ошибка скачивания файла:', err));
    };

    handleSendRef.current = handleSend;

    const handleKeyDown = e => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (!e.repeat) handleSend();
    };

    const showCtxMenu = (e, msg) => {
        e.preventDefault();
        e.stopPropagation();
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const mine = isMine(msg.sender_id);
        const mh = mine ? 88 : 50;
        setCtxMenu({
            x: Math.min(x, window.innerWidth - 178),
            y: y + mh > window.innerHeight ? y - mh : y + 4,
            msgId: msg.id,
            isMine: mine,
            text: msg.text || ''
        });
    };

    const handleLongPressStart = (e, msg) => {
        const t = e.touches[0];
        const startX = t.clientX;
        const startY = t.clientY;
        longPressRef.current = {
            timer: setTimeout(() => {
                navigator.vibrate?.(40);
                suppressClickRef.current = true;
                showCtxMenu({
                    clientX: startX,
                    clientY: startY,
                    preventDefault() {},
                    stopPropagation() {}
                }, msg);
                longPressRef.current = null;
            }, 400),
            startX,
            startY
        };
    };

    const handleLongPressMove = e => {
        if (!longPressRef.current) return;
        const t = e.touches[0];
        if (
            Math.abs(t.clientX - longPressRef.current.startX) > 12 ||
            Math.abs(t.clientY - longPressRef.current.startY) > 12
        ) {
            clearTimeout(longPressRef.current.timer);
            longPressRef.current = null;
        }
    };

    const handleLongPressEnd = () => {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current.timer);
            longPressRef.current = null;
        }
    };

    const handleCopy = () => {
        if (ctxMenu?.text) navigator.clipboard?.writeText(ctxMenu.text).catch(() => {});
        setCtxMenu(null);
    };

    const handleDeleteMsg = async () => {
        const id = ctxMenu?.msgId;
        setCtxMenu(null);
        if (!id) return;

        // Неотправленное сообщение живёт только локально
        if (String(id).startsWith('tmp_')) {
            const local = messages.find(m => m.id === id);
            if (local?.status !== 'error') return;
            if (local.attachment?.url) URL.revokeObjectURL(local.attachment.url);
            setMessages(prev => {
                const next = prev.filter(m => m.id !== id);
                _msgsCache.set(chatId, { data: next, ts: Date.now() });
                return next;
            });
            return;
        }

        const tok = localStorage.getItem('jwt_token');
        try {
            await DeleteMessage(String(id), tok);
            setMessages(prev => {
                const next = prev.filter(m => String(m.id) !== String(id));
                _msgsCache.set(chatId, { data: next, ts: Date.now() });
                return next;
            });
        } catch (err) {
            console.error('deleteMessage error:', err);
        }
    };

    const currentMatchMsgIdx = searchQuery && matchIndices.current.length
        ? matchIndices.current[searchNavIdx % matchIndices.current.length]
        : -1;

    if (!chatId) return (
        <div className="chat-placeholder">
            <div className="placeholder-content"><p>Выберите чат</p></div>
        </div>
    );

    return (
        <div className="chat-window" onClick={() => setCtxMenu(null)}>
            <Header
                token={token}
                chatName={chatName}
                chatId={chatId}
                onMenuToggle={onMenuToggle}
                onProfileToggle={() => setIsProfileOpen(prev => !prev)}
            />

            <div className="chat-main">
                <div className="chat-content">
                    <div className="messages-list" ref={listRef} onScroll={handleListScroll}>
                        <div className="messages-spacer" />

                        {isLoading && (
                            <div className="chat-loading"><div className="spinner" /><p>Загрузка...</p></div>
                        )}

                        {!isLoading && messages.length === 0 && (
                            <div className="no-messages-empty">Сообщений пока нет...</div>
                        )}

                        {(() => {
                            const result = [];
                            let lastLabel = null;

                            messages.forEach((msg, i) => {
                                const label = getDateLabel(msg.created_at);
                                if (label && label !== lastLabel) {
                                    lastLabel = label;
                                    result.push(
                                        <div key={`sep-${i}`} className="date-separator"><span>{label}</span></div>
                                    );
                                }

                                const timeStr = msg.created_at
                                    ? new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
                                    : '';
                                const mine = isMine(msg.sender_id);
                                const isMatch = searchQuery && matchIndices.current.includes(i);
                                const isActive = isMatch && i === currentMatchMsgIdx;
                                const att = getMessageAttachment(msg);
                                const isImage = att?.kind === 'image';
                                const mediaOnly = isImage && !msg.text;
                                const uploading = msg.status === 'uploading';
                                const failed = msg.status === 'error';

                                result.push(
                                    <div
                                        key={msg.id || i}
                                        ref={el => { msgRefs.current[msg.id || i] = el; }}
                                        className={`message-bubble ${mine ? 'sent' : 'received'}${isImage ? ' has-image' : ''}${mediaOnly ? ' media-only' : ''}${failed ? ' is-failed' : ''}${isActive ? ' msg-search-active' : isMatch ? ' msg-search-match' : ''}`}
                                        onContextMenu={e => showCtxMenu(e, msg)}
                                        onTouchStart={e => handleLongPressStart(e, msg)}
                                        onTouchMove={handleLongPressMove}
                                        onTouchEnd={handleLongPressEnd}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {!mine && <div className="message-sender">{msg.username}</div>}

                                        {att && (
                                            <div className="message-attachment">
                                                {isImage ? (
                                                    <div className="message-attachment-media">
                                                        <MessageImage
                                                            fileUrl={att.url}
                                                            alt={att.name || 'Изображение'}
                                                            onOpen={setPreviewImage}
                                                        />
                                                        {(uploading || msg.status === 'sending') && (
                                                            <div className="message-upload-overlay">
                                                                <div className="message-upload-spinner" />
                                                                {uploading && <span>{msg.progress || 0}%</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        className={`message-attachment-file${att.url ? ' is-ready' : ''}`}
                                                        type="button"
                                                        title={att.url ? 'Скачать файл' : att.name}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            openFile(att.url, att.name);
                                                        }}
                                                    >
                                                        <div className="message-attachment-file-icon">
                                                            {uploading || msg.status === 'sending' ? (
                                                                <div className="message-upload-spinner" />
                                                            ) : (
                                                                <svg viewBox="0 0 24 24" fill="none" width="21" height="21">
                                                                    <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                                    <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <div className="message-attachment-file-info">
                                                            <div className="message-attachment-file-name">{att.name}</div>
                                                            <div className="message-attachment-file-size">
                                                                {uploading
                                                                    ? `${formatFileSize(att.size * (msg.progress || 0) / 100)} из ${formatFileSize(att.size)}`
                                                                    : formatFileSize(att.size)}
                                                            </div>
                                                            {uploading && (
                                                                <div className="message-upload-bar">
                                                                    <div style={{ width: `${msg.progress || 0}%` }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
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
                                                        handleRetry(msg);
                                                    }}
                                                >
                                                    Не отправлено · Повторить
                                                </button>
                                            )}
                                            {timeStr && <span className="message-time">{timeStr}</span>}
                                        </div>
                                    </div>
                                );
                            });

                            return result;
                        })()}

                        <div ref={messagesEndRef} style={{ height: '1px' }} />
                    </div>

                    <div className="chat-input-container">
                        <div className={`typing-indicator ${typingUser ? '' : 'hidden'}`} id="typing-indicator">
                            <div className="typing-dots"><span></span><span></span><span></span></div>
                            <span className="typing-name" id="typing-text">
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
                                    setAttachmentMenuOpen(prev => !prev);
                                }}
                            >
                                <svg 
                                    className="chat-attach-icon" 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    >
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                            </button>

                            {attachmentMenuOpen && (
                                <div className="attachment-menu" onClick={e => e.stopPropagation()}>
                                    <button className="attachment-menu-item" type="button" onClick={() => imageInputRef.current?.click()}>
                                        <span className="attachment-menu-icon">
                                            <svg viewBox="0 0 24 24" fill="none" width="19" height="19">
                                                <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
                                                <circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.6" />
                                                <path d="m5 17 4.5-4 3 2.5 2-2 4.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                        <span>Изображение</span>
                                    </button>
                                    <button className="attachment-menu-item" type="button" onClick={() => fileInputRef.current?.click()}>
                                        <span className="attachment-menu-icon">
                                            <svg viewBox="0 0 24 24" fill="none" width="19" height="19">
                                                <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                                <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" />
                                            </svg>
                                        </span>
                                        <span>Файл</span>
                                    </button>
                                </div>
                            )}

                            <input
                                ref={imageInputRef}
                                className="chat-file-input"
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            <input
                                ref={fileInputRef}
                                className="chat-file-input"
                                type="file"
                                onChange={handleFileSelect}
                            />
                        </div>

                        <div className="chat-input-wrapper">
                            <input
                                type="text"
                                placeholder="Напишите сообщение..."
                                className="chat-input"
                                value={inputText}
                                onChange={e => {
                                    inputTextRef.current = e.target.value;
                                    setInputText(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={handleKeyDown}
                            />
                            <button className="chat-send-btn" onClick={handleSend} type="button">
                                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {isProfileOpen && (
                    <UserProfile
                        chatName={chatName}
                        chatId={chatId}
                        onClose={() => setIsProfileOpen(false)}
                        getAvatarColor={getAvatarColor}
                    />
                )}
            </div>

            {attachment && (
                <div
                    className="chat-attachment-preview"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Предпросмотр вложения"
                    onClick={e => {
                        if (e.target === e.currentTarget) handleRemoveAttachment();
                    }}
                >
                    <div className="chat-attachment-preview-backdrop" onClick={handleRemoveAttachment} />

                    <div
                        className="chat-attachment-preview-panel"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="chat-attachment-preview-header">
                            <button
                                className="chat-attachment-preview-close"
                                type="button"
                                aria-label="Закрыть"
                                title="Закрыть"
                                onClick={handleRemoveAttachment}
                            >×</button>
                            <div className="chat-attachment-preview-title">
                                {attachment.type.startsWith('image/') ? 'Отправить фото' : 'Отправить файл'}
                            </div>
                            <div className="chat-attachment-preview-header-meta">
                                {formatFileSize(attachment.size)}
                            </div>
                        </div>

                        {attachment.type.startsWith('image/') ? (
                            <>
                                <div ref={stageRefCallback} className="chat-attachment-image-stage">
                                    <img
                                        ref={cropImageRef}
                                        className="chat-attachment-crop-image"
                                        src={attachment.url}
                                        alt={attachment.name}
                                        draggable="false"
                                        onLoad={e => {
                                            const w = e.currentTarget.naturalWidth;
                                            const h = e.currentTarget.naturalHeight;
                                            if (w && h) {
                                                setImageNaturalSize({ width: w, height: h });
                                                setImageAspect(w / h);
                                                const stage = cropStageRef.current;
                                                if (stage) {
                                                    const rect = stage.getBoundingClientRect();
                                                    if (rect.width && rect.height) {
                                                        setCropStageSize({ width: rect.width, height: rect.height });
                                                        calculateAndApplyLayout(rect.width, rect.height, w, h);
                                                    }
                                                }
                                            }
                                        }}
                                        style={{
                                            '--image-width': `${getCropMetrics()?.renderedW || 0}px`,
                                            '--image-height': `${getCropMetrics()?.renderedH || 0}px`,
                                            '--crop-offset-x': `${cropPan.x}px`,
                                            '--crop-offset-y': `${cropPan.y}px`
                                        }}
                                    />

                                    {cropFrameRect && (
                                        <div
                                            ref={cropFrameRef}
                                            className={`chat-attachment-image crop-ratio-${cropRatio.replace(':', '-')}`}
                                            onPointerDown={handleCropPointerDown}
                                            onPointerMove={handleCropPointerMove}
                                            onPointerUp={handleCropPointerUp}
                                            onPointerCancel={handleCropPointerUp}
                                            style={{
                                                '--image-aspect': imageAspect,
                                                left: `${cropFrameRect.left}px`,
                                                top: `${cropFrameRect.top}px`,
                                                width: `${cropFrameRect.width}px`,
                                                height: `${cropFrameRect.height}px`,
                                                aspectRatio: 'auto'
                                            }}
                                        >
                                            <div className="chat-attachment-crop-grid" />
                                            <span className="crop-corner crop-corner-tl" />
                                            <span className="crop-corner crop-corner-tr" />
                                            <span className="crop-corner crop-corner-bl" />
                                            <span className="crop-corner crop-corner-br" />
                                            {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(direction => (
                                                <span
                                                    key={direction}
                                                    className={`crop-resize-handle crop-resize-${direction}`}
                                                    onPointerDown={e => handleCropResizePointerDown(e, direction)}
                                                    onPointerMove={handleCropResizePointerMove}
                                                    onPointerUp={handleCropResizePointerUp}
                                                    onPointerCancel={handleCropResizePointerUp}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="chat-attachment-toolbar">
                                    <div className="chat-attachment-caption-row">
                                        <div className="chat-attachment-caption-icon">✎</div>
                                        <div className="chat-attachment-name-row">
                                            <input
                                                id="attachment-name"
                                                type="text"
                                                value={getFileBaseName(attachment.name)}
                                                onChange={handleRenameAttachment}
                                                spellCheck="false"
                                                aria-label="Имя файла"
                                            />
                                            <span className="chat-attachment-extension">{getFileExtension(attachment.name)}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="chat-attachment-file-layout">
                                <div className="chat-attachment-file">
                                    <div className="chat-attachment-file-icon">
                                        <svg viewBox="0 0 24 24" fill="none" width="38" height="38">
                                            <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="chat-attachment-file-info">
                                        <div className="chat-attachment-file-name">{attachment.name}</div>
                                        <div className="chat-attachment-file-size">{formatFileSize(attachment.size)} · {attachment.type || 'Файл'}</div>
                                    </div>
                                </div>

                                <div className="chat-attachment-file-name-edit">
                                    <div className="chat-attachment-caption-icon">✎</div>
                                    <div className="chat-attachment-name-row">
                                        <input
                                            id="attachment-name"
                                            type="text"
                                            value={getFileBaseName(attachment.name)}
                                            onChange={handleRenameAttachment}
                                            spellCheck="false"
                                            aria-label="Имя файла"
                                        />
                                        <span className="chat-attachment-extension">{getFileExtension(attachment.name)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="chat-attachment-preview-footer">
                            <button className="chat-attachment-cancel" type="button" onClick={handleRemoveAttachment}>
                                Отмена
                            </button>
                            <button
                                className="chat-attachment-confirm"
                                type="button"
                                onClick={handleSend}
                                disabled={isSending}
                            >
                                {isSending ? (
                                    <div className="message-upload-spinner chat-attachment-confirm-spinner" />
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                        <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                                Отправить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {ctxMenu && (
                <div
                    className="msg-ctx-menu"
                    style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="ctx-item" onClick={handleCopy}>
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" /></svg>
                        Копировать текст
                    </button>
                    {ctxMenu.isMine && (
                        <button className="ctx-item ctx-item-danger" onClick={handleDeleteMsg}>
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                            Удалить сообщение
                        </button>
                    )}
                </div>
            )}

            {previewImage && (
                <div className="image-preview-overlay" onClick={() => setPreviewImage(null)}>
                    <button
                        className="image-preview-close"
                        type="button"
                        aria-label="Закрыть"
                        onClick={e => {
                            e.stopPropagation();
                            setPreviewImage(null);
                        }}
                    >×</button>
                    <img
                        src={previewImage}
                        alt="Предпросмотр"
                        onClick={e => {
                            e.stopPropagation();
                            setPreviewImage(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default Chat;