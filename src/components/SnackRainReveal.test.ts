import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const snackGrid = readFileSync(new URL('./SnackGrid.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('desktop rain uses the same smooth reveal layer as mobile rain', () => {
    assert.match(snackGrid, /className="snack-rain-layer/);
    assert.match(globalStyles, /\.snack-rain-layer\s*\{[\s\S]*500ms ease-out/);
});
