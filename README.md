# 🎭 Panel Test Runner

Aplikacja webowa do uruchamiania testów Playwright panelu admina z live outputem w przeglądarce.

**Stack:** PHP · React · Playwright · Docker

---

## ⚡ Szybki start — Docker (zalecane)

### 1. Pobierz repozytorium

```bash
git clone https://github.com/PiotrkasS/Strona.git
cd Strona
git checkout claude/php-react-test-panel-xy6HI
```

### 2. Skonfiguruj środowisko

```bash
cp .env.example .env
```

Otwórz `.env` i ustaw adres URL swojego panelu:

```env
BASE_URL=https://twoj-panel.pl
PANEL_USER=admin
PANEL_PASSWORD=twoje-haslo
```

### 3. Uruchom

```bash
docker-compose up --build
```

> Pierwsze uruchomienie trwa kilka minut (pobieranie obrazu + instalacja Playwright).

### 4. Otwórz w przeglądarce

```
http://localhost:8080
```

---

## 💻 Uruchomienie lokalne (bez Dockera)

### Wymagania

- Node.js 18+
- PHP 8.1+ (CLI)
- npm

### Kroki

```bash
# 1. Pobierz repo
git clone https://github.com/PiotrkasS/Strona.git
cd Strona
git checkout claude/php-react-test-panel-xy6HI

# 2. Zainstaluj zależności
npm install

# 3. Zainstaluj przeglądarkę Playwright
npx playwright install chromium --with-deps

# 4. Zbuduj frontend
npm run build

# 5. Uruchom serwer PHP
npm run php
```

Otwórz `http://localhost:8000`

> **Skrót dla developmentu** (hot-reload React + PHP jednocześnie):
> ```bash
> npm start
> ```
> Frontend: `http://localhost:5173`

---

## 🧪 Jak dodać własne testy

Wrzuć pliki `*.spec.ts` do folderu `tests/`:

```
tests/
└── panel/
    ├── login.spec.ts       ← już gotowe
    ├── dashboard.spec.ts
    ├── settings.spec.ts
    └── users.spec.ts
```

Aplikacja **automatycznie** wykrywa nowe pliki po odświeżeniu strony.

---

## 🖥️ Jak korzystać z aplikacji

1. Przejdź do zakładki **"Uruchom testy"**
2. Zaznacz checkboxy przy wybranych plikach (lub kliknij **"Zaznacz wszystkie"**)
3. Kliknij **"▶ Uruchom wybrane"**
4. Obserwuj live output w terminalu
5. Po zakończeniu zobaczysz szczegółowe wyniki (✔ zaliczone / ✖ błędy)
6. Historia wszystkich uruchomień dostępna w zakładce **"Historia wyników"**

---

## 🐳 Komendy Docker

```bash
# Uruchom (z przebudowaniem)
docker-compose up --build

# Uruchom w tle
docker-compose up -d --build

# Zatrzymaj
docker-compose down

# Podejrzyj logi
docker-compose logs -f
```

---

## 📁 Struktura projektu

```
Strona/
├── api/index.php          # PHP API (lista testów + uruchamianie)
├── router.php             # Router PHP built-in server
├── src/
│   ├── pages/
│   │   ├── TestRunner.jsx # Strona z checkboxami i terminalem
│   │   ├── Dashboard.jsx  # Przegląd statystyk
│   │   └── Results.jsx    # Historia wyników
│   └── components/        # Layout, Sidebar, Header
├── tests/panel/           # Twoje pliki *.spec.ts
├── docker-compose.yml
├── Dockerfile
└── playwright.config.ts
```
