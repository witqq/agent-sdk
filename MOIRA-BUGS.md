
## Bug 1: Infinite checklist fix loop

**Workflow:** moira/software-development-flow
**Step:** Checklist verification within verification cycle
**Process:** 6ac364be-4732-46fd-9121-6bda4899f9f2

**Expected:** When checklist has items that are by-design incomplete (e.g., "integration tests require real CLI auth", "CHANGELOG before release"), the workflow should accept them as acknowledged exceptions and proceed.

**Actual:** Workflow cycles endlessly: checklist check → finds 22/24 → asks to fix → agent confirms "fixed" (they're by-design) → re-checks → finds 22/24 → asks to fix again. Currently on iteration 4.

**Impact:** Blocks workflow progression. Agent cannot break out of the loop because the 2 items are genuinely unfixable in automated context.

**Suggested fix:** Add ability to mark checklist items as "N/A" or "by-design incomplete" that the workflow accepts without re-entering the fix cycle.
