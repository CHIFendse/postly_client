import { useCallback, useRef } from 'react';
import { SendWSMessage } from '@bindings/client/pages/chatws';
import { uploadAttachment } from '../lib/api';
import { getMyId, getMyUsername } from '../lib/messages';
import { isImageType } from '../lib/files';

// Сколько ждём NEW_MESSAGE от сервера, прежде чем показать «Не отправлено»
const CONFIRM_TIMEOUT_MS = 20_000;

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

// Отправка с оптимистичным показом: сообщение сразу появляется с tmp-id,
// а после NEW_MESSAGE от сервера applyNewMessage меняет его на настоящее
export default function useMessageSender({ token, updateMessages }) {
    const inFlightRef = useRef(new Set());

    // patch — объект или функция от текущего сообщения
    const patchMessage = useCallback((chatId, id, patch) => {
        updateMessages(chatId, list => list.map(m => (
            m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m
        )));
    }, [updateMessages]);

    // Сервер принимает только map[string]string — все значения строками
    const deliverOnce = async (chatId, msg) => {
        const att = msg.attachment;
        // Метка попытки: таймер подтверждения от прошлой попытки
        // не должен пометить ошибкой повтор, который ещё идёт
        const attempt = `${Date.now()}_${randomSuffix()}`;
        let s3Key = msg.s3Key;

        // Файл уже лежит в S3 (упала только отправка по WS) — повторно не грузим
        if (att && !s3Key) {
            patchMessage(chatId, msg.id, { status: 'uploading', progress: 0, attempt });
            try {
                let lastPct = 0;
                s3Key = await uploadAttachment(att.file, token || localStorage.getItem('jwt_token'), p => {
                    const pct = Math.round(p * 100);
                    if (pct === lastPct) return;
                    lastPct = pct;
                    patchMessage(chatId, msg.id, { progress: pct });
                });
            } catch (err) {
                console.error('Ошибка загрузки файла:', err);
                patchMessage(chatId, msg.id, { status: 'error', progress: null });
                return;
            }
        }

        // И для текста тоже: при повторе «Не отправлено» сменяется спиннером
        patchMessage(chatId, msg.id, { status: 'sending', progress: null, attempt, ...(s3Key && { s3Key }) });

        const payload = {
            type: att ? att.kind : 'text',
            chat_id: String(chatId),
            sender_id: String(getMyId()),
            username: getMyUsername() || '',
            text: msg.text || ''
        };
        if (att) {
            payload.file_url = s3Key;
            payload.file_name = att.name;
            payload.file_size = String(att.size);
        }

        try {
            await SendWSMessage(JSON.stringify(payload));
        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            patchMessage(chatId, msg.id, { status: 'error' });
            return;
        }

        // Сервер не подтвердил — даём повторить. После подтверждения
        // tmp-id заменён на настоящий, и патч ничего не найдёт
        setTimeout(() => {
            patchMessage(chatId, msg.id, m => (
                m.status === 'sending' && m.attempt === attempt ? { status: 'error' } : {}
            ));
        }, CONFIRM_TIMEOUT_MS);
    };

    const deliver = async (chatId, msg) => {
        // Защита от двойного запуска (двойной клик по «Повторить»)
        if (inFlightRef.current.has(msg.id)) return;
        inFlightRef.current.add(msg.id);
        try {
            await deliverOnce(chatId, msg);
        } finally {
            inFlightRef.current.delete(msg.id);
        }
    };

    const sendMessage = (chatId, text, attachment) => {
        const localMessage = {
            id: `tmp_${Date.now()}_${randomSuffix()}`,
            chat_id: chatId,
            sender_id: getMyId(),
            username: getMyUsername(),
            text,
            created_at: new Date().toISOString(),
            status: 'sending',
            attachment: attachment ? {
                id: attachment.id,
                kind: isImageType(attachment.type) ? 'image' : 'file',
                name: attachment.name,
                size: attachment.size,
                type: attachment.type,
                url: attachment.url,
                file: attachment.file
            } : null
        };

        updateMessages(chatId, list => [...list, localMessage]);
        deliver(chatId, localMessage);
    };

    const retryMessage = (chatId, msg) => {
        if (msg.status !== 'error') return;
        deliver(chatId, msg);
    };

    return { sendMessage, retryMessage };
}
