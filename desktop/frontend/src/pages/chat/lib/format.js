export function formatFileSize(bytes) {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

const AVATAR_COLORS = [
    '#e67e22', '#3498db', '#9b59b6', '#1abc9c',
    '#e74c3c', '#f1c40f', '#2ecc71', '#34495e'
];

export function getAvatarColor(name = '') {
    const str = String(name);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
