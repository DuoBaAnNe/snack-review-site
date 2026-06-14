import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import type { Snack, SnackImage, CreateSnackInput } from '@/types';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

let client: ReturnType<typeof createClient>;
let initPromise: Promise<void> | null = null;

async function getDb() {
    if (!client) {
        if (TURSO_URL) {
            client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
        } else {
            client = createClient({ url: 'file:./database/snacks.db' });
        }
        if (client instanceof Promise) {
            client = await client;
        }
        initPromise = initSchema();
    }
    if (initPromise) {
        await initPromise;
        initPromise = null;
    }
    return client;
}

async function initSchema() {
    const schema = fs.readFileSync(
        path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8'
    );
    await client.executeMultiple(schema);

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

    await client.execute(
        "INSERT OR IGNORE INTO admin_users (id, username, password_hash) VALUES (1, 'admin', ?)",
        [require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)]
    );

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
                    // Column/table already exists — safe to ignore
                    continue;
                }
                console.error('Migration v2 error:', e.message, '| stmt:', stmt.substring(0, 80));
            }
        }
    } catch (e: any) {
        console.error('Migration v2 file error:', e);
    }
}

// --- Snack queries ---

export async function getAllSnacks(): Promise<Snack[]> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM snacks ORDER BY created_at DESC');
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

export async function getSnackById(id: number): Promise<Snack | undefined> {
    const db = await getDb();
    const result = await db.execute('SELECT * FROM snacks WHERE id = ?', [id]);
    if (result.rows.length === 0) return undefined;
    const snack = rowToSnack(result.rows[0]);
    const imgResult = await db.execute(
        'SELECT * FROM snack_images WHERE snack_id = ? ORDER BY sort_order ASC',
        [id]
    );
    snack.images = imgResult.rows.map(rowToImage);
    return snack;
}

export async function createSnack(input: CreateSnackInput): Promise<Snack> {
    const db = await getDb();
    const result = await db.execute(
        `INSERT INTO snacks (
            brand_name, product_name, manufacturer_name, manufacturer_address,
            brand_company, ingredients, category, review_text,
            rating_taste_health, rating_ingredients_health,
            rating_packaging_portability, rating_use_case, rating_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            input.brand_name, input.product_name,
            input.manufacturer_name, input.manufacturer_address,
            input.brand_company, input.ingredients,
            input.category, input.review_text,
            input.rating_taste_health, input.rating_ingredients_health,
            input.rating_packaging_portability, input.rating_use_case, input.rating_value,
        ]
    );
    const id = Number(result.lastInsertRowid);
    if (input.image_ids.length > 0) {
        await linkImagesToSnack(id, input.image_ids);
    }
    return (await getSnackById(id))!;
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
    return getSnackById(id);
}

export async function deleteSnack(id: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute('DELETE FROM snacks WHERE id = ?', [id]);
    return result.rowsAffected > 0;
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
    const result = await db.execute('SELECT * FROM news ORDER BY created_at DESC');
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
    const db = await getDb();
    const result = await db.execute('DELETE FROM news WHERE id = ?', [id]);
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

export async function createUser(email: string, username: string, passwordHash: string) {
    const db = await getDb();
    const result = await db.execute(
        'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)',
        [email, username, passwordHash]
    );
    return Number(result.lastInsertRowid);
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
