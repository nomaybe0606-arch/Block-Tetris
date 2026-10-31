# Grid Pulse: GitHub Pages в репозитории Block-Puzzle

Репозиторий: https://github.com/nomaybe0606-arch/Block-Puzzle

Адрес игры после успешного deployment: https://nomaybe0606-arch.github.io/Block-Puzzle/

Публикация выполняется только через GitHub Pages. Название игры остаётся Grid Pulse; имя репозитория и префикс URL — **Block-Puzzle**, с учётом регистра.

## Диагностика первого запуска

Запуск https://github.com/nomaybe0606-arch/Block-Puzzle/actions/runs/41230314209:

- `build` завершился успешно: Node.js, npm ci, TypeScript, все тесты, production build, проверка ресурсов и загрузка артефакта прошли.
- `deploy` завершился ошибкой на `Configure GitHub Pages`.
- Публичная annotation GitHub: `Get Pages site failed` и `HttpError: Not Found`. Шаг публикации артефакта был пропущен.
- Это ошибка получения настроек сайта Pages. Неправильный `/grid-pulse/` не вызвал падение этого шага, но привёл бы к неверным URL ассетов после публикации.
- При авторизованной диагностике Pages API уже возвращает HTTP 200 и `build_type: workflow`. Следовательно, в текущем состоянии Pages настроен на GitHub Actions. Не требуется создавать второй репозиторий.
- Предупреждение о Node.js 20 относится к внутреннему runtime официального `configure-pages@v5`, который runner запускает на Node.js 24. Ошибка шага была HTTP 404, а не ошибкой Node/npm. Проверки не отключались.

## Пути и команды

| Сборка | Base | Команда | Адрес для локальной проверки |
| --- | --- | --- | --- |
| Разработка | `/` | `npm run dev` | `http://127.0.0.1:5173/` |
| GitHub Pages | `/Block-Puzzle/` | `npm run build` | `npm run preview` → `http://127.0.0.1:4173/Block-Puzzle/` |
| Sandbox Playgama | `./` | `npm run package` | Переносимый ZIP в `artifacts/`, не способ хостинга |

После `npm run package` для возврата к Pages выполните `npm run build`. Звуки используют `import.meta.env.BASE_URL`, SDK подключается официальным локальным Vite-плагином, конфигурация Bridge лежит рядом с `index.html`. Для запуска используйте HTTP, не `file://`.

## Workflow

Файл `.github/workflows/pages.yml` запускается по push в `main` и вручную через `workflow_dispatch`.

1. Checkout и Node.js 24 из `.node-version`.
2. `npm ci` по `package-lock.json`.
3. `npm run typecheck` и `npm test`.
4. `npm run build` и `npm run verify:build`.
5. Загрузка исключительно `dist` через официальный `upload-pages-artifact`.
6. Задание `deploy` после успешного `build`: `configure-pages`, затем `deploy-pages`.

Права build: `contents: read`. Права deploy заданы явно: `contents: read`, `pages: write`, `id-token: write`; environment — `github-pages`. `GITHUB_TOKEN` выдаётся GitHub автоматически. PAT и дополнительные секреты в workflow не нужны.

Проверка ресурсов сопоставляет `public` и `dist` побайтно, проверяет HTML/JS-чанки, URL аудио, JSON и форматы OGG/MP3. Временный HTTP-сервер отдаёт все файлы под `/Block-Puzzle/`, без подмены отсутствующих ресурсов на HTML; проверяются ответы, содержимое и MIME-типы. Сервер закрывается после проверки.

## Обновление

`origin` уже указывает на нужный репозиторий. В текущей папке:

```sh
git add .
git commit -m "Update Grid Pulse"
git push origin main
```

Не используйте force push. Не добавляйте в Git `dist`, зависимости, ZIP или секреты. Если проверки не прошли, новое содержимое сайта не публикуется.

## Если Configure GitHub Pages снова падает

1. Откройте https://github.com/nomaybe0606-arch/Block-Puzzle/settings/pages под аккаунтом владельца.
2. В блоке **Build and deployment** выберите **Source → GitHub Actions**. Не выбирайте публикацию исходников из ветки: проект требует Vite build.
3. Откройте **Actions → Deploy Grid Pulse to GitHub Pages** и выполните **Run workflow → main → Run workflow**, либо **Re-run failed jobs** у исправленного запуска.
4. Если GitHub показывает ожидание environment approval, откройте запуск, нажмите **Review deployments**, выберите `github-pages` и подтвердите публикацию, если это предусмотрено вашими правилами репозитория.
5. Дождитесь зелёных `build` и `deploy`, затем проверьте ссылку сайта и Network на 404 для SDK, JSON, JS/CSS, favicon и аудио.

Официальная документация: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

`enablement: true` намеренно не добавлен: официальный action требует для первичного включения Pages отдельный токен с административными правами. Не нужно добавлять PAT ради обхода настройки Source. Если настройки уже корректны, смотрите конкретную annotation нового запуска.

## Границы проверки

GitHub Pages используется для геймплея и интерфейса. Реальную рекламу, облачные сохранения и host lifecycle Bridge отдельно проверяйте в sandbox Playgama/Яндекс/VK. Прямое localStorage/IndexedDB/cookies не добавлялось. HTTP-проверка не заменяет визуальный прогон и физические касания на устройствах.
