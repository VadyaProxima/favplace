# Развёрнутый сервер

Сайт: https://favplace.178.212.15.39.sslip.io/

Конструктор: https://favplace.178.212.15.39.sslip.io/create

Админка: https://favplace.178.212.15.39.sslip.io/admin

VPS Hostland: `178.212.15.39`, Ubuntu 24.04, 2 CPU, 4 ГБ RAM, 30 ГБ диска.
Проект расположен в `/opt/favplace`, текущие исходники — в `/opt/favplace/current`.
Сайт, API, PostgreSQL и Caddy запущены
через Docker Compose с автоматическим перезапуском. HTTPS выдаёт и продлевает Caddy.
HTTP по IP перенаправляется на HTTPS-адрес сайта.

## Доступ

SSH-ключ: `C:\Users\USER\.ssh\favplace_hostland_ed25519`.
Параметры production сохранены в `C:\Users\USER\.ssh\favplace-production.env`.
Пароль админки — в `C:\Users\USER\.ssh\favplace-admin-password`.
На сервере секреты находятся в `/opt/favplace/.env` с правами `600`.
Эти файлы нельзя добавлять в репозиторий.

```powershell
ssh -i C:\Users\USER\.ssh\favplace_hostland_ed25519 root@178.212.15.39
```

При текущей конфигурации Happ подключение через VPN зависает.
Для SSH можно отключить VPN либо использовать сохранённый помощник
`C:\Users\USER\.ssh\favplace-remote.py`: он создаёт соединение через Ethernet
без изменения системных маршрутов. Его настройки относятся к текущему компьютеру.

## Состояние и обновление

На сервере:

```bash
cd /opt/favplace/current
docker compose -p favplace -f docker-compose.yml -f /opt/favplace/docker-compose.override.yml ps
docker compose -p favplace -f docker-compose.yml -f /opt/favplace/docker-compose.override.yml logs --tail=100 api web caddy
```

Обновления запускаются автоматически после push в `master` репозитория
`VadyaProxima/favplace`. Workflow `.github/workflows/deploy.yml` также можно
запустить вручную через GitHub Actions с веткой `master`.
Actions загружает архив конкретного коммита по SSH. Сервер сохраняет исходники
в `/opt/favplace/releases/<SHA>`, делает резервную копию БД, последовательно
собирает API и фронтенд, запускает их и проверяет главную страницу и API.
Сборка с ошибкой оставляет предыдущий сайт работающим. При ошибке запуска или
проверки сервер возвращает предыдущие образы приложения; восстановление схемы
БД при несовместимой миграции выполняется вручную из сохранённой копии.
Логи деплоя доступны в GitHub Actions, текущий SHA — в `/opt/favplace/deployed-sha`.
После успешного деплоя неиспользуемый кэш сборки очищается с сохранением
до 2 ГБ. Запущенные контейнеры, постоянные тома и образы отката сохраняются.

При обновлении сохраняются серверные `.env`, `docker-compose.override.yml`
и production `Caddyfile`.
В production Caddyfile добавлен редирект с HTTP-адреса IP.
В `docker-compose.override.yml` API использует `149.154.167.220` для `api.telegram.org`:
адрес `149.154.166.110`, выбранный DNS, не отвечал с VPS. Альтернативный адрес
проверен с валидацией TLS; методы Telegram `getMe` и `getChat` возвращают `ok: true`.
При изменении доступности Telegram этот override нужно пересмотреть.

База и сертификаты находятся в постоянных Docker-томах.
Резервная копия базы:

```bash
docker exec favplace-db-1 pg_dump -U favplace favplace | gzip > backup-$(date +%F).sql.gz
```

## Свой домен

Добавьте A-запись домена на `178.212.15.39`, замените `SITE_DOMAIN` в серверном `.env`
и выполните на сервере:

```bash
cd /opt/favplace/current
docker compose -p favplace -f docker-compose.yml -f /opt/favplace/docker-compose.override.yml up -d --no-deps caddy
```

Caddy получит сертификат для нового домена. При смене домена обновите также
адрес проверки в `.github/workflows/deploy.yml` и серверном `favplace-deploy`.

## Ключ автодеплоя

GitHub хранит `FAVPLACE_DEPLOY_KEY` и `FAVPLACE_KNOWN_HOSTS` в Actions Secrets.
Ключ предназначен только для загрузки архива и запуска деплоя: произвольная
SSH-команда, интерактивная оболочка и перенаправление портов запрещены.
Серверные обработчики установлены в `/usr/local/sbin/favplace-deploy-gateway`
и `/usr/local/sbin/favplace-deploy`; исходники — в `scripts/deploy-*.sh`.

## Проверено 8 октября 2026

Главная, конструктор и 3D-модель открываются. Тайлы карты возвращают HTTP 200,
API строит рельеф, вход и сессия администратора работают. PostgreSQL доступен,
миграция применена. Невалидная заявка возвращает HTTP 400. Доступ бота Telegram
к настроенному чату проверен; тестовые сообщения и заявки не отправлялись.
