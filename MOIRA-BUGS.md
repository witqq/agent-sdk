# Moira Workflow Bugs

## Bug 1: Infinite checklist fix loop

**Workflow:** moira/software-development-flow
**Step:** Checklist verification within verification cycle
**Process:** 6ac364be-4732-46fd-9121-6bda4899f9f2

**Expected:** When checklist has items that are by-design incomplete (e.g., "integration tests require real CLI auth", "CHANGELOG before release"), the workflow should accept them as acknowledged exceptions and proceed.

**Actual:** Workflow cycles endlessly: checklist check → finds 22/24 → asks to fix → agent confirms "fixed" (they're by-design) → re-checks → finds 22/24 → asks to fix again. Currently on iteration 4.

**Impact:** Blocks workflow progression. Agent cannot break out of the loop because the 2 items are genuinely unfixable in automated context.

**Suggested fix:** Add ability to mark checklist items as "N/A" or "by-design incomplete" that the workflow accepts without re-entering the fix cycle.

## Баг 5: UNDEFINED_VARIABLE в шаблоне fix-plan-issues

- **Шаг workflow**: "Fix found issues in updated plan" (после plan review)
- **Execution ID**: 190aeaca-47a9-4aa7-9028-bb8a09964c4f
- **Ожидаемое**: Директива должна содержать описание issues и suggested fixes из input предыдущего шага
- **Фактическое**: Все поля отображаются как `[[UNDEFINED_VARIABLE]]` — шаблон не получает переменные из input:
  ```
  - [[UNDEFINED_VARIABLE]] (step: Step 16)
    Fix: [[UNDEFINED_VARIABLE]]
  ```
- **Данные были переданы**: `update_issues_found` массив с 3 объектами (description, affected_step, severity, status), `update_review_issues_count: 3`
- **Предположение**: Шаблон ссылается на переменные через другие ключи (e.g. `issue.description`, `issue.fix`), а input содержит `description`, `severity`, `status`

## Баг 6: UNDEFINED_VARIABLE в final-report filename pattern

- **Шаг workflow**: "Create final report" (финальный отчёт после requirements coverage)
- **Execution ID**: b19492f4-56bf-4e84-91f5-4f5cb376ee2a
- **Ожидаемое**: `final-report-v{{report_attempt_count}}.md` должно подставить номер версии
- **Фактическое**: Шаблон показывает `final-report-v[[UNDEFINED_VARIABLE]].md` — переменная `report_attempt_count` не определена. Также VALIDATION ERROR при переходе на rework: "Variable 'report_attempt_count' is not defined or is null" — блокирует нормальный workflow flow
- **Предположение**: Переменная `report_attempt_count` не инициализирована в start node initialData

## Баг: plan_iteration undefined после возврата из child workflow

- **Workflow**: moira/software-development-flow
- **Execution**: b19492f4-56bf-4e84-91f5-4f5cb376ee2a
- **Шаг**: Возврат из architecture-design-flow child (4b2dcf15)
- **Ожидаемое**: step_approved_for_closure принимается, workflow продолжается
- **Фактическое**: `Variable 'plan_iteration' is not defined or is null` — workflow застрял
- **Workaround**: teleport-replan сбросил counters

## Баг: [[UNDEFINED_VARIABLE]] в шаблоне имени файла rework-context

- **Workflow**: moira/software-development-flow
- **Execution**: b19492f4-56bf-4e84-91f5-4f5cb376ee2a
- **Шаг**: save-rework-context (после teleport-replan)
- **Ожидаемое**: Имя файла содержит конкретное значение (итерацию или дату)
- **Фактическое**: `rework-context-[[UNDEFINED_VARIABLE]].md` — шаблон не заполнен
