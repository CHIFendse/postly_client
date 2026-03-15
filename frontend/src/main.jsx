import {createRoot} from 'react-dom/client'
import './style.css'
import App from './app' // Импортируем главный файл с логикой авторизации

const container = document.getElementById('root')
const root = createRoot(container)

root.render(
        <App />
)