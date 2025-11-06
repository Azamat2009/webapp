# Настройка Telegram Bot

## Шаги для настройки Web App в Telegram

### 1. Через BotFather

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/mybots` и выберите вашего бота
3. Выберите "Bot Settings" → "Menu Button"
4. Выберите "Configure menu button"
5. Введите текст кнопки (например: "🎮 Играть")
6. Выберите "Web App"
7. Введите URL вашего Netlify приложения (например: `https://your-app.netlify.app`)

### 2. Через API (альтернативный способ)

Используйте следующий запрос (замените `YOUR_BOT_TOKEN` и `YOUR_WEB_APP_URL`):

```bash
curl -X POST "https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🎮 Играть",
      "web_app": {
        "url": "YOUR_WEB_APP_URL"
      }
    }
  }'
```

### 3. Установка команд бота

```bash
curl -X POST "https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {
        "command": "start",
        "description": "Запустить игру"
      },
      {
        "command": "play",
        "description": "Играть"
      }
    ]
  }'
```

## Важно!

- Убедитесь, что ваш Web App URL использует HTTPS
- URL должен быть доступен публично
- После настройки перезапустите бота или подождите несколько минут

