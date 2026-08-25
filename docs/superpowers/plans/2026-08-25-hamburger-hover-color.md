# Hamburger Hover Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the hamburger icon turn the same orange as the “七零十” Logo when hovered on both the homepage and snack detail pages.

**Architecture:** Keep the two existing menu buttons and their behavior unchanged. Add the same Tailwind hover utility to each button, and protect the requirement with a focused source-level regression test because the project has no component DOM test framework.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Node test runner via `tsx`.

## Global Constraints

- Default icon color remains the existing dark gray.
- Hover icon color is exactly Tailwind `orange-500`, matching the Logo.
- Existing `hover:bg-white/60` and `transition-colors` behavior remains.
- Button position, size, rounded corners, menu state, click behavior, and keyboard behavior do not change.
- Both the homepage and every snack detail page receive the same behavior.
- Test locally first; do not deploy without a new user confirmation.

---

### Task 1: Add and Protect the Shared Hover Behavior

**Files:**
- Create: `src/components/HamburgerHoverColor.test.ts`
- Modify: `src/components/HomePageContent.tsx:110-117`
- Modify: `src/components/SnackDetailNavigation.tsx:14-20`
- Modify: `package.json:8`

**Interfaces:**
- Consumes: the existing hamburger buttons identified by the `打开菜单` / `关闭菜单` accessible label.
- Produces: both button class lists contain `hover:text-orange-500` while preserving `text-gray-600`, `hover:bg-white/60`, and `transition-colors`.

- [ ] **Step 1: Write the failing regression test**

Create `src/components/HamburgerHoverColor.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function hamburgerClassName(file: string) {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');
    const match = source.match(
        /aria-label=\{menuOpen \? '关闭菜单' : '打开菜单'\}[\s\S]*?className="([^"]+)"/,
    );
    assert.ok(match, `hamburger button not found in ${file}`);
    return match[1].split(/\s+/);
}

for (const file of [
    'src/components/HomePageContent.tsx',
    'src/components/SnackDetailNavigation.tsx',
]) {
    test(`${file} keeps the hamburger gray until hover and orange on hover`, () => {
        const classes = hamburgerClassName(file);
        assert.ok(classes.includes('text-gray-600'));
        assert.ok(classes.includes('hover:text-orange-500'));
        assert.ok(classes.includes('hover:bg-white/60'));
        assert.ok(classes.includes('transition-colors'));
    });
}
```

Update `package.json` so the existing navigation test command owns this UI regression:

```json
"test:detail-navigation": "npx --yes tsx@4.23.12 --test src/lib/snack-detail-navigation.test.ts src/components/HamburgerHoverColor.test.ts"
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test:detail-navigation
```

Expected: the three existing navigation tests pass, while both new hover tests fail because `hover:text-orange-500` is absent.

- [ ] **Step 3: Add the minimal production classes**

In both `HomePageContent.tsx` and `SnackDetailNavigation.tsx`, change the hamburger button class from:

```tsx
className="fixed top-2.5 left-2 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white/60 transition-colors"
```

to:

```tsx
className="fixed top-2.5 left-2 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:text-orange-500 hover:bg-white/60 transition-colors"
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:detail-navigation
```

Expected: five tests pass and zero fail.

- [ ] **Step 5: Run automated regression checks**

Run:

```powershell
npm run test:map-panel
npm run test:pagination
npm run test:deployment
npx eslint src/components/HomePageContent.tsx src/components/SnackDetailNavigation.tsx src/components/HamburgerHoverColor.test.ts
npm run build
git diff --check
```

Expected: every test command exits 0, ESLint reports no errors, the production build succeeds, and `git diff --check` has no output.

- [ ] **Step 6: Verify both pages in the local browser**

Open `http://127.0.0.1:3010/` and the local test snack route `http://127.0.0.1:3010/snacks/1`.

On each page verify:

1. The hamburger is dark gray before hover.
2. Moving the pointer onto the hamburger changes the three lines to orange while keeping the pale background.
3. Moving the pointer away restores dark gray.
4. Clicking the button still opens and closes the existing menu.

- [ ] **Step 7: Commit the implementation**

```powershell
git add package.json src/components/HamburgerHoverColor.test.ts src/components/HomePageContent.tsx src/components/SnackDetailNavigation.tsx
git commit -m "feat: add orange hover to hamburger menus"
```

After committing, keep the branch and worktree in place. Do not deploy until the user explicitly requests it.
