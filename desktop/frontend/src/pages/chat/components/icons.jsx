export function FileIcon({ size = 21, strokeWidth = 1.8 }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
            <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
    );
}

export function ImageIcon({ size = 19 }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
            <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="m5 17 4.5-4 3 2.5 2-2 4.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SendIcon({ size = 18 }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" width={size} height={size}>
            <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function PaperclipIcon({ className }) {
    return (
        <svg
            className={className}
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
    );
}

export function CopyIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

export function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}
