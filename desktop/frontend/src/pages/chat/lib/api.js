import { _fileBlobCache } from '../../../components/messagesCache';
import { SaveFile } from '@bindings/client/components/filesaver';

export const API_BASE = 'https://api.postly-mes.ru:8081';
// Выдаёт presigned PUT-ссылку в S3 и ключ объекта.
// Ключ уходит в WS как file_url — сервер сам меняет его на ссылку для скачивания.
const UPLOAD_URL_ENDPOINT = `${API_BASE}/getUploadUrl`;

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

// Загружает файл в S3 и возвращает ключ объекта
export async function uploadAttachment(file, token, onProgress) {
    const { uploadUrl, s3Key } = await requestUploadUrl(file, token);
    await putFile(uploadUrl, file, onProgress);
    return s3Key;
}

// blob: и абсолютные ссылки используем как есть — токен на чужой хост не отправляем
export const isDirectUrl = url => /^(blob:|data:|https?:)/.test(url || '');

// file_url с сервера — относительный путь к /file, требует JWT.
// Скачиваем с заголовком и отдаём blob.
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
export function loadFileObjectUrl(fileUrl) {
    if (!_fileBlobCache.has(fileUrl)) {
        const p = fetchFileBlob(fileUrl).then(blob => URL.createObjectURL(blob));
        p.catch(() => _fileBlobCache.delete(fileUrl));
        _fileBlobCache.set(fileUrl, p);
    }
    return _fileBlobCache.get(fileUrl);
}

export async function downloadFile(fileUrl, fileName) {
    if (/^(blob:|data:)/.test(fileUrl || '')) {
        const blob = await fetch(fileUrl).then(response => {
            if (!response.ok) throw new Error(`blob download: ${response.status}`);
            return response.blob();
        });

        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName || 'file',
                types: [{
                    description: 'Файл',
                    accept: { [blob.type || 'application/octet-stream']: ['.' + ((fileName || 'file').split('.').pop() || 'bin')] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }

        const href = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = fileName || 'file';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10000);
        return;
    }

    const token = localStorage.getItem('jwt_token');
    await SaveFile(fileUrl, fileName || 'file', token || '');
}
