# Docker Compose and the Node scripts read .env themselves.
# Do not evaluate .env as Make syntax (quoted passwords are not Make values).

.PHONY: help up down reset migrate migrate-down migrate-status provision check psql setup demo app dev test backup restore

help:
	@echo "make setup          — БД, миграции и пароль роли приложения"
	@echo "make demo           — учебные пользователи (нужен DEMO_PASSWORD)"
	@echo "make app            — собрать и запустить всё приложение"
	@echo "make dev            — frontend и backend локально"
	@echo "make test           — проверки на отдельной временной БД"
	@echo "make check          — SQL-проверки Q-01–Q-08"
	@echo "make backup         — резервная копия в backups/"
	@echo "make restore FILE=... DB=tripflow_restore_... — восстановить в новую БД"
	@echo "make up/down        — поднять БД / остановить окружение"
	@echo "make migrate/migrate-status/migrate-down — миграции"
	@echo "make reset          — УДАЛИТЬ данные БД (только вручную)"

up:
	@docker compose up -d db --wait

down:
	@docker compose --profile app down

reset:
	@docker compose --profile app down -v
	@$(MAKE) up

migrate: up
	@node scripts/database.mjs migrate

migrate-down:
	@node scripts/database.mjs down

migrate-status:
	@node scripts/database.mjs version

provision:
	@node scripts/database.mjs provision

setup: migrate provision

demo:
	@npm run demo -w @tripflow/api

app:
	@docker compose --profile app up -d --build --wait

dev:
	@npm run dev

check:
	@node scripts/database.mjs check

test:
	@node scripts/test.mjs

backup:
	@node scripts/database.mjs backup

restore:
	@node scripts/database.mjs restore-copy "$(FILE)" "$(DB)"

psql:
	@docker compose exec db sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
