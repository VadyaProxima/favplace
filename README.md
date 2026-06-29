# Favplace

Создайте уникальное кольцо с топографическим рельефом места, которое вам дорого.

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind v4 |
| Карта | MapLibre GL JS + Nominatim |
| 3D | Three.js + React Three Fiber + Drei |
| DEM | AWS Terrain Tiles (Terrarium) |
| Backend | NestJS 11 + Prisma 5 + SQLite |
| Анимации | Motion (framer-motion) |
| Монорепо | pnpm + turborepo |

## Структура

```
favplace/
├── apps/
│   ├── web/              # Next.js фронтенд (:3000)
│   └── api/              # NestJS бэкенд (:3001)
├── packages/
│   ├── shared/           # Общие типы и контракты
│   └── terrain/          # Модуль генерации рельефа
```

## Быстрый старт

```bash
pnpm install
pnpm --filter @favplace/api prisma:push   # создать БД
pnpm dev                                   # запустить оба приложения
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

## API endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/terrain/heightmap` | Получить heightmap по координатам |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Логин (JWT) |
| GET | `/api/projects` | Список проектов (auth) |
| POST | `/api/projects` | Создать проект (auth) |
| POST | `/api/orders` | Создать заказ (auth) |
| POST | `/api/ai/identify-place` | AI-камера (OPENAI_API_KEY) |
| POST | `/api/export/stl` | Экспорт STL для 3D-печати |

## AI-камера

Для работы AI-камеры создайте `apps/api/.env`:

```
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret
```

## Создание кольца

1. **Выберите место** — поиск через карту или AI-камера
2. **Выберите масштаб** — от 100 м до 10 км
3. **Предпросмотр** — 3D рельеф с морфинг-анимацией
4. **Материал** — золото / серебро / платина, полировка / матовая
5. **Гравировка** — текст внутри кольца
6. **Итог** — превью + заказ + экспорт STL
