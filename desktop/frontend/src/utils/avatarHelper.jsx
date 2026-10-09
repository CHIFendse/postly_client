// Список цветов, общий для всего приложения
export const avatarColors = [
    '#2ecc71', '#3498db', '#9b59b6', '#e67e22', 
    '#e74c3c', '#1abc9c', '#2c3e50', '#d35400',
    '#f1c40f', '#8e44ad', '#16a085', '#27ae60'
];

/**
 * Генерирует стабильный цвет на основе строки (имени или ID)
 */
export const getAvatarColor = (name) => {
    if (!name) return '#7f8c8d';
    let hash = 0;
    const str = String(name);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % avatarColors.length;
    return avatarColors[index];
};

/**
 * Возвращает первую букву имени в верхнем регистре
 */
export const getFirstLetter = (name) => {
    if (!name) return '?';
    return String(name).trim().charAt(0).toUpperCase();
};