import { useEffect, useState } from 'react';
import './Settings.css';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import AvatarGallery from '../components/AvatarGallery';
import AvatarCropModal from '../components/AvatarCropModal';
import { getAvatarUrl, loadAvatarObjectUrl, uploadAvatar, deleteAvatar, clearAvatarCache, getAvatars } from '../utils/avatarApi';

/* ── Секции настроек (для будущих пунктов добавить сюда) ── */
const NAV_ITEMS = [
  { id: 'appearance', label: 'Внешний вид', icon: (
    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  )},
  { id: 'account', label: 'Аккаунт', icon: (
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
  const primaryThemes = themes.filter(theme => theme.id === 'orange' || theme.id === 'light');
  const accentThemes = themes.filter(theme => theme.id !== 'orange' && theme.id !== 'light');

  return (
    <div className="settings-section">
      <div className="settings-section-title">Тема оформления</div>
      <p className="settings-section-desc">Выберите цветовую схему интерфейса</p>

      <div className="theme-primary-row">
        {primaryThemes.map(theme => (
          <button
            key={theme.id}
            className={`theme-primary ${themeId === theme.id ? 'active' : ''}`}
            onClick={() => setTheme(theme.id)}
            title={theme.name}
          >
            <div className="theme-primary-preview" style={{ '--theme-color': theme.preview, '--theme-bg': theme.previewBg }}>
              {themeId === theme.id && (
                <div className="theme-check">
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
            <span>{theme.name}</span>
          </button>
        ))}
      </div>

      <div className="theme-accent-label">Дополнительные</div>
      <div className="theme-accent-row">
        {accentThemes.map(theme => (
          <button
            key={theme.id}
            className={`theme-accent ${themeId === theme.id ? 'active' : ''}`}
            onClick={() => setTheme(theme.id)}
            title={theme.name}
            aria-label={theme.name}
          >
            <span style={{ '--theme-color': theme.preview, '--theme-bg': theme.previewBg }}>
              {themeId === theme.id && <b>✓</b>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── О приложении ── */
function AboutSection() {
  return (
    <div className="settings-section">
      <div className="settings-section-title">О приложении</div>
      <div className="about-card">
        <div className="about-logo">✦ Postly</div>
        <div className="about-version">Версия 0.1.1</div>
        <div className="about-desc">Производительный мессенджер с открытым исходным кодом.</div>
      </div>
    </div>
  );
}

function AccountSection() {
  const userId = localStorage.getItem('id') || '';
  const username = localStorage.getItem('username') || '';
  const [cropFile, setCropFile] = useState(null);
  const [version, setVersion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [avatarHistory, setAvatarHistory] = useState([]);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAvatarHistory = async () => {
    try {
      const entries = await getAvatars();
      const loaded = await Promise.all((Array.isArray(entries) ? entries : []).map(async entry => ({
        ...entry,
        src: await loadAvatarObjectUrl(entry.url || getAvatarUrl(userId))
      })));
      setAvatarHistory(loaded.filter(entry => entry.src));
    } catch (err) {
      console.error('Ошибка загрузки истории аватарок:', err);
      setAvatarHistory([]);
    }
  };

  useEffect(() => { loadAvatarHistory(); }, [userId]);

  const chooseAvatar = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение');
      return;
    }
    setError('');
    setCropFile(file);
  };

  const saveAvatar = async file => {
    setUploading(true);
    setError('');
    try {
      await uploadAvatar(file);
      clearAvatarCache(userId);
      setVersion(String(Date.now()));
      await loadAvatarHistory();
      setCropFile(null);
    } catch (err) {
      setError('Не удалось установить аватарку');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async selected => {
    if (!selected?.s3_key || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteAvatar(selected.s3_key);
      clearAvatarCache(userId);
      setVersion(String(Date.now()));
      setShowAvatarGallery(false);
      await loadAvatarHistory();
    } catch (err) {
      setError('Не удалось удалить аватарку');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="settings-section account-section">
      <div className="account-profile-heading">
        <div>
          <div className="settings-section-kicker">Личный профиль</div>
          <div className="settings-section-title">Аккаунт</div>
          <p className="settings-section-desc">Ваше изображение и история аватарок</p>
        </div>
        <div className="account-profile-status"><span />В сети</div>
      </div>

      <div className="account-profile-hero">
        <div className="account-profile-avatar-wrap">
          <Avatar
            userId={userId}
            name={username}
            size={132}
            version={version}
            onClick={() => avatarHistory.length > 0 && setShowAvatarGallery(true)}
          />
          <span className="account-profile-online" />
        </div>
        <div className="account-profile-identity">
          <h2>{username}</h2>
          <span className="account-profile-id">ID пользователя: {userId}</span>
          <label className="account-avatar-button">
            {uploading ? 'Загрузка...' : 'Изменить аватарку'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} disabled={uploading} />
          </label>
          {error && <span className="account-avatar-error">{error}</span>}
        </div>
      </div>
      {showAvatarGallery && avatarHistory.length > 0 && (
        <AvatarGallery
          avatars={avatarHistory.map(avatar => ({
            ...avatar,
            downloadUrl: avatar.url
          }))}
          onClose={() => setShowAvatarGallery(false)}
          onDelete={removeAvatar}
        />
      )}
      {cropFile && <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={saveAvatar} />}
    </div>
  );
}

/* ── Главный компонент ── */
function Settings({ onBack }) {
  const [activeSection, setActiveSection] = useState('appearance');

  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':    return <AppearanceSection />;
      case 'account':       return <AccountSection />;
      case 'about':         return <AboutSection/>;
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
