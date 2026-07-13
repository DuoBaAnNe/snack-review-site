import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import type { Snack, SnackImage, CreateSnackInput } from '@/types';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

let client: ReturnType<typeof createClient>;
let initPromise: Promise<void> | null = null;

// In-memory cache for frequently accessed queries
const cache = new Map<string, { data: any; expires: number }>();
function getCached<T>(key: string, ttlMs: number): T | null {
    const entry = cache.get(key);
    if (entry && Date.now() < entry.expires) return entry.data as T;
    cache.delete(key);
    return null;
}
function setCache(key: string, data: any, ttlMs: number) {
    cache.set(key, { data, expires: Date.now() + ttlMs });
}

export async function getDb() {
    if (!client) {
        if (TURSO_URL) {
            client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
        } else {
            client = createClient({ url: 'file:./database/snacks.db' });
        }
        if (client instanceof Promise) {
            client = await client;
        }
        initPromise = initSchema().then(async () => {
            // Seed admin immediately after schema creation.
            // Hash can be overridden without a code change via ADMIN_PASSWORD_HASH.
            const HASH = process.env.ADMIN_PASSWORD_HASH
                || '$2b$10$SzkjFVgLmN60pMEaukJXG.7kLjmoDRDYapAjrQ6BBQzb3Wtlabj3G';
            try {
                const result = await client.execute("SELECT id FROM admin_users WHERE id = 1");
                if (result.rows.length === 0) {
                    await client.execute("INSERT INTO admin_users (id, username, password_hash) VALUES (1, '西瓜Naive', ?)", [HASH]);
                } else {
                    await client.execute("UPDATE admin_users SET username = '西瓜Naive', password_hash = ? WHERE id = 1", [HASH]);
                }
            } catch (e: any) {
                console.error('[admin-seed]', e?.message || e);
            }
        }).catch(e => {
            console.error('[init]', e?.message || e);
        });
    }
    await initPromise;
    return client;
}

async function initSchema() {
    const schema = fs.readFileSync(
        path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8'
    );
    try {
        await client.executeMultiple(schema);
    } catch (e: any) {
        console.error('[initSchema] executeMultiple error:', e?.message || e);
    }

    // Run migration for base64 columns (use execute, not executeMultiple, for ALTER TABLE on Turso)
    try {
        await client.execute(
            "ALTER TABLE snack_images ADD COLUMN data TEXT NOT NULL DEFAULT '';"
        );
    } catch (e: any) {
        // Ignore "duplicate column" errors; throw everything else
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
            console.error('Migration error (data column):', e);
        }
    }
    try {
        await client.execute(
            "ALTER TABLE snack_images ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'image/jpeg';"
        );
    } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
            console.error('Migration error (mime_type column):', e);
        }
    }

    // --- Migration v2: new ratings, category, review_text, users, reviews, news ---
    try {
        const migrationV2 = fs.readFileSync(
            path.join(process.cwd(), 'database', 'migration_v2.sql'), 'utf-8'
        );
        const statements = migrationV2
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
            try {
                await client.execute(stmt + ';');
            } catch (e: any) {
                const msg = (e.message || '').toLowerCase();
                if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('has column')) {
                    continue;
                }
                console.error('Migration v2 error:', e.message, '| stmt:', stmt.substring(0, 80));
            }
        }
    } catch (e: any) {
        console.error('Migration v2 file error:', e);
    }

    // --- Migration v3: created_by, registration_ip, last_registration_at ---
    try {
        const migrationV3 = fs.readFileSync(
            path.join(process.cwd(), 'database', 'migration_v3.sql'), 'utf-8'
        );
        const statements = migrationV3
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
            try {
                await client.execute(stmt + ';');
            } catch (e: any) {
                const msg = (e.message || '').toLowerCase();
                if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('has column')) {
                    continue;
                }
                console.error('Migration v3 error:', e.message, '| stmt:', stmt.substring(0, 80));
            }
        }
    } catch (e: any) {
        console.error('Migration v3 file error:', e);
    }

    // --- Migration v4: update admin username to 西瓜Naive ---
    try {
        await client.execute("UPDATE admin_users SET username = '西瓜Naive' WHERE username = 'admin'");
    } catch (e: any) {
        console.error('Migration v4 error:', e);
    }
    try {
        await client.execute("UPDATE snacks SET created_by = '西瓜Naive' WHERE created_by = 'admin' OR created_by = ''");
    } catch (e: any) {
        console.error('Migration v4 error:', e);
    }

    // --- Migration v5: soft-delete column for recycle bin ---
    try {
        await client.execute("ALTER TABLE snacks ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
    } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
            console.error('Migration v5 error:', e);
        }
    }

    // --- Migration v6: soft-delete column for news recycle bin ---
    try {
        await client.execute("ALTER TABLE news ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
    } catch (e: any) {
        if (!e.message?.includes('duplicate column') && !e.message?.includes('already exists')) {
            console.error('Migration v6 error:', e);
        }
    }
}

