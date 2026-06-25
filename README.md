# Bombomber

Solo top-down dungeon crawler: BSP-карта, магазин, аура, бластер, бомбы. Режимы: solo, против ботов, **сеть 1v1**.

## Запуск клиента (локально)

```bash
python3 -m http.server 8765
```

Открыть http://localhost:8765

## Запуск сервера (локально)

```bash
cd server
npm install
npm start
```

Сервер слушает порт **3000**. Клиент на localhost автоматически подключается к `http://localhost:3000`.

## Сетевая игра

1. В главном меню: **Создать комнату** → покажется код (6 символов)
2. Друг открывает ту же ссылку → **Войти по коду**
3. Оба выбирают класс, покупают в магазине, жмут **Готов к бою**
4. Сервер синхронизирует бой (20 TPS), клиент предсказывает своё движение

### Деплой

| Часть | Платформа | URL |
|-------|-----------|-----|
| Клиент | GitHub Pages | `https://ivougel.github.io/bombomber/` |
| Сервер | Туннель с Mac | `https://bombomber-ivougel.loca.lt` |

**Запуск сервера + туннеля (хост):**
```bash
chmod +x scripts/start-network.sh
./scripts/start-network.sh
```

Пока скрипт работает, клиент на GitHub Pages подключается к туннелю автоматически.

Другой URL туннеля без правки кода:
- в адресной строке: `?server=https://ваш-туннель.loca.lt`
- или в консоли Safari: `localStorage.setItem('bombomber_server_url', 'https://…')`

## Управление

- WASD — движение
- Мышь — прицел
- Space — бластер
- B — бомба
- Shift — спринт
- Q — лупа
- Tab — рюкзак
- Стрелки / геймпад — меню

## Структура

```
server/          — Node.js + socket.io (авторитетная симуляция)
systems/network.js — клиент WebSocket
```
