# Настройка Webhook на Render

## Шаг 1: Убедитесь, что ваш Node.js backend задеплоен

1. Откройте [Render Dashboard](https://dashboard.render.com)
2. Найдите ваш **Node.js проект** (не PostgreSQL!)
3. Убедитесь, что он запущен и работает
4. Скопируйте **URL вашего backend** (например: `https://your-app-name.onrender.com`)

## Шаг 2: Проверьте, что backend работает

Откройте в браузере URL вашего backend + `/health`:
```
https://your-app-name.onrender.com/health
```

Должен вернуться:
```json
{"status":"ok"}
```

## Шаг 3: Проверьте переменные окружения

В настройках вашего Node.js проекта на Render убедитесь, что установлены:

1. Откройте ваш Node.js проект на Render
2. Перейдите в **Environment** (Переменные окружения)
3. Убедитесь, что есть:
   - `BOT_TOKEN=7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I`
   - `DATABASE_URL` (URL вашей PostgreSQL базы данных)
   - `PORT=3000`
   - `NODE_ENV=production`

## Шаг 4: Установите Webhook

### Способ 1: Через браузер (самый простой)

1. Замените `YOUR_BACKEND_URL` на URL вашего Node.js backend на Render
2. Откройте эту ссылку в браузере:

```
https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook?url=YOUR_BACKEND_URL/webhook
```

**Пример:**
Если ваш backend URL: `https://my-app.onrender.com`, то ссылка будет:
```
https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook?url=https://my-app.onrender.com/webhook
```

3. Должен вернуться JSON:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### Способ 2: Через PowerShell (Windows)

Откройте PowerShell и выполните (замените `YOUR_BACKEND_URL`):

```powershell
$url = "https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook"
$body = @{
    url = "YOUR_BACKEND_URL/webhook"
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
```

### Способ 3: Через curl (если установлен)

```bash
curl -X POST "https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook" -H "Content-Type: application/json" -d "{\"url\": \"YOUR_BACKEND_URL/webhook\"}"
```

## Шаг 5: Проверьте, что Webhook установлен

Откройте в браузере:
```
https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/getWebhookInfo
```

Должен вернуться JSON с информацией о webhook:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app.onrender.com/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**Важно:** В поле `url` должен быть ваш backend URL + `/webhook`

## Шаг 6: Проверьте логи backend

1. Откройте ваш Node.js проект на Render
2. Перейдите в **Logs** (Логи)
3. Вы должны увидеть:
   ```
   Server is running on port 3000
   Bot token: Set
   ```

## Важные замечания

1. **Webhook URL должен быть HTTPS** - Render автоматически предоставляет HTTPS
2. **Используйте URL Node.js проекта, НЕ PostgreSQL!** - PostgreSQL не имеет endpoint `/webhook`
3. **URL должен заканчиваться на `/webhook`** - это endpoint в вашем backend
4. **После изменения переменных окружения** - перезапустите сервис на Render

## Решение проблем

### Ошибка: "Webhook was set" но платежи не работают

1. Проверьте логи backend на Render - должны быть логи о получении webhook updates
2. Убедитесь, что endpoint `/webhook` доступен (проверьте в коде `backend/server.js`)
3. Проверьте, что `BOT_TOKEN` правильный

### Ошибка: "Bad Request" при установке webhook

1. Убедитесь, что URL правильный и начинается с `https://`
2. Убедитесь, что URL доступен (откройте `https://your-app.onrender.com/health` в браузере)
3. Убедитесь, что URL заканчивается на `/webhook`

### Ошибка: "Connection refused"

1. Убедитесь, что ваш Node.js проект запущен на Render
2. Проверьте, что порт правильный (обычно 3000)
3. Проверьте логи backend на ошибки

## Пример полной настройки

Допустим, ваш Node.js проект на Render называется `my-telegram-bot` и имеет URL:
```
https://my-telegram-bot.onrender.com
```

Тогда:

1. **Проверьте backend:**
   ```
   https://my-telegram-bot.onrender.com/health
   ```
   Должен вернуть: `{"status":"ok"}`

2. **Установите webhook:**
   ```
   https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook?url=https://my-telegram-bot.onrender.com/webhook
   ```

3. **Проверьте webhook:**
   ```
   https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/getWebhookInfo
   ```

## Дополнительная информация

- [Render Documentation](https://render.com/docs)
- [Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Stars Payments](https://core.telegram.org/bots/payments-stars)

