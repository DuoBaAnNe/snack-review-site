// Standalone assertion tests for the battle engine (run: npx tsx engine.test.ts).
// No test framework needed — keeps the project dependency-free.
import { WAR } from './config';
import { PROVINCES } from './provinces-meta';
import { ADJACENCY } from './adjacency';
import {
    initialTerritories, reinforce, combatStep, applyLike,
    factionTerritoryCount, dominantFaction, totalConquestWinner,
    type WarState, type Rng,
} from './engine';

let passed = 0;
let failed = 0;
function ok(cond: boolean, name: string) {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name}`); }
}
function eq(a: unknown, b: unknown, name: string) { ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)})`); }

// deterministic RNG
function mulberry32(seed: number): Rng {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const constRng: Rng = () => 0.5;

function freshState(seasonId = 1): WarState {
    return { seasonId, territories: initialTerritories(), power: {} };
}
function invariants(state: WarState, name: string) {
    const ts = Object.values(state.territories);
    const okCount = ts.length === PROVINCES.length;
    const okOwner = ts.every((t) => (PROVINCES as readonly string[]).includes(t.owner));
    const okGarrison = ts.every((t) => t.garrison >= 1);
    ok(okCount && okOwner && okGarrison, `${name}: invariants (34 territories, valid owners, garrison>=1)`);
}

console.log('adjacency');
{
    let symmetric = true, noSelf = true;
    for (const p of PROVINCES) {
        for (const q of ADJACENCY[p]) {
            if (p === q) noSelf = false;
            if (!ADJACENCY[q]?.includes(p)) symmetric = false;
        }
    }
    ok(symmetric, 'adjacency is symmetric');
    ok(noSelf, 'no self-loops');
    ok(PROVINCES.every((p) => Array.isArray(ADJACENCY[p])), 'every province has an adjacency list');
    ok(PROVINCES.every((p) => ADJACENCY[p].length > 0), 'every province borders at least one other');
}

console.log('initialTerritories');
{
    const t = initialTerritories();
    eq(Object.keys(t).length, PROVINCES.length, '34 territories');
    ok(PROVINCES.every((p) => t[p].owner === p), 'each province owns itself');
    ok(PROVINCES.every((p) => t[p].garrison === WAR.BASE_GARRISON), 'each starts at BASE_GARRISON');
}

console.log('reinforce');
{
    const s = freshState();
    reinforce(s, '上海');
    eq(s.territories['上海'].garrison, WAR.BASE_GARRISON + WAR.REINFORCE_PER_LIKE, 'home reinforced when owned');

    // home lost -> strongest holding takes the main reinforcement, others trickle
    const s2 = freshState();
    s2.territories['上海'].owner = '江苏';           // 上海 lost its home
    s2.territories['浙江'].owner = '上海';           // 上海 holds 浙江 (strongest) + 江西
    s2.territories['江西'].owner = '上海';
    s2.territories['浙江'].garrison = 20;
    s2.territories['江西'].garrison = 7;
    reinforce(s2, '上海');
    ok(s2.territories['浙江'].garrison === 20 + WAR.REINFORCE_PER_LIKE
        && s2.territories['江西'].garrison === 7 + WAR.REINFORCE_TRICKLE, 'main reinforcement to strongest holding, trickle to others');

    // eliminated faction -> no-op
    const s3 = freshState();
    s3.territories['上海'].owner = '江苏';
    const before = JSON.stringify(s3.territories);
    reinforce(s3, '上海');
    eq(JSON.stringify(s3.territories), before, 'eliminated faction reinforcement is a no-op');
}

console.log('combatStep — strong province expands');
{
    const s = freshState();
    s.territories['上海'].garrison = 1000; // giant next to weak equal neighbors
    const events = combatStep(s, mulberry32(42));
    const counts = factionTerritoryCount(s);
    ok((counts['上海'] || 0) >= 2, '上海 captured at least one neighbor');
    ok(events.some((e) => e.attacker === '上海'), 'a capture event was recorded for 上海');
    invariants(s, 'after combatStep');
}

console.log('combatStep — equal garrisons stalemate');
{
    const s = freshState(); // everything BASE_GARRISON, all equal
    const events = combatStep(s, mulberry32(7));
    eq(events.length, 0, 'no captures when all garrisons equal');
    ok(PROVINCES.every((p) => s.territories[p].owner === p), 'ownership unchanged');
}

console.log('applyLike');
{
    const s = freshState();
    applyLike(s, '广东', constRng);
    eq(s.power['广东'], 1, 'power incremented on like');

    // many likes to one province -> it expands its territory (track the peak
    // it reaches; the frontier can flip back on any single step)
    const s2 = freshState();
    const rng = mulberry32(123);
    let peak = 1;
    let allValid = true;
    for (let i = 0; i < 80; i++) {
        applyLike(s2, '四川', rng);
        peak = Math.max(peak, factionTerritoryCount(s2)['四川'] || 0);
        const ts = Object.values(s2.territories);
        if (ts.length !== PROVINCES.length || ts.some((t) => t.garrison < 1)) allValid = false;
    }
    ok(peak >= 3, `四川 expanded after 80 likes (peak ${peak} territories)`);
    ok(allValid, 'invariants held across all 80 likes');
}

console.log('winners');
{
    const s = freshState();
    eq(totalConquestWinner(s), null, 'no total-conquest winner at start');
    for (const p of PROVINCES) s.territories[p].owner = '北京';
    eq(totalConquestWinner(s), '北京', 'total conquest detected');
    eq(dominantFaction(s).faction, '北京', 'dominant faction is 北京');
    eq(dominantFaction(s).count, PROVINCES.length, 'dominant owns all 34');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
