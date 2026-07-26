// Province battle engine — pure logic, no DB and no wall-clock. All time and
// randomness are injected so every function is deterministic and unit-testable.
// The war advances only when applyLike() is called (event-driven, see spec).
import { WAR } from './config';
import { PROVINCES } from './provinces-meta';
import { ADJACENCY } from './adjacency';

export interface Territory {
    province: string; // the land region
    owner: string;    // faction currently holding it
    garrison: number; // troops stationed
}

export interface WarState {
    seasonId: number;
    territories: Record<string, Territory>; // keyed by province
    power: Record<string, number>;          // faction -> this season's likes
}

export interface WarEvent {
    message: string;
    attacker?: string;
    defender?: string;
}

export type Rng = () => number; // returns [0, 1)

/** Fresh map at season start: every province owns itself with a base garrison. */
export function initialTerritories(): Record<string, Territory> {
    const t: Record<string, Territory> = {};
    for (const p of PROVINCES) t[p] = { province: p, owner: p, garrison: WAR.BASE_GARRISON };
    return t;
}

function ownedBy(state: WarState, faction: string): Territory[] {
    return Object.values(state.territories).filter((t) => t.owner === faction);
}

/** A like reinforces every territory the faction currently holds, so conquered
 *  land can be defended and the faction can snowball. A faction with no
 *  territories left is eliminated (no-op). */
export function reinforce(state: WarState, faction: string): void {
    const owned = ownedBy(state, faction);
    if (owned.length === 0) return;
    for (const t of owned) t.garrison += WAR.REINFORCE_PER_LIKE;
}

function rand(rng: Rng): number {
    return WAR.RAND_MIN + rng() * (WAR.RAND_MAX - WAR.RAND_MIN);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Unordered border pairs (each undirected edge once).
const BORDER_PAIRS: [string, string][] = (() => {
    const out: [string, string][] = [];
    for (const p of PROVINCES) {
        for (const q of ADJACENCY[p]) if (p < q) out.push([p, q]);
    }
    return out;
})();

/** Resolve every front line once. Mutates state; returns capture events. */
export function combatStep(state: WarState, rng: Rng): WarEvent[] {
    const events: WarEvent[] = [];
    const attacked = new Set<string>(); // a territory attacks at most once per step
    for (const [pa, pb] of shuffle(BORDER_PAIRS, rng)) {
        const A = state.territories[pa];
        const B = state.territories[pb];
        if (A.owner === B.owner) continue;      // same faction now — no front here
        if (A.garrison === B.garrison) continue; // stalemate this step
        const atk = A.garrison > B.garrison ? A : B;
        const def = atk === A ? B : A;
        if (attacked.has(atk.province)) continue;

        const aG = atk.garrison;
        const dG = def.garrison;
        const effectiveDef = dG + WAR.BASE_DEFENSE;
        // Only attack with a clear advantage — otherwise hold and let likes
        // accumulate. The margin also keeps freshly-conquered land defensible
        // against equal-strength neighbors, so wins aren't instantly reversed.
        if (aG <= effectiveDef * WAR.ATTACK_ADVANTAGE) continue;
        attacked.add(atk.province);

        const aPow = aG * rand(rng);
        const dPow = effectiveDef * rand(rng);

        if (aPow > dPow) {
            const fa = atk.owner;
            const casualties = Math.round(dG * WAR.CASUALTY_RATE);
            const remaining = Math.max(2, aG - casualties);
            const occupy = Math.max(1, Math.round(remaining * WAR.OCCUPY_RATE));
            atk.garrison = Math.max(1, remaining - occupy); // home keeps the bulk
            def.owner = fa;
            def.garrison = occupy;                          // detachment holds the new land
            events.push({ message: `${fa} 攻占 ${def.province}`, attacker: fa, defender: def.province });
        } else {
            atk.garrison = Math.max(1, Math.round(aG - dG * WAR.REPEL_ATK_LOSS));
            def.garrison = Math.max(1, Math.round(dG - aG * WAR.REPEL_DEF_LOSS));
        }
    }
    return events;
}

/** One like: record power, reinforce, then advance the front. Mutates state. */
export function applyLike(
    state: WarState,
    faction: string,
    rng: Rng,
    steps: number = WAR.APPLY_STEPS_PER_LIKE,
): WarEvent[] {
    state.power[faction] = (state.power[faction] || 0) + 1;
    reinforce(state, faction);
    const events: WarEvent[] = [];
    for (let i = 0; i < steps; i++) events.push(...combatStep(state, rng));
    return events;
}

export function factionTerritoryCount(state: WarState): Record<string, number> {
    const c: Record<string, number> = {};
    for (const t of Object.values(state.territories)) c[t.owner] = (c[t.owner] || 0) + 1;
    return c;
}

/** Faction holding the most territory (ties broken by faction name for determinism). */
export function dominantFaction(state: WarState): { faction: string; count: number } {
    const c = factionTerritoryCount(state);
    let best = '';
    let n = -1;
    for (const [f, k] of Object.entries(c)) {
        if (k > n || (k === n && f < best)) { best = f; n = k; }
    }
    return { faction: best, count: n };
}

/** If a single faction owns every territory, that faction; else null. */
export function totalConquestWinner(state: WarState): string | null {
    const factions = Object.keys(factionTerritoryCount(state));
    return factions.length === 1 ? factions[0] : null;
}
