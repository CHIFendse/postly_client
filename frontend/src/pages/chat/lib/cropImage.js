import { getFileBaseName, getFileExtension, isImageType } from './files';

const MAX_OUTPUT_SIDE = 2400;
const OUTPUT_QUALITY = 0.92;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

function getOutputType(type) {
    if (type === 'image/png' || type === 'image/webp') return type;
    return 'image/jpeg';
}

const DEFAULT_EXT = { 'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg' };

// Вырезает область под рамкой и возвращает новое вложение.
// frame и bounds — в координатах сцены редактора: bounds — где нарисована
// картинка, frame — рамка кадрирования. Старая blob:-ссылка освобождается.
export async function cropImage(attachment, { frame, bounds }) {
    if (!isImageType(attachment?.type)) return attachment;

    const image = await loadImage(attachment.url);
    const naturalW = image.naturalWidth;
    const naturalH = image.naturalHeight;
    if (!naturalW || !naturalH || !bounds.width || !bounds.height) return attachment;

    const scaleX = bounds.width / naturalW;
    const scaleY = bounds.height / naturalH;

    const sx = clamp((frame.left - bounds.left) / scaleX, 0, naturalW);
    const sy = clamp((frame.top - bounds.top) / scaleY, 0, naturalH);
    const cropW = clamp(frame.width / scaleX, 1, naturalW - sx);
    const cropH = clamp(frame.height / scaleY, 1, naturalH - sy);

    const outputScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(cropW, cropH));
    const outW = Math.max(1, Math.round(cropW * outputScale));
    const outH = Math.max(1, Math.round(cropH * outputScale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return attachment;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sx, sy, cropW, cropH, 0, 0, outW, outH);

    const outputType = getOutputType(attachment.type);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, OUTPUT_QUALITY));
    if (!blob) return attachment;

    const ext = getFileExtension(attachment.originalName || attachment.name || '') || DEFAULT_EXT[outputType];
    const base = getFileBaseName(attachment.name || attachment.originalName) || 'Изображение';
    const finalName = `${base}${ext}`;

    if (attachment.url) URL.revokeObjectURL(attachment.url);

    return {
        ...attachment,
        name: finalName,
        size: blob.size,
        type: outputType,
        url: URL.createObjectURL(blob),
        file: new File([blob], finalName, { type: outputType }),
        originalName: attachment.originalName || attachment.name
    };
}
