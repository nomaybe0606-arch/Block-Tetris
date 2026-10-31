# Публикация Grid Pulse в GitHub Pages

Единственный настроенный хостинг — GitHub Pages. Новый удалённый репозиторий должен называться **grid-pulse**. Итоговый адрес после успешного деплоя:

```text
https://YOUR_GITHUB_LOGIN.github.io/grid-pulse/
```

Подставьте свой GitHub login. Сейчас удалённый репозиторий и рабочая публичная ссылка ещё не созданы: GitHub CLI (`gh`) не установлен/не найден в PATH и стандартных каталогах. Авторизованные вызовы GitHub не выполнялись.

## Что подготовлено локально

- Отдельный Git-репозиторий в текущей папке проекта, ветка `main`; существующих remote до настройки не было. Другие проекты не менялись.
- `.gitignore` исключает `node_modules`, `dist`, `artifacts`, ZIP, `.env*`, локальные конфигурации и распространённые файлы ключей/секретов. `.env.example` разрешён как безопасный шаблон.
- `.gitattributes` нормализует текст в LF и сохраняет аудио как бинарные данные.
- `vite.config.ts`: dev `/`; production и preview `/grid-pulse/`.
- `.github/workflows/pages.yml`: push в `main` или ручной запуск → Node.js 24 → `npm ci` → TypeScript → 58 тестов → build → HTTP-проверка ресурсов → официальный Pages artifact → deploy.
- Публикуется исключительно содержимое `dist`, созданное в CI. Ветка `gh-pages`, сторонние хостинги и персональные токены не требуются. Автоматический `GITHUB_TOKEN` используется только с правами, заданными workflow.

## Создать репозиторий и выполнить первый push

1. Войдите в свой GitHub и откройте [создание репозитория](https://github.com/new).
2. Укажите **Repository name: `grid-pulse`**, выберите **Public**, если используете GitHub Free. Оставьте выключенными создание README, `.gitignore` и лицензии: локальный проект уже подготовлен. Создайте пустой репозиторий. Если имя уже занято, не используйте чужой или старый проект — сначала выберите подходящий аккаунт/владельца для нового репозитория.
3. В терминале текущего проекта выполните, заменив `YOUR_GITHUB_LOGIN`:

```powershell
Set-Location -LiteralPath 'C:\Users\Владик\Desktop\JOB\Ygames\Block Puzzle 8×8'
git status
git remote add origin https://github.com/YOUR_GITHUB_LOGIN/grid-pulse.git
git push -u origin main
```

Первый коммит уже подготовлен локально. Не используйте force push. Если `origin` уже добавлен вами, сначала посмотрите `git remote -v`; повторно добавлять его не нужно. При запросе авторизации следуйте стандартному входу Git/Git Credential Manager; не вставляйте токены в URL или файлы проекта.

4. Откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**. При необходимости разрешите GitHub Actions в **Settings → Actions → General** согласно политике вашего аккаунта/организации. Не выбирайте публикацию исходников из ветки: Vite требует сборку.
5. Откройте **Actions → Deploy Grid Pulse to GitHub Pages**. Если первый запуск успел завершиться ошибкой до включения Pages, выполните **Run workflow → main → Run workflow** либо перезапустите неудачный запуск.
6. Дождитесь успешных заданий `build` и `deploy`. Откройте ссылку из deployment/environment `github-pages` или Settings → Pages. До завершения первого деплоя 404 по ожидаемому адресу возможен.

Настройка Source и официальный способ публикации описаны в [документации GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Для project site Vite использует `base: '/grid-pulse/'`, как указано в [документации Vite](https://vite.dev/guide/static-deploy#github-pages).

## Последующие обновления

```sh
git add .
git commit -m "Update Grid Pulse"
git push
```

Каждый push в `main` автоматически обновляет Pages после успешных проверок. При ошибке типов, тестов, сборки или ресурсов deploy не запускается, предыдущая опубликованная версия сохраняется. Состояние и ссылка доступны во вкладке Actions. Дополнительные действия с ZIP или ручная загрузка `dist` не нужны.

## Локальная проверка

```sh
npm install
npm run dev
# http://127.0.0.1:5173/

npm run typecheck
npm test
npm run build
npm run verify:build
npm run preview
# http://127.0.0.1:4173/grid-pulse/
```

На Windows с запрещённым `npm.ps1` используйте `npm.cmd`. CI устанавливает зависимости через `npm ci` из `package-lock.json`; версия Node для CI задана в `.node-version`.

Проверка сборки сопоставляет `public` и `dist` побайтно, проверяет ссылки HTML и чанков JS, подстановку `BASE_URL` в аудио, конфигурацию Bridge и сигнатуры OGG/MP3. Затем запускает временный HTTP-сервер с точкой монтирования `/grid-pulse/` и без fallback на HTML, проверяет ответы и содержимое всех файлов, MIME-типы звуков/JS/CSS/JSON. Этот сервер закрывается после проверки.

## Проверить опубликованную игру

- Открыть URL с завершающим `/grid-pulse/`; убедиться, что меню, обучение и классический режим запускаются.
- В DevTools Network проверить отсутствие 404 для `playgama-bridge.js`, `playgama-bridge-config.json`, `assets/*.js`, `assets/*.css`, `favicon.svg` и `assets/audio/*`.
- Включить звук жестом пользователя, отдельно проверить музыку и эффекты, оба формата на целевых браузерах.
- Проверить drag мышью/touch, узкий и квадратный экран, поворот устройства, возврат после скрытия вкладки.

HTTP-проверка файлов не заменяет визуальный и звуковой прогон в браузере. Опубликованный workflow нельзя считать проверенным на GitHub до его первого успешного запуска.

## Playgama

Существующая интеграция Bridge и игровые правила сохранены. GitHub Pages — стенд для геймплея/интерфейса, а не sandbox рекламной платформы. Реальную рекламу, облачные сохранения, host lifecycle и платформенные идентификаторы проверяйте отдельно в sandbox Playgama/Яндекс/VK. Прямое localStorage/IndexedDB/cookies не добавлялось.

При необходимости `npm run package` делает отдельный переносимый ZIP с относительными путями для sandbox. Он игнорируется Git и не используется workflow Pages. Для возврата к Pages-сборке выполните `npm run build`.
