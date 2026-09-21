import { createContext, useContext, useState, useEffect } from 'react';

export const themes = [
  {
    id: 'orange',
    name: 'Оранжевый',
    emoji: '🔥',
    preview: '#FF7A00',
    previewBg: '#1a1815',
    vars: {
      '--clr-primary':      '#FF7A00',
      '--clr-primary-hover':'#FF9500',
      '--clr-primary-dim':  'rgba(255, 122, 0, 0.14)',
      '--clr-danger':       '#ef4444',
      '--clr-danger-hover': '#dc2626',
      '--clr-success':      '#22c55e',
      '--bg-app':           '#1a1815',
      '--bg-sidebar':       '#1e1b17',
      '--bg-surface':       '#231f1b',
      '--bg-elevated':      '#2a2621',
      '--bg-hover':         '#312c27',
      '--bg-active':        '#3d3730',
      '--bg-input':         '#141210',
      '--bg-chat':          '#1f1c18',
      '--txt-primary':      '#f0ede8',
      '--txt-secondary':    '#9e9890',
      '--txt-muted':        '#665f58',
      '--txt-accent':       '#FF7A00',
      '--border-subtle':    '#28241f',
      '--border-medium':    '#35302a',
      '--border-accent':    '#c68325',
      '--header-bg':        '#c68325',
      '--header-txt':       '#fff7ee',
      '--msg-sent-bg':      '#c68325',
      '--msg-recv-bg':      '#2a2621',
      '--scrollbar-thumb':  '#35302a',
      '--shadow':           'rgba(0, 0, 0, 0.45)',
      '--icon-filter':      'invert(75%) sepia(60%) saturate(4000%) hue-rotate(3deg) brightness(110%) contrast(105%)',
    }
  },
  {
    id: 'midnight',
    name: 'Полуночный',
    emoji: '🌙',
    preview: '#5865F2',
    previewBg: '#0d0e14',
    vars: {
      '--clr-primary':      '#5865F2',
      '--clr-primary-hover':'#7289DA',
      '--clr-primary-dim':  'rgba(88, 101, 242, 0.14)',
      '--clr-danger':       '#ef4444',
      '--clr-danger-hover': '#dc2626',
      '--clr-success':      '#22c55e',
      '--bg-app':           '#0d0e14',
      '--bg-sidebar':       '#111421',
      '--bg-surface':       '#151928',
      '--bg-elevated':      '#1c2035',
      '--bg-hover':         '#1f2540',
      '--bg-active':        '#242c4a',
      '--bg-input':         '#0a0b12',
      '--bg-chat':          '#131520',
      '--txt-primary':      '#e8eaf2',
      '--txt-secondary':    '#8b93b0',
      '--txt-muted':        '#5a6280',
      '--txt-accent':       '#7289DA',
      '--border-subtle':    '#181c30',
      '--border-medium':    '#1e2540',
      '--border-accent':    '#3b4db8',
      '--header-bg':        '#3b4db8',
      '--header-txt':       '#e8eaf2',
      '--msg-sent-bg':      '#3b4db8',
      '--msg-recv-bg':      '#1c2035',
      '--scrollbar-thumb':  '#1e2540',
      '--shadow':           'rgba(0, 0, 0, 0.55)',
      '--icon-filter':      'invert(44%) sepia(90%) saturate(2000%) hue-rotate(215deg) brightness(105%) contrast(105%)',
    }
  },
  {
    id: 'neon',
    name: 'Киберпанк',
    emoji: '⚡',
    preview: '#00ff88',
    previewBg: '#050505',
    vars: {
      '--clr-primary':      '#00ff88',
      '--clr-primary-hover':'#33ffaa',
      '--clr-primary-dim':  'rgba(0, 255, 136, 0.12)',
      '--clr-danger':       '#ff3366',
      '--clr-danger-hover': '#ff0044',
      '--clr-success':      '#00ff88',
      '--bg-app':           '#050505',
      '--bg-sidebar':       '#080808',
      '--bg-surface':       '#0b0b0b',
      '--bg-elevated':      '#101010',
      '--bg-hover':         '#141414',
      '--bg-active':        '#1a1a1a',
      '--bg-input':         '#060606',
      '--bg-chat':          '#070707',
      '--txt-primary':      '#c8ffe0',
      '--txt-secondary':    '#4aaa70',
      '--txt-muted':        '#1f5035',
      '--txt-accent':       '#00ff88',
      '--border-subtle':    '#0a1e14',
      '--border-medium':    '#0f2a1c',
      '--border-accent':    '#00cc66',
      '--header-bg':        '#003322',
      '--header-txt':       '#00ff88',
      '--msg-sent-bg':      '#003d20',
      '--msg-recv-bg':      '#0f1410',
      '--scrollbar-thumb':  '#0f2a1c',
      '--shadow':           'rgba(0, 255, 136, 0.08)',
      '--icon-filter':      'invert(88%) sepia(100%) saturate(500%) hue-rotate(96deg) brightness(120%) contrast(120%)',
    }
  },
  {
    id: 'sakura',
    name: 'Сакура',
    emoji: '🌸',
    preview: '#ff4d8a',
    previewBg: '#1a0f18',
    vars: {
      '--clr-primary':      '#ff4d8a',
      '--clr-primary-hover':'#ff6b9d',
      '--clr-primary-dim':  'rgba(255, 77, 138, 0.14)',
      '--clr-danger':       '#ef4444',
      '--clr-danger-hover': '#dc2626',
      '--clr-success':      '#22c55e',
      '--bg-app':           '#1a0f18',
      '--bg-sidebar':       '#1e121c',
      '--bg-surface':       '#231520',
      '--bg-elevated':      '#2c1a2a',
      '--bg-hover':         '#321e30',
      '--bg-active':        '#3a2038',
      '--bg-input':         '#150c13',
      '--bg-chat':          '#1c1019',
      '--txt-primary':      '#f0e8ef',
      '--txt-secondary':    '#a08898',
      '--txt-muted':        '#6e5a68',
      '--txt-accent':       '#ff6b9d',
      '--border-subtle':    '#281524',
      '--border-medium':    '#3c1f38',
      '--border-accent':    '#c0285a',
      '--header-bg':        '#7a1f50',
      '--header-txt':       '#ffe0ef',
      '--msg-sent-bg':      '#7a1f50',
      '--msg-recv-bg':      '#2c1a2a',
      '--scrollbar-thumb':  '#3c1f38',
      '--shadow':           'rgba(0, 0, 0, 0.5)',
      '--icon-filter':      'invert(50%) sepia(96%) saturate(2500%) hue-rotate(305deg) brightness(110%) contrast(110%)',
    }
  },
  {
    id: 'emerald',
    name: 'Изумруд',
    emoji: '💎',
    preview: '#10b981',
    previewBg: '#0b1410',
    vars: {
      '--clr-primary':      '#10b981',
      '--clr-primary-hover':'#34d399',
      '--clr-primary-dim':  'rgba(16, 185, 129, 0.14)',
      '--clr-danger':       '#ef4444',
      '--clr-danger-hover': '#dc2626',
      '--clr-success':      '#10b981',
      '--bg-app':           '#0b1410',
      '--bg-sidebar':       '#0e1813',
      '--bg-surface':       '#111c16',
      '--bg-elevated':      '#17261e',
      '--bg-hover':         '#1c2e24',
      '--bg-active':        '#20352a',
      '--bg-input':         '#080e0b',
      '--bg-chat':          '#0f1912',
      '--txt-primary':      '#e8f0ed',
      '--txt-secondary':    '#7a9e8a',
      '--txt-muted':        '#4a6a5a',
      '--txt-accent':       '#10b981',
      '--border-subtle':    '#122016',
      '--border-medium':    '#1e3225',
      '--border-accent':    '#0d6e47',
      '--header-bg':        '#0d6e47',
      '--header-txt':       '#e0fff0',
      '--msg-sent-bg':      '#0d6e47',
      '--msg-recv-bg':      '#17261e',
      '--scrollbar-thumb':  '#1e3225',
      '--shadow':           'rgba(0, 0, 0, 0.5)',
      '--icon-filter':      'invert(62%) sepia(68%) saturate(600%) hue-rotate(120deg) brightness(96%) contrast(95%)',
    }
  }
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('postly_theme') || 'orange';
  });

  const applyTheme = (id) => {
    const theme = themes.find(t => t.id === id) || themes[0];
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-theme', id);
  };

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Применяем тему при первом рендере
  useEffect(() => {
    applyTheme(themeId);
  }, []);

  const setTheme = (id) => {
    setThemeId(id);
    localStorage.setItem('postly_theme', id);
  };

  const currentTheme = themes.find(t => t.id === themeId) || themes[0];

  return (
    <ThemeContext.Provider value={{ themeId, currentTheme, themes, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
