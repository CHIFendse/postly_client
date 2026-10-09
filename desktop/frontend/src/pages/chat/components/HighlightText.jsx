// Подсвечивает все вхождения query в тексте (поиск по чату)
export default function HighlightText({ text, query, active }) {
    if (!query || !text) return <>{text}</>;
    const parts = [];
    const q = query.toLowerCase();
    const lower = text.toLowerCase();
    let searchFrom = 0;
    while (true) {
        const idx = lower.indexOf(q, searchFrom);
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
