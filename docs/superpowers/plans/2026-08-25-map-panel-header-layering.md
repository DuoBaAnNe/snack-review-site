# Map Panel Header Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the province snack panel above the map but below the sticky site header while preserving its map-anchored scroll behavior.

**Architecture:** The existing map-relative positioning remains unchanged. The map container becomes an isolated stacking context, the panel receives `z-30`, and the global sticky header retains `z-50`, so the panel cannot paint above the header.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, ECharts, local browser verification.

## Global Constraints

- Preserve the existing map-relative absolute coordinates and pinned-panel behavior.
- Preserve the global header at `z-50` and do not change its height, transparency, or sticky behavior.
- Keep the panel above the ECharts canvas and below the header.
- Do not add `overflow-hidden` to the map container.
- Do not make the panel sticky or clamp it below the header.
- Test locally first; do not deploy without a new explicit instruction.

---

### Task 1: Reproduce and correct the stacking order

**Files:**
- Modify: `src/components/SnackMapView.tsx:301-326`
- Test: existing `src/components/SnackMapView.position.test.ts`
- Browser test: `http://127.0.0.1:3010/` using the local Guangdong test snack

**Interfaces:**
- Consumes: the existing `relative mx-auto w-full` map container and `floatPanel.panelPosition` absolute coordinates.
- Produces: an isolated map stacking context, panel computed `z-index: 30`, and unchanged map-relative positioning.

- [ ] **Step 1: Record the failing browser behavior before editing**

Open the local homepage, click Guangdong, and evaluate the visible panel and header:

```js
const header = document.querySelector('header');
const title = [...document.querySelectorAll('span')]
  .find((element) => /广东（\d+款）/.test(element.textContent || ''));
const panel = title?.parentElement?.parentElement;
const headerZ = Number(getComputedStyle(header).zIndex);
const panelZ = Number(getComputedStyle(panel).zIndex);
({ headerZ, panelZ, panelBelowHeader: panelZ < headerZ });
```

Expected RED result:

```js
{ headerZ: 50, panelZ: 9999, panelBelowHeader: false }
```

- [ ] **Step 2: Apply the minimal stacking fix**

In `src/components/SnackMapView.tsx`, change the map container from:

```tsx
<div ref={containerRef} className="relative mx-auto w-full">
```

to:

```tsx
<div ref={containerRef} className="relative isolate mx-auto w-full">
```

Change the panel class from:

```tsx
className="z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[280px]"
```

to:

```tsx
className="z-30 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[280px]"
```

Do not modify `floatPanel.panelPosition`, event handlers, panel content, or header styles.

- [ ] **Step 3: Verify the GREEN stacking result in the browser**

Reload the local homepage, click Guangdong, and run the same evaluation from Step 1.

Expected GREEN result:

```js
{ headerZ: 50, panelZ: 30, panelBelowHeader: true }
```

- [ ] **Step 4: Verify visual occlusion and position preservation**

Before scrolling, record:

```js
const beforePanelToCanvasY =
  panel.getBoundingClientRect().top - document.querySelector('canvas').getBoundingClientRect().top;
```

Scroll until the panel enters the header rectangle, then verify:

```js
const headerRect = header.getBoundingClientRect();
const panelRect = panel.getBoundingClientRect();
const canvasRect = document.querySelector('canvas').getBoundingClientRect();
const afterPanelToCanvasY = panelRect.top - canvasRect.top;
({
  overlapsHeader: panelRect.top < headerRect.bottom && panelRect.bottom > headerRect.top,
  positionPreserved: afterPanelToCanvasY === beforePanelToCanvasY,
  topElementIsHeader: document
    .elementFromPoint(panelRect.left + 10, Math.min(headerRect.bottom - 2, panelRect.bottom - 2))
    ?.closest('header') === header,
});
```

Expected while overlapping:

```js
{ overlapsHeader: true, positionPreserved: true, topElementIsHeader: true }
```

- [ ] **Step 5: Run the focused map regression test**

Run:

```powershell
npm run test:map-panel
```

Expected: 1 test passes, 0 fail, proving the panel remains anchored to the map coordinate system.

- [ ] **Step 6: Commit the focused fix**

```powershell
git add src/components/SnackMapView.tsx
git commit -m "fix: keep map panel below site header"
```

### Task 2: Regression and build verification

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes: the stacking fix committed in Task 1.
- Produces: evidence that navigation, pagination, deployment contracts, and the production build remain healthy.

- [ ] **Step 1: Run all repository test scripts**

Run:

```powershell
npm run test:detail-navigation
npm run test:map-panel
npm run test:pagination
npm run test:deployment
```

Expected: every command exits 0 with zero failed tests.

- [ ] **Step 2: Run lint on files without pre-existing map-component violations**

Run:

```powershell
npx eslint src/components/snack-map-panel-position.ts src/components/SnackMapView.position.test.ts
```

Expected: exit 0. `SnackMapView.tsx` retains four pre-existing lint errors and one image warning unrelated to the two changed class tokens; do not broaden this fix into a component refactor.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: Next.js compilation, TypeScript, and static generation complete with exit 0.

- [ ] **Step 4: Verify the clean local branch state**

Run:

```powershell
git diff --check
git status --short
git log -2 --oneline
```

Expected: no uncommitted source changes, the stacking fix commit is present, and no deployment has occurred.
