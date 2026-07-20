# Favplace

Рельеф вашего любимого места, отлитый в металле. Возьмите точку на карте —
и её настоящая топография превращается в 3D-рельеф (будущую вставку в кольцо).

> Текущий статус: в студии рендерится **перстень (signet)** — сужающаяся
> шинка расширяется к верху, и рельеф выбранной местности вырезан прямо в
> голове кольца, как единое литое изделие (`apps/web/src/lib/ringGeometry.ts`).

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind v4 |
| Карта | MapLibre GL JS + Esri (basemaps + geocoding) |
| 3D | Three.js + React Three Fiber + Drei |
| DEM | AWS Terrain Tiles (Terrarium) |
| Backend | NestJS 11 + Prisma 5 + SQLite |
| Анимации | Motion (framer-motion) |
| Монорепо | pnpm + turborepo |

Карта идёт через **Esri** (World Imagery / Street / Hillshade — подложка
«Рельеф» использует World Hillshade, т.к. World Physical Map имеет тайлы
только до z8). Геокодинг: **Nominatim (OSM)** как основной поиск,
**Esri World Geocoder** как фолбэк. DEM-тайлы берутся с AWS S3 (Terrarium)
с ретраями и кэшем в памяти.

## Структура

```
favplace/
├── apps/
│   ├── web/              # Next.js фронтенд (:3000)
│   └── api/              # NestJS бэкенд (:4000)
├── packages/
│   ├── shared/           # Общие типы и контракты
│   └── terrain/          # Модуль генерации рельефа (DEM → heightmap → geometry)
```

## Быстрый старт

```bash
pnpm install
pnpm --filter @favplace/api prisma:push   # создать БД
pnpm dev                                   # запустить оба приложения
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

> Для рельефа и карты внешний доступ к `*.arcgisonline.com` и
> `s3.amazonaws.com/elevation-tiles-prod` должен быть открыт — иначе карта
> будет пустой, а `/api/terrain/heightmap` вернёт 500.

## API endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/terrain/heightmap?lat&lng&radius&resolution` | Heightmap по координатам (Terrarium DEM) |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Логин (JWT) |
| GET | `/api/projects` | Список проектов (auth) |
| POST | `/api/projects` | Создать проект (auth) |
| POST | `/api/orders` | Создать заказ (auth) |
| POST | `/api/ai/identify-place` | AI-камера (OPENAI_API_KEY) |
| POST | `/api/export/stl` | Экспорт STL для 3D-печати |

## Создание рельефа

1. **Студия** — найдите место, переключите подложку (Спутник / Схема /
   Рельеф). Белый фрейм-прицел закреплён в центре карты: двигайте карту под
   ним — что оказалось внутри рамки, то и анализируется. Координаты выбора
   обновляются на каждый сдвиг/зум карты, поэтому «Анализировать» всегда
   берёт ровно то, что видно во фрейме. Размер рамки на экране гео-точный
   (равен площади анализа при текущем зуме): углами можно плавно менять
   площадь 100 м – 20 км, пресеты (100 м – 10 км) подгоняют зум под рамку,
   клик по карте центрирует её на точке. Рельеф строится по кнопке
   **«Анализировать»** (не в реальном времени — для производительности).
2. **Материал** — золото / серебро / платина, полированная / матовая,
   высота рельефа.
3. **Гравировка** — текст (до 30 символов).
4. **Итог** — превью, заказ и экспорт STL.

## AI-камера (опционально)

Эндпоинт `/api/ai/identify-place` требует ключ. Создайте `apps/api/.env`:

```
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret
```
