const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const isImageType = type => String(type || '').startsWith('image/');

export function getFileExtension(name) {
    const clean = String(name || '').split(/[\\/]/).pop();
    const dot = clean.lastIndexOf('.');
    return dot > 0 ? clean.slice(dot) : '';
}

export function getFileBaseName(name) {
    const ext = getFileExtension(name);
    return ext ? String(name).slice(0, -ext.length) : String(name || '');
}

// Вложение, выбранное пользователем, но ещё не отправленное.
// url — blob:-ссылка для превью, её нужно освобождать (URL.revokeObjectURL)
export function createAttachment(file) {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE) {
        window.alert('Файл слишком большой. Максимальный размер — 50 МБ.');
        return null;
    }
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: URL.createObjectURL(file),
        file,
        originalName: file.name
    };
}

// Расширение не редактируется: если пользователь всё же его допечатал — срезаем
export function renameAttachment(attachment, rawBaseName) {
    if (!attachment) return attachment;
    const ext = getFileExtension(attachment.originalName || attachment.name || '');
    const escaped = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const base = rawBaseName.replace(new RegExp(`${escaped}$`, 'i'), '');
    return { ...attachment, name: `${base || 'Без имени'}${ext}` };
}
