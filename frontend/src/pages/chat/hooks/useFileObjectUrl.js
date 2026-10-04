import { useEffect, useState } from 'react';
import { isDirectUrl, loadFileObjectUrl } from '../lib/api';

// Ссылка, которую можно поставить в <img src>: серверные вложения
// скачиваются с токеном и превращаются в blob:
export default function useFileObjectUrl(fileUrl) {
    const [state, setState] = useState({ src: null, error: false });

    useEffect(() => {
        if (!fileUrl) { setState({ src: null, error: true }); return undefined; }
        if (isDirectUrl(fileUrl)) { setState({ src: fileUrl, error: false }); return undefined; }

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