// --- Snack queries ---

export async function getAllSnacks(includeDeleted = false): Promise<Snack[]> {
    const cacheKey = includeDeleted ? 'snacks_all_deleted' : 'snacks_all';
    const cached = getCached<Snack[]>(cacheKey, 10_000); // 10s TTL
    if (cached) return cached;

    const db = await getDb();
    const sql = includeDeleted
        ? 'SELECT * FROM snacks ORDER BY created_at DESC'
        : 'SELECT * FROM snacks WHERE deleted = 0 ORDER BY created_at DESC';
    const result = await db.execute(sql);
    const snacks = result.rows.map(rowToSnack);
    if (snacks.length === 0) return snacks;
    // Fetch all images in one query instead of N+1
    const allImages = await db.execute(
        'SELECT * FROM snack_images ORDER BY sort_order ASC'
    );
    const imagesBySnack = new Map<number, any[]>();
    for (const row of allImages.rows) {
        const sid = row.snack_id as number;
        if (!imagesBySnack.has(sid)) imagesBySnack.set(sid, []);
        imagesBySnack.get(sid)!.push(rowToImage(row));
    }
    for (const snack of snacks) {
        snack.images = imagesBySnack.get(snack.id) || [];
    }
    // Attach review counts in one grouped query
    try {
        const counts = await db.execute(
            'SELECT snack_id, COUNT(*) AS cnt FROM reviews GROUP BY snack_id'
        );
        const countBySnack = new Map<number, number>();
        for (const row of counts.rows) {
            countBySnack.set(row.snack_id as number, Number(row.cnt));
        }
        for (const snack of snacks) {
            snack.review_count = countBySnack.get(snack.id) || 0;
        }
    } catch (e: any) {
        console.error('[review-count]', e?.message || e);
    }
    setCache(cacheKey, snacks, 10_000);
    return snacks;
}

export async function getSnackById(id: number): Promise<Snack | undefined> {
    const db = await getDb();
    const [snackResult, imgResult] = await Promise.all([
        db.execute('SELECT * FROM snacks WHERE id = ?', [id]),
        db.execute('SELECT * FROM snack_images WHERE snack_id = ? ORDER BY sort_order ASC', [id]),
    ]);
    if (snackResult.rows.length === 0) return undefined;
    const snack = rowToSnack(snackResult.rows[0]);
    snack.images = imgResult.rows.map(rowToImage);
    return snack;
}

export async function checkSnackDuplicate(brandName: string, productName: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute(
        'SELECT id FROM snacks WHERE brand_name = ? AND product_name = ? LIMIT 1',
        [brandName, productName]
    );
    return result.rows.length > 0;
}

