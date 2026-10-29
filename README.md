# TripFlow

## Быстрый старт

```bash
cp .env.example .env   # задать пароли
make up                # поднять PostgreSQL
make migrate           # накатить миграции
make check             # проверить данные
```

## Makefile

| Команда | Что делает |
|---------|------------|
| `make up` | Поднять PostgreSQL |
| `make down` | Остановить |
| `make reset` | Удалить volume и поднять заново |
| `make migrate` | Накатить все миграции |
| `make migrate-down` | Откатить последнюю миграцию |
| `make migrate-status` | Текущая версия |
| `make check` | Контрольные запросы из отчёта |
| `make psql` | Консоль psql |

## Миграции

```
database/migrations/
  000001_init.up.sql    — схема trip_app
  000001_init.down.sql
  000002_seed.up.sql    — тестовые данные
  000002_seed.down.sql
```

Новая миграция — пара файлов `000003_название.up.sql` / `.down.sql`.

Используется [golang-migrate](https://github.com/golang-migrate/migrate) через Docker, ставить ничего не нужно.
