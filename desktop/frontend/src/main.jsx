import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './style.css';
import App from './app'; 
import CallWindow from './components/CallWindow';
import { GetCurrentVersion } from '@bindings/client/components/currentversion';

const lastVersion = "0.1.1";

// Функция для показа модалки
function showUpdateModal(required, current) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box">
            <h2>Обновление приложения</h2>
            <p>Доступна новая версия. Пожалуйста, обновите приложение для продолжения работы.</p>
            <div class="modal-versions">
                <div>
                    <span>Текущая</span>
                    <b>${current}</b>
                </div>
                <div>
                    <span>Требуемая</span>
                    <b style="color: #b87a3b;">${required}</b>
                </div>
            </div>
            <a href="https://postly-mes.ru/download/" target="_blank" class="modal-btn">Обновить</a>
        </div>
    `;
    modal.querySelector('.modal-btn').onclick = () => modal.remove();
    document.body.appendChild(modal);
}


async function initApp() {
        try {
        const currentVersion = await GetCurrentVersion();
        console.log("lastVersion:", lastVersion, "current:", currentVersion.version);

        if (lastVersion != currentVersion.version) {
            showUpdateModal(currentVersion.version, lastVersion);
        }
    } catch (e) {
        console.error("Не удалось проверить версию:", e);
    }

    const container = document.getElementById("root");
    const root = createRoot(container);

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