export async function createSnack(input: CreateSnackInput, createdBy: string = ''): Promise<Snack> {
    const db = await getDb();
    const result = await db.execute(
        `INSERT INTO snacks (
            brand_name, product_name, manufacturer_name, manufacturer_address,
            brand_company, ingredients, category, review_text,
            rating_taste_health, rating_ingredients_health,
            rating_packaging_portability, rating_use_case, rating_value,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            input.brand_name, input.product_name,
            input.manufacturer_name, input.manufacturer_address,
            input.brand_company, input.ingredients,
            input.category, input.review_text,
            input.rating_taste_health, input.rating_ingredients_health,
            input.rating_packaging_portability, input.rating_use_case, input.rating_value,
            createdBy,
        ]
    );
    const id = Number(result.lastInsertRowid);
    if (input.image_ids.length > 0) {
        await linkImagesToSnack(id, input.image_ids);
    }
    invalidateCache();
    return (await getSnackById(id))!;
}

function invalidateCache() {
    cache.delete('snacks_all');
    cache.delete('snacks_all_deleted');
}

export async function updateSnack(id: number, input: CreateSnackInput): Promise<Snack | undefined> {
    const db = await getDb();
    await db.execute(
        `UPDATE snacks SET
            brand_name = ?, product_name = ?, manufacturer_name = ?,
            manufacturer_address = ?, brand_company = ?, ingredients = ?,
            category = ?, review_text = ?,
            rating_taste_health = ?, rating_ingredients_health = ?,
            rating_packaging_portability = ?, rating_use_case = ?, rating_value = ?,
            updated_at = datetime('now')
        WHERE id = ?`,
        [
            input.brand_name, input.product_name,
            input.manufacturer_name, input.manufacturer_address,
            input.brand_company, input.ingredients,
            input.category, input.review_text,
            input.rating_taste_health, input.rating_ingredients_health,
            input.rating_packaging_portability, input.rating_use_case, input.rating_value,
            id,
        ]
    );
    if (input.image_ids.length > 0) {
        await linkImagesToSnack(id, input.image_ids);
    }
    invalidateCache();
    return getSnackById(id);
}

export async function deleteSnack(id: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute('UPDATE snacks SET deleted = 1 WHERE id = ?', [id]);
    if (result.rowsAffected > 0) invalidateCache();
    return result.rowsAffected > 0;
}

export async function restoreSnack(id: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute('UPDATE snacks SET deleted = 0 WHERE id = ?', [id]);
    if (result.rowsAffected > 0) invalidateCache();
    return result.rowsAffected > 0;
}

export async function getDeletedSnacks(): Promise<Snack[]> {
    return getAllSnacks(true).then(all => all.filter(s => (s as any).deleted === 1));
}

// --- Image queries ---

export async function createImage(
    originalName: string, base64Data: string, mimeType: string
): Promise<SnackImage> {
    const db = await getDb();
    const result = await db.execute(
        'INSERT INTO snack_images (snack_id, filename, original_name, data, mime_type) VALUES (NULL, ?, ?, ?, ?)',
        [originalName, originalName, base64Data, mimeType]
    );
    const imgResult = await db.execute(
        'SELECT * FROM snack_images WHERE id = ?', [Number(result.lastInsertRowid)]
    );
    return rowToImage(imgResult.rows[0]);
}

export async function linkImagesToSnack(snackId: number, imageIds: number[]): Promise<void> {
    const db = await getDb();
    for (const imageId of imageIds) {
        await db.execute('UPDATE snack_images SET snack_id = ? WHERE id = ?', [snackId, imageId]);
    }
}

export async function getImageById(id: number): Promise<SnackImage | undefined> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM snack_images WHERE id = ?', [id]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
        id: row.id as number,
        filename: row.filename as string,
        original_name: row.original_name as string,
        data: row.data as string,
        mime_type: row.mime_type as string,
        sort_order: row.sort_order as number,
    };
}

// --- Auth queries ---

export async function getUserByUsername(username: string) {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
        id: row.id as number,
        username: row.username as string,
        password_hash: row.password_hash as string,
    };
}

// --- News queries ---

export async function getAllNews(): Promise<import('@/types').NewsItem[]> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM news WHERE deleted = 0 ORDER BY created_at DESC');
    return result.rows.map(rowToNews);
}

export async function getDeletedNews(): Promise<import('@/types').NewsItem[]> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM news WHERE deleted = 1 ORDER BY created_at DESC');
    return result.rows.map(rowToNews);
}

export async function getNewsById(id: number): Promise<import('@/types').NewsItem | undefined> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM news WHERE id = ?', [id]);
    if (result.rows.length === 0) return undefined;
    return rowToNews(result.rows[0]);
}

export async function createNews(title: string, content: string, sourceUrl: string): Promise<import('@/types').NewsItem> {
    const db = await getDb();
    const result = await db.execute(
        'INSERT INTO news (title, content, source_url) VALUES (?, ?, ?)',
        [title, content, sourceUrl]
    );
    return (await getNewsById(Number(result.lastInsertRowid)))!;
}

export async function deleteNews(id: number): Promise<boolean> {
    // Soft delete — moves the item to the recycle bin instead of erasing it
    const db = await getDb();
    const result = await db.execute('UPDATE news SET deleted = 1 WHERE id = ?', [id]);
    return result.rowsAffected > 0;
}

export async function restoreNews(id: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute('UPDATE news SET deleted = 0 WHERE id = ?', [id]);
    return result.rowsAffected > 0;
}

function rowToNews(row: any): import('@/types').NewsItem {
    return {
        id: row.id as number,
        title: row.title as string,
        content: row.content as string,
        source_url: row.source_url as string,
        created_at: row.created_at as string,
    };
}

// --- User queries ---

export async function createUser(email: string, username: string, passwordHash: string, registrationIp: string = '') {
    const db = await getDb();
    const result = await db.execute(
        'INSERT INTO users (email, username, password_hash, registration_ip, last_registration_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
        [email, username, passwordHash, registrationIp]
    );
    return Number(result.lastInsertRowid);
}

export async function canRegisterFromIp(ip: string): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute(
        `SELECT id FROM users
         WHERE registration_ip = ?
         AND last_registration_at > datetime('now', '-1 day')
         LIMIT 1`,
        [ip]
    );
    return result.rows.length === 0;
}

export async function getSnacksByCreator(username: string): Promise<Snack[]> {
    const db = await getDb();
    const result = await db.execute(
        'SELECT * FROM snacks WHERE created_by = ? ORDER BY created_at DESC',
        [username]
    );
    const snacks = result.rows.map(rowToSnack);
    for (const snack of snacks) {
        const imgResult = await db.execute(
            'SELECT * FROM snack_images WHERE snack_id = ? ORDER BY sort_order ASC',
            [snack.id]
        );
        snack.images = imgResult.rows.map(rowToImage);
    }
    return snacks;
}

export async function countUserSnacksToday(username: string): Promise<number> {
    const db = await getDb();
    const result = await db.execute(
        `SELECT COUNT(*) as count FROM snacks
         WHERE created_by = ?
         AND created_at > datetime('now', '-1 day')`,
        [username]
    );
    return Number(result.rows[0].count);
}

export async function getUserById(id: number) {
    const db = await getDb();
    const result = await db.execute('SELECT id, email, username FROM users WHERE id = ?', [id]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
        id: row.id as number,
        email: row.email as string,
        username: row.username as string,
    };
}

export async function getUserByEmail(email: string) {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
        id: row.id as number,
        email: row.email as string,
        username: row.username as string,
        password_hash: row.password_hash as string,
        created_at: row.created_at as string,
    };
}

// --- Review queries ---

export async function createReview(
    userId: number, snackId: number,
    ratings: { taste: number; ingredients: number; packaging: number; useCase: number; value: number },
    reviewText: string
): Promise<import('@/types').Review> {
    const db = await getDb();
    const result = await db.execute(
        `INSERT INTO reviews (user_id, snack_id, rating_taste_health, rating_ingredients_health,
         rating_packaging_portability, rating_use_case, rating_value, review_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, snackId, ratings.taste, ratings.ingredients, ratings.packaging, ratings.useCase, ratings.value, reviewText]
    );
    invalidateCache();
    const rows = await db.execute('SELECT * FROM reviews WHERE id = ?', [Number(result.lastInsertRowid)]);
    return rowToReview(rows.rows[0]);
}

