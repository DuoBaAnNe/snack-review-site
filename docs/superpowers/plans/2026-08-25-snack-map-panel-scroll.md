# Snack Map Panel Scroll Anchoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the province snack thumbnail panel stay at its clicked point inside the map and scroll with the map instead of remaining fixed to the viewport.

**Architecture:** Add a small pure coordinate helper that converts ECharts viewport coordinates into map-container coordinates and returns an absolute-position style. `SnackMapView` will store that position for both hover and pinned panels and render the panel inside its existing relative container.

**Tech Stack:** Next.js 16, React 19, TypeScript, ECharts 6, Tailwind CSS, Node test runner through `tsx`.

## Global Constraints

- Test first: the position helper test must fail before production code is added.
- The panel must be positioned relative to the existing map container with `position: absolute`.
- Preserve the current `+18px` horizontal and `-30px` vertical offsets.
- Hover and click-pinned panels must use the same coordinate conversion.
- Do not change card content, visual styling, map data, province battle code, or add dependencies.
- Test locally only; do not deploy.

---

### Task 1: Define map-relative panel positioning

**Files:**
- Create: `src/components/SnackMapView.position.test.ts`
- Create: `src/components/snack-map-panel-position.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getMapPanelPosition(clientX: number, clientY: number, containerRect: { left: number; top: number }): { position: 'absolute'; left: number; top: number }`
- Consumes: no application dependencies; this is a pure coordinate conversion.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { getMapPanelPosition } from './snack-map-panel-position';

test('anchors the panel to the clicked point inside the map container', () => {
    assert.deepEqual(
        getMapPanelPosition(450, 360, { left: 100, top: 200 }),
        { position: 'absolute', left: 368, top: 130 },
    );
});
```

Add the script:

```json
"test:map-panel": "npx --yes tsx@4.23.12 --test src/components/SnackMapView.position.test.ts"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:map-panel`

Expected: FAIL because `./snack-map-panel-position` does not exist.

- [ ] **Step 3: Add the minimal position helper**

```ts
export interface MapContainerRect {
    left: number;
    top: number;
}

export interface MapPanelPosition {
    position: 'absolute';
    left: number;
    top: number;
}

export function getMapPanelPosition(
    clientX: number,
    clientY: number,
    containerRect: MapContainerRect,
): MapPanelPosition {
    return {
        position: 'absolute',
        left: clientX - containerRect.left + 18,
        top: clientY - containerRect.top - 30,
    };
}
```

- [ ] **Step 4: Run the focused test**

Run: `npm run test:map-panel`

Expected: PASS, 1 test and 0 failures.

- [ ] **Step 5: Commit the tested helper**

```bash
git add package.json src/components/SnackMapView.position.test.ts src/components/snack-map-panel-position.ts
git commit -m "test: define map panel scroll anchoring"
```

### Task 2: Use map-relative coordinates in the province panel

**Files:**
- Modify: `src/components/SnackMapView.tsx`
- Test: `src/components/SnackMapView.position.test.ts`

**Interfaces:**
- Consumes: `getMapPanelPosition(...)` and `MapPanelPosition` from `./snack-map-panel-position`.
- Produces: hover and pinned panel state containing `panelPosition: MapPanelPosition`.

- [ ] **Step 1: Replace viewport-coordinate state**

Import the helper and type:

```ts
import { getMapPanelPosition, type MapPanelPosition } from './snack-map-panel-position';
```

Replace `clientX` and `clientY` in `floatPanel` state with:

```ts
panelPosition: MapPanelPosition;
```

- [ ] **Step 2: Convert both hover and click coordinates at the event boundary**

For each ECharts handler, get `container.getBoundingClientRect()`. If the container is unavailable, do not open a new panel. Otherwise create:

```ts
const panelPosition = getMapPanelPosition(cx, cy, container.getBoundingClientRect());
```

Store `panelPosition` for both the hover panel and the pinned click panel.

- [ ] **Step 3: Render with the absolute position style**

Remove the `fixed` class and spread the stored position into the style:

```tsx
className="z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[280px]"
style={{
    ...floatPanel.panelPosition,
    pointerEvents: floatPanel.pinned ? 'auto' : 'none',
}}
```

- [ ] **Step 4: Run focused and existing automated tests**

Run:

```bash
npm run test:map-panel
npm run test:pagination
npm run test:deployment
npm run lint
```

Expected: all tests PASS and lint exits 0.

- [ ] **Step 5: Build the production bundle**

Run: `npm run build`

Expected: Next.js build exits 0 with no TypeScript error.

- [ ] **Step 6: Commit the component fix**

```bash
git add src/components/SnackMapView.tsx
git commit -m "fix: anchor snack map panel to map"
```

### Task 3: Verify scrolling in the local browser

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the locally running Next.js app and production-equivalent local data.
- Produces: verified desktop behavior for the province panel.

- [ ] **Step 1: Start the local app on an available localhost port**

Run: `npm run dev -- --hostname 127.0.0.1 --port 3010`

Expected: Next.js reports the local server ready at `http://127.0.0.1:3010/`.

- [ ] **Step 2: Open the homepage and click a province containing snacks**

Confirm the thumbnail card appears to the right of the clicked point and remains interactive.

- [ ] **Step 3: Scroll in both directions**

Confirm the card moves with the map when scrolling down and up, keeps its map-relative location, and leaves the viewport when the map leaves the viewport.

- [ ] **Step 4: Verify preserved interactions**

Confirm the close button hides the panel, clicking a snack thumbnail opens its detail page, and hovering another populated province still shows the temporary panel.

- [ ] **Step 5: Record verification evidence**

Report the local URL, automated command results, build result, tested province, and observed scroll behavior. Do not deploy.
