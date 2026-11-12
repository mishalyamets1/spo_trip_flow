# Фактические запуски GitHub Actions

12 ноября 2026 года. Репозиторий `mishalyamets1/spo_trip_flow`, workflow [TripFlow checks](https://github.com/mishalyamets1/spo_trip_flow/actions/workflows/checks.yml). Рабочий main не изменялся; реализация вынесена в `feature/stage-5-verification`.

1. **Успешный запуск:** [43244533575](https://github.com/mishalyamets1/spo_trip_flow/actions/runs/43244533575), commit `edfc515`, ветка `feature/stage-5-verification`. GitHub подтвердил success всех проверок: форматирование, TypeScript, подготовка PostgreSQL/миграций, SQL, тесты с покрытием, production-сборка, упаковка и upload артефакта.
2. **Намеренное падение:** [43244582362](https://github.com/mishalyamets1/spo_trip_flow/actions/runs/43244582362), commit `d4c6c63`, отдельная ветка `ci/stage-5-failure`. Добавлен неотформатированный `tests/ci-failure-probe.ts`; шаг `npm run format:check` завершился failure, тесты/сборка/публикация артефакта пропущены. Probe не входит в рабочую реализацию.

При раннем отказе обнаружена дополнительная ошибка cleanup: Compose запускался до создания `.env`. Исправлено условием наличия файла перед остановкой контейнеров. Проба удалена commit `7c012ff`; [повторный запуск 43245004472](https://github.com/mishalyamets1/spo_trip_flow/actions/runs/43245004472) завершился **success**, включая полный набор проверок, сборку, артефакт и cleanup. Таким образом показан цикл «ошибка → исправление → успешный повтор».

Артефакт называется `tripflow-build-<полный SHA>` и хранится 7 дней. Содержит API dist, web .next и OpenAPI; `.env`, хэши БД и backup туда не входят. Синтетические CI-пароли задаются только для одноразового стенда. Автодоставка в рабочую среду не включена.

Локальные ответы GitHub API с итогами шагов сохранены в `output/stage-5/github-*.json`. Конфигурация: [checks.yml](../../.github/workflows/checks.yml). Падение исправлять по первому ошибочному шагу, после исправления повторять полный pipeline.
