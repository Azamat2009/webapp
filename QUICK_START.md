# ⚡ БЫСТРЫЙ СТАРТ

Если вы уже знаете как деплоить, вот краткая инструкция. Если нет - откройте [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md)

## 🚀 За 5 минут

### 1. Backend (Render)

```bash
# 1. Создайте PostgreSQL на Render
# 2. Создайте Web Service:
#    - Build: cd backend && npm install
#    - Start: cd backend && node server.js
#    - Env: NODE_ENV=production, DATABASE_URL=<из PostgreSQL>, PORT=3000
```

### 2. Frontend (Netlify)

```bash
# 1. Подключите GitHub репозиторий
# 2. Build: cd frontend && npm install && npm run build
# 3. Publish: frontend/dist
# 4. Env: VITE_API_URL=<URL вашего backend>
```

### 3. Telegram Bot

```bash
# В @BotFather:
/setmenubutton
# Выберите бота → Web App → URL вашего Netlify сайта
```

## ✅ Готово!

---

**Нужна помощь?** Откройте [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md) для подробной инструкции.

