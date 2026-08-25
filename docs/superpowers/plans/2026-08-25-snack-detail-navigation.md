# Snack Detail Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit home link and the complete homepage hamburger menu to every `/snacks/[id]` detail page without changing login, admin, or other routes.

**Architecture:** A new client component owns only the detail-page menu state and cross-page routing while reusing the existing `HomeSidebar` as the single menu presentation. The server detail page renders that component plus a progressive-enhancement `Link` back to `/` before the existing snack content.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Node test runner through `tsx`.

## Global Constraints

- Menu scope is limited to all `/snacks/[id]` pages; login, admin, and other routes must not change.
- Menu button position, size, copy, and `aria-label` must match the homepage hamburger.
- Menu category destinations are `/` for “全部” and `/?cat=<encoded category>` for every named category.
- Menu section destinations are `/#sec-map`, `/#sec-news`, and `/#sec-ing`.
- Menu search destination is `/search`.
- The visible “← 返回首页” link always targets `/`.
- Reuse `HomeSidebar`; do not copy its menu markup.
- Do not deploy; retain all work on the current local branch for testing.

---

### Task 1: Snack detail navigation contract and implementation

**Files:**
- Create: `src/app/snacks/[id]/SnackDetail.navigation.test.ts`
- Create: `src/components/SnackDetailNavigation.tsx`
- Modify: `src/app/snacks/[id]/page.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `HomeSidebar` props `open`, `onClose`, `activeCategory`, `onSelectCategory`, `onGoSection`, and `onOpenSearch`.
- Produces: default client component `SnackDetailNavigation(): JSX.Element` rendered once by every successful `/snacks/[id]` page.
- Produces: npm script `test:detail-navigation` for the source-level route contract.

- [ ] **Step 1: Read the test-quality rules before writing the test**

Read `superpowers/test-driven-development/writing-good-tests.md` completely. The production changes that make the test pass must be exactly: creating `SnackDetailNavigation.tsx`, rendering it in `[id]/page.tsx`, and adding the explicit home link.

- [ ] **Step 2: Write the failing route contract test**

Create `src/app/snacks/[id]/SnackDetail.navigation.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(
    new URL('../../../components/SnackDetailNavigation.tsx', import.meta.url),
    'utf8',
);

test('every snack detail page renders the shared hamburger and an explicit home link', () => {
    assert.match(pageSource, /<SnackDetailNavigation\s*\/>/);
    assert.match(pageSource, /href=["']\/["']/);
    assert.match(pageSource, /← 返回首页/);
    assert.match(navigationSource, /<HomeSidebar/);
    assert.match(navigationSource, /aria-label=\{menuOpen \? '关闭菜单' : '打开菜单'\}/);
});

test('detail menu routes every homepage destination correctly', () => {
    assert.match(navigationSource, /category \? `\/\?cat=\$\{encodeURIComponent\(category\)\}` : '\/'/);
    assert.match(navigationSource, /router\.push\(`\/#\$\{id\}`\)/);
    assert.match(navigationSource, /router\.push\('\/search'\)/);
});
```

Add this script to `package.json`:

```json
"test:detail-navigation": "npx --yes tsx@4.23.12 --test src/app/snacks/[id]/SnackDetail.navigation.test.ts"
```

- [ ] **Step 3: Run the test and verify the RED state**

Run:

```powershell
npm run test:detail-navigation
```

Expected: FAIL because `src/components/SnackDetailNavigation.tsx` does not exist. This is the intended missing-feature failure, not a syntax failure.

- [ ] **Step 4: Implement the detail-page hamburger controller**

Create `src/components/SnackDetailNavigation.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import HomeSidebar from './HomeSidebar';

export default function SnackDetailNavigation() {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
                className="fixed top-2.5 left-2 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white/60 transition-colors"
            >
                <span className="text-xl leading-none">☰</span>
            </button>

            <HomeSidebar
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                activeCategory={null}
                onSelectCategory={(category) => {
                    setMenuOpen(false);
                    router.push(category ? `/?cat=${encodeURIComponent(category)}` : '/');
                }}
                onGoSection={(id) => {
                    setMenuOpen(false);
                    router.push(`/#${id}`);
                }}
                onOpenSearch={() => {
                    setMenuOpen(false);
                    router.push('/search');
                }}
            />
        </>
    );
}
```

- [ ] **Step 5: Render navigation and the explicit home link on every detail page**

In `src/app/snacks/[id]/page.tsx`, import `Link` and `SnackDetailNavigation`, then change the successful page return to:

```tsx
return (
    <>
        <SnackDetailNavigation />
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
            <Link
                href="/"
                className="inline-flex items-center mb-4 text-sm font-medium text-gray-500 hover:text-orange-500 transition-colors"
            >
                ← 返回首页
            </Link>
            <SnackDetail snack={snack} related={related} />
        </div>
    </>
);
```

- [ ] **Step 6: Run the focused test and verify the GREEN state**

Run:

```powershell
npm run test:detail-navigation
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 7: Run changed-file lint and the production build**

Run:

```powershell
npx eslint src/components/SnackDetailNavigation.tsx "src/app/snacks/[id]/page.tsx" "src/app/snacks/[id]/SnackDetail.navigation.test.ts"
npm run build
```

Expected: changed-file lint exits 0 and the Next.js production build exits 0.

- [ ] **Step 8: Commit the tested implementation**

```powershell
git add package.json src/components/SnackDetailNavigation.tsx "src/app/snacks/[id]/page.tsx" "src/app/snacks/[id]/SnackDetail.navigation.test.ts"
git commit -m "feat: add navigation to snack detail pages"
```

### Task 2: Regression and local browser verification

**Files:**
- Verify only; no production files should change.

**Interfaces:**
- Consumes: local detail URL `/snacks/1` using the isolated worktree SQLite test snack.
- Produces: browser evidence that the visible home link, hamburger drawer, category route, section route, and search route behave as specified.

- [ ] **Step 1: Run all repository test scripts**

Run:

```powershell
npm run test:detail-navigation
npm run test:map-panel
npm run test:pagination
npm run test:deployment
```

Expected: every command exits 0 with zero failed tests.

- [ ] **Step 2: Start the local server without the placeholder Turso values**

Run:

```powershell
$env:TURSO_DATABASE_URL=''
$env:TURSO_AUTH_TOKEN=''
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Expected: Next.js reports `Ready` at `http://127.0.0.1:3010/`.

- [ ] **Step 3: Verify the detail page visually and semantically**

Open `http://127.0.0.1:3010/snacks/1` and verify:

1. “← 返回首页” is visible above the snack hero and targets `/`.
2. The fixed top-left button has accessible name “打开菜单”.
3. Clicking it opens the existing sidebar with all categories, 零食地图, 食品资讯, 成分科普, and 搜索.
4. A named category navigates to `/?cat=<encoded category>`.
5. 零食地图 navigates to `/#sec-map`.
6. 食品资讯 navigates to `/#sec-news`.
7. 成分科普 navigates to `/#sec-ing`.
8. 搜索 navigates to `/search`.

- [ ] **Step 4: Verify repository state and preserve the local branch**

Run:

```powershell
git status --short
git log -2 --oneline
```

Expected: source tree is clean, the implementation commit is present, and no merge, push, or deployment has occurred.

