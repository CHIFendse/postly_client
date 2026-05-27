#!/bin/bash
# ============================================================
# Entrypoint сборочного Docker-образа Postly.
# Запускается внутри контейнера, проект примонтирован в /src.
# Требования к репозиторию:
#   - frontend/bindings/ — актуальны (сгенерированы wails3 generate bindings)
#   - build/linux/nfpm/nfpm.yaml — конфиг пакетов
#   - build/linux/postly.desktop — .desktop файл
#   - build/appicon.png — иконка
# ============================================================
set -euo pipefail

cd /src

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

mkdir -p build/bin build/linux/appimage

# ── 1. Frontend ─────────────────────────────────────────────
step "Building frontend (npm)"
cd frontend
npm install --silent --no-fund --no-audit
npm run build --silent
cd ..
ok "Frontend built"

# ── 2. Go зависимости ───────────────────────────────────────
step "Tidying Go modules"
go mod tidy
ok "Go modules up to date"

# ── 3. Linux binary (статический opus) ──────────────────────
step "Building Linux binary (static opus)"
CGO_ENABLED=1 \
CGO_LDFLAGS="-Wl,-Bstatic -lopusfile -logg -lopus -Wl,-Bdynamic" \
GOOS=linux GOARCH=amd64 \
go build \
    -tags production \
    -trimpath \
    -buildvcs=false \
    -ldflags="-w -s" \
    -o build/bin/postly \
    . || fail "Linux build failed"
ok "Linux binary: build/bin/postly ($(du -sh build/bin/postly | cut -f1))"

# ── 4. DEB — Debian / Ubuntu / Linux Mint ───────────────────
step "Packaging .deb (Debian/Ubuntu)"
GOARCH=amd64 nfpm package \
    --config ./build/linux/nfpm/nfpm.yaml \
    --packager deb \
    --target ./build/bin/ || fail ".deb packaging failed"
ok "DEB ready"

# ── 5. RPM — Fedora / RHEL / AlmaLinux / openSUSE ──────────
step "Packaging .rpm (Fedora/RHEL)"
GOARCH=amd64 nfpm package \
    --config ./build/linux/nfpm/nfpm.yaml \
    --packager rpm \
    --target ./build/bin/ || fail ".rpm packaging failed"
ok "RPM ready"

# ── 6. PKG.TAR.ZST — Arch Linux / Manjaro / EndeavourOS ─────
step "Packaging .pkg.tar.zst (Arch Linux)"
GOARCH=amd64 nfpm package \
    --config ./build/linux/nfpm/nfpm.yaml \
    --packager archlinux \
    --target ./build/bin/ || fail "Arch packaging failed"
ok "PKG.TAR.ZST ready"

# ── 7. Windows EXE (кросс-компиляция с mingw-w64) ───────────
step "Cross-compiling Windows .exe (mingw-w64, static opus)"
GOOS=windows \
GOARCH=amd64 \
CGO_ENABLED=1 \
CC=x86_64-w64-mingw32-gcc \
PKG_CONFIG_PATH=/win-opus/lib/pkgconfig \
CGO_CFLAGS="-I/win-opus/include" \
CGO_LDFLAGS="-L/win-opus/lib -Wl,-Bstatic -lopusfile -logg -lopus -Wl,-Bdynamic -static-libgcc" \
go build \
    -tags production \
    -trimpath \
    -buildvcs=false \
    -ldflags="-w -s -H windowsgui" \
    -o build/bin/postly.exe \
    . || fail "Windows build failed"
ok "Windows EXE built ($(du -sh build/bin/postly.exe | cut -f1))"

# ── 8. Фикс стека Windows EXE ───────────────────────────────
step "Fixing Windows stack size (StackReserve=128MB)"
GOOS=linux go run ./build/windows/setstack/main.go \
    build/bin/postly.exe 134217728 4194304 || fail "setstack failed"
ok "Stack fixed"

# ── 9. NSIS установщик Windows ──────────────────────────────
step "Building NSIS installer"

# Скачиваем WebView2 bootstrapper (нужен NSIS-скрипту, ~1.5MB)
BOOTSTRAPPER="build/windows/nsis/MicrosoftEdgeWebview2Setup.exe"
if [ ! -f "$BOOTSTRAPPER" ]; then
    curl -fsSL -o "$BOOTSTRAPPER" \
        "https://go.microsoft.com/fwlink/p/?LinkId=2124703" \
        || fail "Failed to download WebView2 bootstrapper"
fi
ok "WebView2 bootstrapper ready"

# makensis работает из директории nsis (пути в .nsi относительные)
# OutFile в project.nsi: ../../../bin/postly-amd64-installer.exe
# = <root>/bin/ — создаём и потом перемещаем в build/bin/
mkdir -p bin
cd build/windows/nsis
makensis \
    -DARG_WAILS_AMD64_BINARY="$(pwd)/../../../build/bin/postly.exe" \
    project.nsi || fail "makensis failed"
cd ../../..

# Перемещаем в build/bin/
mv bin/postly-amd64-installer.exe build/bin/postly-amd64-installer.exe
rmdir bin 2>/dev/null || true

# Убираем промежуточный .exe — пользователю нужен только установщик
rm -f build/bin/postly.exe
ok "NSIS installer ready ($(du -sh build/bin/postly-amd64-installer.exe | cut -f1))"

# ── Итог ────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Готово! Файлы в build/bin/:${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════${NC}"
ls -lh build/bin/ | grep -v '^total'
echo ""
echo -e "${BOLD}Расширения и для каких ОС:${NC}"
echo "  .deb                  → Debian, Ubuntu, Linux Mint, Pop!_OS"
echo "  .rpm                  → Fedora, RHEL, AlmaLinux, Rocky, openSUSE"
echo "  .pkg.tar.zst          → Arch Linux, Manjaro, EndeavourOS, Garuda"
echo "  -amd64-installer.exe  → Windows 10/11 (x64), установщик NSIS"
echo ""
echo -e "${BOLD}Установка:${NC}"
echo "  sudo apt install ./postly*.deb"
echo "  sudo dnf install ./postly*.rpm"
echo "  sudo pacman -U ./postly*.pkg.tar.zst"
echo "  (Windows) запустить postly-amd64-installer.exe"
