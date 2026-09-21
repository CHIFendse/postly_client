import './SettingsModal.css';
import { useTheme } from '../context/ThemeContext';

function SettingsModal({ isOpen, onClose, currentVersion }) {
  const { themeId, themes, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <div className="settings-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="settings-header-icon">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="settings-title">Настройки</h2>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Закрыть">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Секция тем */}
          <div className="settings-section">
            <div className="section-label-row">
              <span className="settings-section-label">🎨 Тема оформления</span>
              <span className="settings-section-hint">
                {themes.find(t => t.id === themeId)?.name ?? ''}
              </span>
            </div>

            <div className="theme-grid">
              {themes.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-card ${themeId === theme.id ? 'active' : ''}`}
                  onClick={() => setTheme(theme.id)}
                  title={theme.name}
                >
                  {/* цветной кружок-превью */}
                  <div
                    className="theme-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${theme.preview} 0%, ${theme.previewBg} 100%)`,
                    }}
                  >
                    <span className="theme-emoji">{theme.emoji}</span>
                    {themeId === theme.id && (
                      <div className="theme-check">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className="theme-name">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Разделитель */}
          <div className="settings-divider" />

          {/* Информация о версии */}
          <div className="settings-section settings-footer-info">
            <span className="settings-version">Postly — версия 0.0.1</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default SettingsModal;
