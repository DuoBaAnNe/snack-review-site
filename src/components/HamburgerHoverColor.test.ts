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
