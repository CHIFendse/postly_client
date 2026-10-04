import { useEffect, useRef, useState } from 'react';

const STAGE_PADDING = 40;
const MIN_FRAME_ON_FIT = 120;
const MIN_FRAME_ON_RESIZE = 90;

// Масштаб, с которым картинка целиком влезает в сцену
function getFitScale(stageW, stageH, natW, natH) {
    return Math.min((stageW - STAGE_PADDING) / natW, (stageH - STAGE_PADDING) / natH);
}

// Редактор кадрирования: картинка вписана в сцену, рамка двигается и
// тянется за ручки, но не выходит за границы картинки.
// Границы картинки берутся DOM-замером <img>, расчёт — запасной вариант
export default function useImageCrop(imageUrl) {
    const [stageEl, setStageEl] = useState(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [frame, setFrame] = useState(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const resizeRef = useRef(null);

    // Рамка — на всю картинку, по центру сцены
    const applyLayout = (stageWidth, stageHeight, natW, natH) => {
        if (!stageWidth || !stageHeight || !natW || !natH) return;
        const fitScale = getFitScale(stageWidth, stageHeight, natW, natH);
        const renderedW = natW * fitScale;
        const renderedH = natH * fitScale;
        const left = Math.round((stageWidth - renderedW) / 2);
        const top = Math.round((stageHeight - renderedH) / 2);

        const cropW = Math.max(MIN_FRAME_ON_FIT, Math.round(renderedW));
        const cropH = Math.max(MIN_FRAME_ON_FIT, Math.round(renderedH));
        setFrame({
            left: Math.round(left + (renderedW - cropW) / 2),
            top: Math.round(top + (renderedH - cropH) / 2),
            width: cropW,
            height: cropH
        });
    };

    // Новая картинка — всё сначала
    useEffect(() => {
        setNaturalSize({ width: 0, height: 0 });
        setFrame(null);
    }, [imageUrl]);

    // Размер сцены меняется (появление панели, ресайз окна, клавиатура на
    // мобилке) — пересчитываем. Дозамеры через rAF/таймеры ловят момент,
    // когда панель уже разложилась
    useEffect(() => {
        if (!stageEl) return undefined;

        const updateSize = () => {
            const rect = stageEl.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            setStageSize({ width, height });
            applyLayout(width, height, naturalSize.width, naturalSize.height);
        };

        updateSize();
        const raf = requestAnimationFrame(updateSize);
        const timers = [setTimeout(updateSize, 30), setTimeout(updateSize, 80)];
        const observer = new ResizeObserver(updateSize);
        observer.observe(stageEl);
        window.addEventListener('resize', updateSize);
        window.visualViewport?.addEventListener('resize', updateSize);

        return () => {
            cancelAnimationFrame(raf);
            timers.forEach(clearTimeout);
            observer.disconnect();
            window.removeEventListener('resize', updateSize);
            window.visualViewport?.removeEventListener('resize', updateSize);
        };
    }, [stageEl, naturalSize.width, naturalSize.height]);

    const onImageLoad = e => {
        const w = e.currentTarget.naturalWidth;
        const h = e.currentTarget.naturalHeight;
        if (!w || !h) return;
        setNaturalSize({ width: w, height: h });
        if (!stageEl) return;
        const rect = stageEl.getBoundingClientRect();
        if (rect.width && rect.height) {
            setStageSize({ width: rect.width, height: rect.height });
            applyLayout(rect.width, rect.height, w, h);
        }
    };

    // Расчётный размер картинки в сцене
    const getCropMetrics = () => {
        const frameW = frame?.width || 0;
        const frameH = frame?.height || 0;
        const naturalW = naturalSize.width;
        const naturalH = naturalSize.height;
        const stageW = stageSize.width || stageEl?.getBoundingClientRect().width || 0;
        const stageH = stageSize.height || stageEl?.getBoundingClientRect().height || 0;

        if (!frameW || !frameH || !naturalW || !naturalH || !stageW || !stageH) return null;

        const fitScale = getFitScale(stageW, stageH, naturalW, naturalH);
        return {
            frameW,
            frameH,
            naturalW,
            naturalH,
            renderedW: naturalW * fitScale,
            renderedH: naturalH * fitScale
        };
    };

    // То же, но по фактическому положению <img> в DOM
    const getActualCropMetrics = () => {
        const metrics = getCropMetrics();
        const image = imageRef.current;
        if (!metrics || !stageEl || !image) return metrics;

        const stageRect = stageEl.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height) {
            return metrics;
        }

        return {
            ...metrics,
            renderedW: imageRect.width,
            renderedH: imageRect.height,
            imageLeft: imageRect.left - stageRect.left,
            imageTop: imageRect.top - stageRect.top
        };
    };

    // Границы картинки в координатах сцены
    const getImageBounds = () => {
        const metrics = getActualCropMetrics();
        if (!metrics) return null;
        const left = metrics.imageLeft ?? (stageSize.width - metrics.renderedW) / 2;
        const top = metrics.imageTop ?? (stageSize.height - metrics.renderedH) / 2;
        return {
            left,
            top,
            right: left + metrics.renderedW,
            bottom: top + metrics.renderedH,
            width: metrics.renderedW,
            height: metrics.renderedH
        };
    };

    // ---- Перетаскивание рамки целиком ----
    const onFramePointerDown = e => {
        if (!frame) return;
        // Если кликнули по ручкам ресайза, не запускаем перетаскивание всей рамки
        if (e.target.classList.contains('crop-resize-handle') || e.target.classList.contains('crop-corner')) return;

        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, startRect: { ...frame } };
    };

    const onFramePointerMove = e => {
        const drag = dragRef.current;
        if (!drag || !frame) return;
        const b = getImageBounds();
        if (!b) return;

        // Рамка не вылезает за края картинки
        const left = Math.max(b.left, Math.min(b.right - frame.width, drag.startRect.left + e.clientX - drag.startX));
        const top = Math.max(b.top, Math.min(b.bottom - frame.height, drag.startRect.top + e.clientY - drag.startY));

        setFrame(prev => (prev ? { ...prev, left: Math.round(left), top: Math.round(top) } : null));
    };

    const onFramePointerUp = e => {
        if (!dragRef.current) return;
        dragRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    // ---- Изменение размера за ручки ----
    const onResizePointerDown = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();
        if (!frame) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        resizeRef.current = { startX: e.clientX, startY: e.clientY, startRect: { ...frame }, direction };
    };

    const onResizePointerMove = e => {
        const resize = resizeRef.current;
        if (!resize || !stageSize.width || !stageSize.height) return;
        const b = getImageBounds();
        if (!b) return;

        const start = resize.startRect;
        const dir = resize.direction;
        const dx = e.clientX - resize.startX;
        const dy = e.clientY - resize.startY;
        const minW = MIN_FRAME_ON_RESIZE;
        const minH = MIN_FRAME_ON_RESIZE;

        let left = start.left;
        let top = start.top;
        let right = start.left + start.width;
        let bottom = start.top + start.height;

        if (dir.includes('e')) right = Math.min(b.right, Math.max(left + minW, start.left + start.width + dx));
        if (dir.includes('w')) left = Math.max(b.left, Math.min(right - minW, start.left + dx));
        if (dir.includes('s')) bottom = Math.min(b.bottom, Math.max(top + minH, start.top + start.height + dy));
        if (dir.includes('n')) top = Math.max(b.top, Math.min(bottom - minH, start.top + dy));

        // Жёсткие рамки границ картинки при ресайзе
        left = Math.max(b.left, Math.min(b.right - minW, left));
        right = Math.max(left + minW, Math.min(b.right, right));
        top = Math.max(b.top, Math.min(b.bottom - minH, top));
        bottom = Math.max(top + minH, Math.min(b.bottom, bottom));

        setFrame({
            left: Math.round(left),
            top: Math.round(top),
            width: Math.round(right - left),
            height: Math.round(bottom - top)
        });
    };

    const onResizePointerUp = e => {
        resizeRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    // Для cropImage: где рамка и где картинка на момент отправки
    const getRegion = () => {
        const bounds = frame && getImageBounds();
        return bounds ? { frame, bounds } : null;
    };

    const metrics = getCropMetrics();

    return {
        stageRef: setStageEl,
        imageRef,
        imageSize: { width: metrics?.renderedW || 0, height: metrics?.renderedH || 0 },
        frame,
        onImageLoad,
        onFramePointerDown,
        onFramePointerMove,
        onFramePointerUp,
        onResizePointerDown,
        onResizePointerMove,
        onResizePointerUp,
        getRegion
    };
}
