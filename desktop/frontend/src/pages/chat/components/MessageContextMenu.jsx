import './MessageContextMenu.css';
import { CopyIcon, TrashIcon } from './icons';

export default function MessageContextMenu({ menu, onCopy, onDelete }) {
    return (
        <div
            className="msg-ctx-menu"
            style={{ position: 'fixed', left: menu.x, top: menu.y }}
            onClick={e => e.stopPropagation()}
        >
            <button className="ctx-item" onClick={onCopy}>
                <CopyIcon />
                Копировать текст
            </button>
            {menu.canDelete && (
                <button className="ctx-item ctx-item-danger" onClick={onDelete}>
                    <TrashIcon />
                    Удалить сообщение
                </button>
            )}
        </div>
    );
}
