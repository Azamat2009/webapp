# Настройка Webhook для оплаты через Telegram Stars

## Важно!

Для работы оплаты через Telegram Stars необходимо настроить webhook для бота. Это позволяет боту получать обновления о платежах.

## Шаг 1: Установите зависимости

Убедитесь, что вы установили все зависимости на backend:

```bash
cd backend
npm install
```

## Шаг 2: Настройте переменные окружения

Убедитесь, что в вашем `.env` файле или в настройках Render установлены:

```
BOT_TOKEN=7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I
DATABASE_URL=your_database_url
PORT=3000
NODE_ENV=production
```

## Шаг 3: Настройте Webhook

После деплоя backend на Render, настройте webhook для бота:

### Вариант 1: Через curl (рекомендуется)

Замените `YOUR_BACKEND_URL` на URL вашего backend (например, `https://your-app.onrender.com`):

```bash
curl -X POST "https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "YOUR_BACKEND_URL/webhook"
  }'
```

### Вариант 2: Через браузер

Откройте в браузере (замените `YOUR_BACKEND_URL`):

```
https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/setWebhook?url=YOUR_BACKEND_URL/webhook
```

### Вариант 3: Проверка webhook

Чтобы проверить, что webhook настроен правильно:

```
https://api.telegram.org/bot7739577660:AAGpO1BazLeEkzOZe4vw8jlD7jWMFyp_p8I/getWebhookInfo
```

Должен вернуться JSON с информацией о webhook, включая URL.

## Шаг 4: Как это работает

1. Пользователь нажимает кнопку "Купить 10000 монет за звезды" в Mini App
2. Frontend отправляет запрос на `/api/payment/create-invoice`
3. Backend создает инвойс через Bot API и отправляет его пользователю в чат с ботом
4. Пользователь видит сообщение с кнопкой "Pay" в чате с ботом
5. Пользователь нажимает "Pay" и завершает оплату
6. Telegram отправляет обновление на `/webhook` endpoint
7. Backend обрабатывает платеж и начисляет монеты
8. Backend отправляет пользователю сообщение об успешной оплате
9. Mini App периодически проверяет баланс и обновляет UI

## Шаг 5: Тестирование

1. Откройте Mini App в Telegram
2. Нажмите кнопку "Купить 10000 монет за звезды"
3. Проверьте чат с ботом - должно прийти сообщение с кнопкой "Pay"
4. Нажмите "Pay" и завершите оплату
5. Проверьте, что монеты начислены в Mini App
6. Проверьте, что пришло сообщение от бота об успешной оплате

## Важные замечания

1. **Webhook URL должен быть HTTPS** - Telegram не принимает HTTP для webhook
2. **Backend должен быть доступен публично** - Telegram должен иметь доступ к вашему `/webhook` endpoint
3. **Проверьте логи backend** - если что-то не работает, проверьте логи на Render
4. **Убедитесь, что бот имеет права** - бот должен иметь возможность отправлять сообщения пользователю

## Решение проблем

### Webhook не работает

1. Проверьте, что URL правильный и доступен
2. Проверьте, что endpoint `/webhook` существует и обрабатывает POST запросы
3. Проверьте логи backend на ошибки
4. Убедитесь, что используется HTTPS

### Инвойс не отправляется

1. Проверьте, что `BOT_TOKEN` правильный
2. Проверьте, что бот может отправлять сообщения пользователю
3. Проверьте логи backend на ошибки

### Платеж не обрабатывается

1. Проверьте, что webhook настроен правильно
2. Проверьте логи backend на обновления от Telegram
3. Убедитесь, что база данных работает
4. Проверьте, что пользователь существует в базе данных

## Дополнительная информация

- [Telegram Bot API - Payments](https://core.telegram.org/bots/api#payments)
- [Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Stars Payments](https://core.telegram.org/bots/payments-stars)

