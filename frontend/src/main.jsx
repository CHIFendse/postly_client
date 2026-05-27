import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './style.css';
import App from './app'; // Твой текущий VoiceChat интерфейс
import CallWindow from './components/CallWindow';
import { GetCurrentVersion } from '@bindings/client/components/currentversion';

const lastVersion = "0.0.1";
const currentVersion = GetCurrentVersion();
const container = document.getElementById('root');
const root = createRoot(container); 

async function initApp() {
    try {
        const currentVersion = await GetCurrentVersion();
        if (lastVersion < currentVersion.version) {
            alert(`Пожалуйста, обновите приложение!\nТребуемая: ${currentVersion.version}\nТекущая: ${lastVersion}`);
        }
    } catch (e) {
        console.error("Не удалось проверить версию:", e);
    }

    root.render(
        <Router>
            <Routes>
                <Route path="/" element={<App currentVersion={lastVersion} />} />
                <Route path="/call/:chatId/:userName" element={<CallWindow />} />
                <Route path="/call/:chatId/:userName/:typing" element={<CallWindow />} />
            </Routes>
        </Router>
    );
}

// Запускаем инициализацию
initApp();