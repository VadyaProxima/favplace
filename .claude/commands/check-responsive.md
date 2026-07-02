---
description: Проверка адаптива компонента по 3 Figma-макетам (Desktop/Tablet/Mobile) с детальной сверкой layout, spacing, typography и colors.
argument-hint: <путь-до-tpl> | <figma-desktop-url> | <figma-tablet-url> | <figma-mobile-url>
---

Проверь адаптив компонента по 3 макетам (Desktop → Tablet → Mobile).

**Входные данные** (разделитель `|`): $ARGUMENTS

Ожидаемые аргументы:
1. Путь до `index.tpl` компонента
2. Figma URL — Desktop макет
3. Figma URL — Tablet макет
4. Figma URL — Mobile макет

## Phase 0 — Валидация входа (ОБЯЗАТЕЛЬНО до всего остального)

Распарси `$ARGUMENTS` по разделителю `|`. Проверь:

- **Путь до `.tpl`**: должен существовать на диске. Если строка не похожа на путь или файл не найден — это пропущенный аргумент.
- **Figma URL**: должен начинаться с `https://www.figma.com/` или `https://figma.com/` и содержать `node-id`. Если ссылка не парсится в `fileKey` + `nodeId` — это пропущенный аргумент.
- Если аргументов меньше 4 или какой-то невалиден — **НЕ начинай работу**.

Если есть пропуски/ошибки — задай вопросы пользователю через `AskUserQuestion`. Сгруппируй все недостающие в один вызов (multi-question), не спрашивай по одному. Названия вопросов:

- `tpl_path` — «Путь до index.tpl компонента» (если не указан или файл не найден)
- `figma_desktop` — «Figma URL Desktop макета»
- `figma_tablet` — «Figma URL Tablet макета»
- `figma_mobile` — «Figma URL Mobile макета»

Для каждого вопроса дай 1-2 правдоподобных options + обязательно опцию **"Other"** для свободного ввода. Пример options для `tpl_path`:
- найденные `.tpl` в текущей рабочей директории по `git status` (изменённые файлы)
- последний редактированный `.tpl` за сессию
- "Other" — пользователь сам укажет путь

После ответов — собери полный набор аргументов и переходи к Phase 1. Если пользователь снова дал невалидное значение — переспроси один раз; если опять невалидно — остановись и сообщи в чате что не получается распарсить.

## Принципы

- **Desktop first**: базовые правила без media query, дальше `@media (max-width: 1023px)` для общих tablet+mobile, и rubber-значения внутри per-viewport queries.
- **Минимум дублирования**: общие layout-правила (направление flex/grid, отображение divider, цвета secondary, ширины 100%) выноси в shared media query. Per-viewport — только то, что зависит от rubber-base (font-size, gap, padding в vw).
- **Top/bottom отступы секции не трогать** — `padding-block-start`, `padding-block-end`, `--section-padding-block`, `--section-margin-top` на корневом `<footer>/<section>[data-cms-section]` НЕ менять, даже если расходятся с Figma. **Эти отступы — система: вертикальные расстояния МЕЖДУ секциями на странице задаются глобально через DS, а не локально в компоненте.** Если поправить их в одном компоненте, поедет ритм всей страницы. Внутренние padding (например `.{component} { padding-block }` внутри визуального контейнера-обёртки) — менять можно, это content-padding самого компонента, а не межсекционный отступ.
- **Контент не меняй** — только CSS. Если в Figma текст другой (короче/длиннее) — это контентная вариация, не баг адаптива.

## Обязательный порядок работы

### Phase 1 — Сбор спеков
- Запроси `mcp__figma-remote-mcp__get_design_context` для **ВСЕХ трёх viewports** (не только desktop).
- Для каждого viewport выпиши в заметку:
  - **Layout**: направление flex/grid, кол-во колонок, ширины фикс-блоков
  - **Spacing**: padding, gap, margin, padding-inline-end
  - **Typography**: font-size, line-height, font-weight, text-transform
  - **Colors**: цвет текста, фона, бордеров; opacity (`rgba` vs hex)
  - **Sizing**: размеры иконок, фикс-ширины
- Запроси `get_screenshot` для всех трёх — для визуальной сверки.

⚠️ **Gotcha: значения через CSS-переменные с fallback**

Figma MCP возвращает свойства двумя способами:

```jsx
// 1) ХАРДКОД — реальное значение для текущего viewport, доверяй:
text-[26px] leading-[30px]

// 2) CSS-VAR с FALLBACK — fallback это ДЕФОЛТ DESKTOP-ТОКЕНА, а не значение для текущего viewport!
text-[length:var(--size/heading/h3-strong, 46px)]
leading-[var(--line-height/heading/h3, 46px)]
```

Если для tablet/mobile node ты видишь `var(--token, NN)` — **число `NN` это desktop-fallback**, реальное значение на mobile/tablet может быть другим. Действия:
1. Сверь с figma-screenshot визуально (если 46px на мобильном экране 375 заняло бы ~80% ширины — а на скриншоте текст явно меньше → значит fallback врёт).
2. Сравни с tablet/mobile хардкодом того же типа элемента в соседнем макете (если tablet h3 = 26px хардкодом, скорее всего mobile тоже 26px).
3. Если не уверен — вызови `mcp__figma-remote-mcp__get_variable_defs` с тем же `nodeId` чтобы получить резолв токена для viewport.

Никогда не записывай fallback из `var()` напрямую как итоговое значение для tablet/mobile без верификации.

### Phase 2 — Snapshot "before"
- Прочитай текущий `index.tpl`.
- Найди страницу где компонент рендерится (обычно `/{company}/`).
- Открой Playwright (headless), сними скриншоты селектора секции на 1440 / 768 / 375.
- При смене viewport используй `playwright_resize`, не повторный `navigate`. Скролль к секции перед скриншотом.

### Phase 3 — Чек-лист сравнения (НЕ пропускай уровни!)
Для каждого viewport пройди по слоям сверху вниз:

| Слой | Что проверить |
|------|---------------|
| **a) Layout** | направление flex/grid, кол-во колонок, переносы, порядок элементов |
| **b) Spacing** | gap, padding, margin, padding-inline-end |
| **c) Sizing** | width фикс-блоков, размеры иконок |
| **d) Typography** | font-size, line-height, font-weight, text-transform |
| **e) Colors** | текст, фон, бордер, opacity (rgba vs hex без opacity!) |

⚠️ Если слой "выглядит близко" — всё равно сверь с числами из Figma. Не доверяй глазам.

### Phase 4 — Фикс
- Применяй desktop-first.
- Используй rubber-значения проекта: `calc(VALUE / 14.4 * 1vw)` для desktop, `/ 7.68` для tablet, `/ 3.75` для mobile.
- Общие правила tablet+mobile (стак в колонку, 2-кол grid, divider visible, secondary colors) → один `@media (max-width: 1023px)`.
- Per-viewport queries содержат только rubber-значения.
- Если flex-колонка может обрезать содержимое — добавь `min-width: 0`.

### Phase 5 — Верификация
- Сними "after" скриншоты на тех же 3 viewports.
- Сверь side-by-side с Figma по чек-листу из Phase 3.
- Если на mobile/tablet текст длиннее чем в Figma и переносится — это норма (контент не наш), но layout должен быть корректным.

## Формат отчёта

В конце по каждому viewport:
- ✅ Что было исправлено (числовые значения: было → стало)
- ⚠️ Что осталось как контентная вариация (если есть)
- 📁 Путь к "after" скриншоту

Перед фиксом коротко покажи план — список расхождений по чек-листу для всех 3 viewports.
