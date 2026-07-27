// Persistence + orchestration for the province battle game. Bridges the pure
// engine (war/engine.ts) and Turso: schema, seasons, loading/saving state, and
// the two things the app triggers — a like advancing the war, and reading it.
import { getDb } from '@/lib/db';
import { detectProvince } from '@/lib/provinces';
import { WAR } from './config';
import { PROVINCES, FACTION_COLOR } from './provinces-meta';
import {
    applyLike, initialTerritories, dominantFaction, totalConquestWinner,
    type WarState, type WarEvent,
} from './engine';

type DB = Awaited<ReturnType<typeof getDb>>;

let schemaReady = false;
async function ensureSchema(db: DB) {
    if (schemaReady) return;
    await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS war_season (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_at TEXT NOT NULL, end_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active', winner_province TEXT
        );
        CREATE TABLE IF NOT EXISTS war_power (
            season_id INTEGER NOT NULL, province TEXT NOT NULL,
            likes INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (season_id, province)
        );
        CREATE TABLE IF NOT EXISTS war_territory (
            province TEXT PRIMARY KEY, owner_province TEXT NOT NULL,
            garrison INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS war_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER,
            at TEXT NOT NULL, message TEXT NOT NULL,
            attacker TEXT, defender TEXT
        );
        CREATE TABLE IF NOT EXISTS war_meta (key TEXT PRIMARY KEY, value TEXT);
    `);
    try {
        await db.execute("ALTER TABLE snacks ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0");
    } catch (e: any) {
        if (!/duplicate column|already exists/i.test(e?.message || '')) throw e;
    }
    schemaReady = true;
}

async function getMeta(db: DB, key: string): Promise<string | null> {
    const r = await db.execute({ sql: "SELECT value FROM war_meta WHERE key = ?", args: [key] });
    return r.rows.length ? String(r.rows[0].value) : null;
}
async function setMeta(db: DB, key: string, value: string) {
    await db.execute({
        sql: "INSERT INTO war_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [key, value],
    });
}

// Rolling season: end = start + SEASON_DAYS. (Monday-alignment is a later nicety.)
function seasonEnd(startISO: string): string {
    return new Date(new Date(startISO).getTime() + WAR.SEASON_DAYS * 86400_000).toISOString();
}

async function resetTerritories(db: DB) {
    const t = initialTerritories();
    const stmts = PROVINCES.map((p) => ({
        sql: "INSERT INTO war_territory (province, owner_province, garrison) VALUES (?, ?, ?) " +
             "ON CONFLICT(province) DO UPDATE SET owner_province = excluded.owner_province, garrison = excluded.garrison",
        args: [p, t[p].owner, t[p].garrison] as (string | number)[],
    }));
    await db.batch(stmts);
}

async function startSeason(db: DB, startISO: string): Promise<number> {
    const end = seasonEnd(startISO);
    const r = await db.execute({
        sql: "INSERT INTO war_season (start_at, end_at, status) VALUES (?, ?, 'active')",
        args: [startISO, end],
    });
    const id = Number(r.lastInsertRowid);
    await setMeta(db, 'current_season_id', String(id));
    await resetTerritories(db);
    return id;
}

interface SeasonRow { id: number; end_at: string; status: string }

async function currentSeason(db: DB): Promise<SeasonRow> {
    const idStr = await getMeta(db, 'current_season_id');
    if (idStr) {
        const r = await db.execute({ sql: "SELECT id, end_at, status FROM war_season WHERE id = ?", args: [Number(idStr)] });
        if (r.rows.length) {
            const row = r.rows[0];
            return { id: Number(row.id), end_at: String(row.end_at), status: String(row.status) };
        }
    }
    const id = await startSeason(db, new Date().toISOString());
    return { id, end_at: seasonEnd(new Date().toISOString()), status: 'active' };
}

/** End the given season with a winner and open a fresh one. Returns new season id. */
async function rotateSeason(db: DB, endingId: number, winner: string): Promise<number> {
    // Conditional update so concurrent requests only rotate once.
    const upd = await db.execute({
        sql: "UPDATE war_season SET status = 'ended', winner_province = ? WHERE id = ? AND status = 'active'",
        args: [winner, endingId],
    });
    if (upd.rowsAffected === 0) {
        // Someone else already rotated; use whatever is current now.
        const s = await currentSeason(db);
        return s.id;
    }
    return startSeason(db, new Date().toISOString());
}

async function loadState(db: DB, seasonId: number): Promise<WarState> {
    const [terr, pow] = await Promise.all([
        db.execute("SELECT province, owner_province, garrison FROM war_territory"),
        db.execute({ sql: "SELECT province, likes FROM war_power WHERE season_id = ?", args: [seasonId] }),
    ]);
    const territories: WarState['territories'] = {};
    for (const p of PROVINCES) territories[p] = { province: p, owner: p, garrison: WAR.BASE_GARRISON };
    for (const row of terr.rows) {
        const p = String(row.province);
        if (territories[p]) territories[p] = { province: p, owner: String(row.owner_province), garrison: Number(row.garrison) };
    }
    const power: Record<string, number> = {};
    for (const row of pow.rows) power[String(row.province)] = Number(row.likes);
    return { seasonId, territories, power };
}

async function persistTerritories(db: DB, state: WarState) {
    const stmts = PROVINCES.map((p) => ({
        sql: "UPDATE war_territory SET owner_province = ?, garrison = ? WHERE province = ?",
        args: [state.territories[p].owner, state.territories[p].garrison, p] as (string | number)[],
    }));
    await db.batch(stmts);
}

async function persistLog(db: DB, seasonId: number, events: WarEvent[]) {
    if (events.length === 0) return;
    const at = new Date().toISOString();
    await db.batch(events.map((e) => ({
        sql: "INSERT INTO war_log (season_id, at, message, attacker, defender) VALUES (?, ?, ?, ?, ?)",
        args: [seasonId, at, e.message, e.attacker ?? null, e.defender ?? null] as (string | number | null)[],
    })));
    // Trim to the most recent WAR_LOG_KEEP rows.
    await db.execute({
        sql: "DELETE FROM war_log WHERE id NOT IN (SELECT id FROM war_log ORDER BY id DESC LIMIT ?)",
        args: [WAR.WAR_LOG_KEEP],
    });
}

/** A like on `snackId`: bump the all-time counter and, if the snack maps to a
 *  province, advance the war. Returns the new all-time like count. */
export async function likeSnack(snackId: number): Promise<{ likeCount: number; province: string | null }> {
    const db = await getDb();
    await ensureSchema(db);

    await db.execute({ sql: "UPDATE snacks SET like_count = like_count + 1 WHERE id = ?", args: [snackId] });
    const cnt = await db.execute({ sql: "SELECT like_count, manufacturer_address, manufacturer_name FROM snacks WHERE id = ?", args: [snackId] });
    if (cnt.rows.length === 0) throw new Error('snack not found');
    const row = cnt.rows[0];
    const likeCount = Number(row.like_count);
    const province = detectProvince(String(row.manufacturer_address || '')) || detectProvince(String(row.manufacturer_name || ''));
    if (!province) return { likeCount, province: null };

    const season = await ensureCurrentSeason(db);
    const state = await loadState(db, season.id);
    const events = applyLike(state, province, Math.random);

    await db.batch([{
        sql: "INSERT INTO war_power (season_id, province, likes) VALUES (?, ?, 1) " +
             "ON CONFLICT(season_id, province) DO UPDATE SET likes = likes + 1",
        args: [season.id, province],
    }]);
    await persistTerritories(db, state);
    await persistLog(db, season.id, events);

    const winner = totalConquestWinner(state);
    if (winner) await rotateSeason(db, season.id, winner);

    return { likeCount, province };
}

/** Ensure there is an active, non-expired season; rotate if the clock ran out. */
async function ensureCurrentSeason(db: DB): Promise<SeasonRow> {
    const s = await currentSeason(db);
    if (Date.now() >= new Date(s.end_at).getTime()) {
        const state = await loadState(db, s.id);
        const winner = dominantFaction(state).faction;
        const newId = await rotateSeason(db, s.id, winner);
        return { id: newId, end_at: seasonEnd(new Date().toISOString()), status: 'active' };
    }
    return s;
}

export interface BattlePayload {
    season: { id: number; endsAt: string };
    territories: { province: string; owner: string; garrison: number; color: string }[];
    leaderboard: { faction: string; territories: number; power: number; color: string }[];
    log: { at: string; message: string }[];
    lastWinner: string | null;
}

export async function getBattleState(): Promise<BattlePayload> {
    const db = await getDb();
    await ensureSchema(db);
    const season = await ensureCurrentSeason(db);
    const state = await loadState(db, season.id);

    const counts: Record<string, number> = {};
    for (const p of PROVINCES) counts[state.territories[p].owner] = (counts[state.territories[p].owner] || 0) + 1;
    const leaderboard = Object.keys(counts)
        .map((f) => ({ faction: f, territories: counts[f], power: state.power[f] || 0, color: FACTION_COLOR[f] }))
        .sort((a, b) => b.territories - a.territories || b.power - a.power);

    const logRows = await db.execute({
        sql: "SELECT at, message FROM war_log WHERE season_id = ? ORDER BY id DESC LIMIT 30",
        args: [season.id],
    });
    const lastWin = await db.execute("SELECT winner_province FROM war_season WHERE status = 'ended' ORDER BY id DESC LIMIT 1");

    return {
        season: { id: season.id, endsAt: season.end_at },
        territories: PROVINCES.map((p) => ({
            province: p,
            owner: state.territories[p].owner,
            garrison: state.territories[p].garrison,
            color: FACTION_COLOR[state.territories[p].owner],
        })),
        leaderboard,
        log: logRows.rows.map((r) => ({ at: String(r.at), message: String(r.message) })),
        lastWinner: lastWin.rows.length ? (lastWin.rows[0].winner_province as string | null) : null,
    };
}
