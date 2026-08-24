import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHealth, probeDatabase } from './health';

test('database probe executes exactly SELECT 1 and closes the client after success', async () => {
    const statements: string[] = [];
    let closed = false;

    await probeDatabase(() => ({
        execute: async (statement: string) => { statements.push(statement); },
        close: () => { closed = true; },
    }));

    assert.deepEqual(statements, ['SELECT 1']);
    assert.equal(closed, true);
});

test('database probe closes the client after failure without exposing error contents', async () => {
    const secretError = 'libsql://secret-host?authToken=must-not-leak';
    let closed = false;
    let observedError: unknown;

    try {
        await probeDatabase(() => ({
            execute: async () => { throw new Error(secretError); },
            close: () => { closed = true; },
        }));
    } catch (error) {
        observedError = error;
    }

    assert.equal(closed, true);
    assert.equal(observedError instanceof Error, true);
    assert.doesNotMatch(JSON.stringify({ status: 'degraded', gitSha: 'abc1234' }), /must-not-leak/);
});

test('returns ok with the deployed git SHA after a successful database probe', async () => {
    let probes = 0;
    const result = await evaluateHealth({
        gitSha: 'abc1234',
        checkDatabase: async () => { probes += 1; },
    });

    assert.equal(probes, 1);
    assert.deepEqual(result, {
        statusCode: 200,
        body: { status: 'ok', gitSha: 'abc1234' },
    });
});

test('uses unknown when APP_GIT_SHA is absent', async () => {
    const result = await evaluateHealth({
        checkDatabase: async () => undefined,
    });

    assert.equal(result.body.gitSha, 'unknown');
});

test('returns a fixed degraded response without leaking database errors', async () => {
    const secretError = 'libsql://secret-host?authToken=must-not-leak';
    const result = await evaluateHealth({
        gitSha: 'abc1234',
        checkDatabase: async () => { throw new Error(secretError); },
    });

    assert.deepEqual(result, {
        statusCode: 503,
        body: { status: 'degraded', gitSha: 'abc1234' },
    });
    assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
});
