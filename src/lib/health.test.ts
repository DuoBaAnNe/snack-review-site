import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHealth } from './health';

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
