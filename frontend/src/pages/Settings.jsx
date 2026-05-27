import { useState } from 'react';
import './Settings.css';
import { useTheme } from '../context/ThemeContext';

/* ── Секции настроек (для будущих пунктов добавить сюда) ── */
const NAV_ITEMS = [
  { id: 'appearance', label: 'Внешний вид', icon: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )},
  { id: 'account', label: 'Аккаунт', disabled: true, icon: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )},
  { id: 'notifications', label: 'Уведомления', disabled: true, icon: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { id: 'about', label: 'О приложении', icon: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )},
];

/* ── Внешний вид ── */
function AppearanceSection() {
  const { themeId, themes, setTheme } = useTheme();

  return (
    <div className="settings-section">
      <div className="settings-section-title">Тема оформления</div>
      <p className="settings-section-desc">Выберите цветовую схему интерфейса</p>

      <div className="theme-grid">
        {themes.map(theme => (
          <button
            key={theme.id}
            className={`theme-card ${themeId === theme.id ? 'active' : ''}`}
            onClick={() => setTheme(theme.id)}
            title={theme.name}
          >
            <div
              className="theme-swatch"
              style={{
                background: `linear-gradient(135deg, ${theme.preview} 0%, ${theme.previewBg} 100%)`,
              }}
            >
              <span className="theme-emoji">{theme.emoji}</span>
              {themeId === theme.id && (
                <div className="theme-check">
                  <svg viewBox="0 0 12 12" fill="none">
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
  );
}

/* ── О приложении ── */
function AboutSection({ currentVersion }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">О приложении</div>
      <div className="about-card">
        <div className="about-logo">✦ Postly</div>
        <div className="about-version">Версия {currentVersion || '0.0.1'}</div>
        <div className="about-desc">Современный мессенджер с голосовыми вызовами</div>
      </div>
    </div>
  );
}

/* ── Главный компонент ── */
function Settings({ onBack, currentVersion }) {
  const [activeSection, setActiveSection] = useState('appearance');

  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':    return <AppearanceSection />;
      case 'about':         return <AboutSection currentVersion={currentVersion} />;
      default:              return (
        <div className="settings-section settings-soon">
          <div className="settings-soon-icon">🔧</div>
          <div className="settings-soon-text">Скоро появится</div>
        </div>
      );
    }
  };

  return (
    <div className="settings-page">
      {/* ── Шапка ── */}
      <div className="settings-topbar">
        <button className="settings-back-btn" onClick={onBack} title="Назад">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="settings-topbar-title">Настройки</span>
      </div>

      {/* ── Тело: nav + content ── */}
      <div className="settings-body">
        {/* Левая навигация */}
        <nav className="settings-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`settings-nav-item ${activeSection === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => !item.disabled && setActiveSection(item.id)}
              title={item.disabled ? 'Скоро' : item.label}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              <span className="settings-nav-label">{item.label}</span>
              {item.disabled && <span className="settings-nav-soon">скоро</span>}
            </button>
          ))}
        </nav>

        {/* Правая область */}
        <div className="settings-content">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}

export default Settings;
