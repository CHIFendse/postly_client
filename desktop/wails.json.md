# wails.json

Конфигурация Wails проекта Postly.

## Запуск разработки

Из корня проекта:

```powershell
wails3 dev
```

Dev-порт: `5173`.

Порт задается переменной Wails `WAILS_VITE_PORT=5173`, а frontend-команда
запускается через `build/Taskfile.yml` с `--port 5173 --strictPort`.

## Поля wails.json

- `name`: имя приложения `postly`.
- `frontend:dev:serverUrl`: URL frontend dev-сервера `http://localhost:5173`.
- `frontend:dev:server`: команда запуска Vite на порту `5173`.
- `bindings:languages`: язык генерируемых bindings, `js`.
- `outputname`: имя выходного приложения, `postly`.

## Важно

`wails.json` является строгим JSON и не поддерживает комментарии. Поэтому эта
документация хранится в `wails.json.md`, чтобы не ломать чтение конфигурации Wails.