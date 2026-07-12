# Tashkent Summit — сайт бронирования

Статический сайт (`index.html`) + Cloudflare Pages Function (`functions/api/booking.js`),
которая присылает заявки о бронировании в Telegram.

## Как это работает
- Гость проходит бронирование на сайте.
- На последнем шаге заявка уходит POST-запросом на `/api/booking`.
- Функция читает секреты `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` из окружения Cloudflare
  и отправляет сообщение в Telegram.

## Деплой (Cloudflare Pages через GitHub)
1. Залить этот репозиторий на GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → выбрать репозиторий.
3. Build settings:
   - Framework preset: **None**
   - Build command: **(пусто)**
   - Build output directory: **/**
4. Deploy.
5. Settings → Variables and Secrets → добавить два **Secret**:
   - `TELEGRAM_BOT_TOKEN` = токен от @BotFather
   - `TELEGRAM_CHAT_ID` = твой chat id от @userinfobot
6. Retry deployment.

Токены НИКОГДА не коммитятся в репозиторий — только в настройки Cloudflare.

## Важно
Оплата на сайте — демо (реальные деньги не списываются). Функция только уведомляет о заявке.
