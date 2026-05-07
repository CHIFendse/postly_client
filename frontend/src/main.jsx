import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
// ... остальное так же
import './style.css';
import App from './app'; // Твой текущий VoiceChat интерфейс
import CallWindow from './components/CallWindow';

const container = document.getElementById('root');
const root = createRoot(container);
console.log("Root")
root.render(
    <Router>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/call/:chatId/:userName" element={<CallWindow />} />
        </Routes>
    </Router>
);