export async function getReviewsBySnackId(snackId: number): Promise<import('@/types').Review[]> {
    const db = await getDb();
    const result = await db.execute(
        'SELECT * FROM reviews WHERE snack_id = ? ORDER BY created_at ASC',
        [snackId]
    );
    return result.rows.map(rowToReview);
}

export async function deleteReview(reviewId: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
    if (result.rowsAffected > 0) invalidateCache();
    return result.rowsAffected > 0;
}

function rowToReview(row: any): import('@/types').Review {
    return {
        id: row.id as number,
        user_id: row.user_id as number,
        snack_id: row.snack_id as number,
        rating_taste_health: row.rating_taste_health as number,
        rating_ingredients_health: row.rating_ingredients_health as number,
        rating_packaging_portability: row.rating_packaging_portability as number,
        rating_use_case: row.rating_use_case as number,
        rating_value: row.rating_value as number,
        review_text: row.review_text as string,
        created_at: row.created_at as string,
    };
}

// --- Helpers ---

function rowToSnack(row: any): Snack {
    return {
        id: row.id,
        brand_name: row.brand_name || '',
        product_name: row.product_name || '',
        manufacturer_name: row.manufacturer_name || '',
        manufacturer_address: row.manufacturer_address || '',
        brand_company: row.brand_company || '',
        ingredients: row.ingredients || '',
        category: row.category || '膨化食品',
        review_text: row.review_text || '',
        rating_taste_health: row.rating_taste_health ?? 5,
        rating_ingredients_health: row.rating_ingredients_health ?? 5,
        rating_packaging_portability: row.rating_packaging_portability ?? 5,
        rating_use_case: row.rating_use_case ?? 5,
        rating_value: row.rating_value ?? 5,
        created_by: row.created_by || '',
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        images: [],
    };
}

function rowToImage(row: any): SnackImage {
    return {
        id: row.id,
        filename: row.filename as string,
        original_name: row.original_name as string,
        data: '', // stripped — use /api/images/[id] to fetch
        mime_type: row.mime_type as string,
        sort_order: row.sort_order as number,
    };
}
