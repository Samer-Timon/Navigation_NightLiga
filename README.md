# Публикация сайта на https://samer-timon.github.io/Navigation_NightLiga/index.html

Краткие шаги:

1. В корне репозитория создайте index.html (пример):
```html
<!doctype html>
<html>
    <head><meta charset="utf-8"><title>Navigation NightLiga</title></head>
    <body>
        <h1>Navigation NightLiga</h1>
        <p>Сайт опубликован через GitHub Pages.</p>
    </body>
</html>
```

2. Инициализация и пуш в GitHub (если репозиторий ещё не создан):
- Создать локальный репозиторий и закоммитить:
    git init
    git add .
    git commit -m "Initial site"
    git branch -M main
- Создать и запушить репозиторий одним из способов:
    - С помощью gh (если хотите автоматом создать репо на GitHub):
        gh repo create samer-timon/Navigation_NightLiga --public --source=. --remote=origin --push
    - Или вручную добавить remote и запушить:
        git remote add origin https://github.com/samer-timon/Navigation_NightLiga.git
        git push -u origin main

3. Включить GitHub Pages:
- Откройте репозиторий на GitHub → Settings → Pages.
- Source: выберите branch "main" и папку "/" (root). Сохраните.
- Подождите несколько минут пока сайт сгенерируется.

4. Открыть сайт в браузере:
В контейнере используйте:
"$BROWSER" https://samer-timon.github.io/Navigation_NightLiga/index.html

Примечания:
- Убедитесь, что репозиторий действительно принадлежит аккаунту samer-timon.
- Если используете другую ветку/путь (например gh-pages или /docs), укажите её в настройках Pages.
- Обновления появляются обычно в течение нескольких минут.