import { createClient } from '@libsql/client';
import { del } from '@vercel/blob';
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
    await client.execute(
        "INSERT OR IGNORE INTO admin_users (id, username, password_hash) VALUES (1, 'admin', ?)",
        [require('bcryptjs').hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)]
    );
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
            manufacturer_contact, ingredients,
            rating_packaging_quality, rating_packaging_design,
            rating_appearance, rating_smell, rating_taste,
            rating_satiety, rating_nutrition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            input.brand_name, input.product_name,
            input.manufacturer_name, input.manufacturer_address,
            input.manufacturer_contact, input.ingredients,
            input.rating_packaging_quality, input.rating_packaging_design,
            input.rating_appearance, input.rating_smell, input.rating_taste,
            input.rating_satiety, input.rating_nutrition,
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
            manufacturer_address = ?, manufacturer_contact = ?, ingredients = ?,
            rating_packaging_quality = ?, rating_packaging_design = ?,
            rating_appearance = ?, rating_smell = ?, rating_taste = ?,
            rating_satiety = ?, rating_nutrition = ?,
            updated_at = datetime('now')
        WHERE id = ?`,
        [
            input.brand_name, input.product_name,
            input.manufacturer_name, input.manufacturer_address,
            input.manufacturer_contact, input.ingredients,
            input.rating_packaging_quality, input.rating_packaging_design,
            input.rating_appearance, input.rating_smell, input.rating_taste,
            input.rating_satiety, input.rating_nutrition,
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
    const imgResult = await db.execute('SELECT filename FROM snack_images WHERE snack_id = ?', [id]);
    for (const row of imgResult.rows) {
        const fname = row.filename as string;
        if (fname.startsWith('http')) {
            // Vercel Blob URL
            try { await del(fname); } catch { /* ignore */ }
        } else {
            // Local filesystem path
            const filePath = path.join(process.cwd(), 'public', fname);
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
    }
    const result = await db.execute('DELETE FROM snacks WHERE id = ?', [id]);
    return result.rowsAffected > 0;
}

// --- Image queries ---

export async function createImage(url: string, originalName: string): Promise<SnackImage> {
    const db = await getDb();
    const result = await db.execute(
        'INSERT INTO snack_images (snack_id, filename, original_name) VALUES (NULL, ?, ?)',
        [url, originalName]
    );
    const imgResult = await db.execute('SELECT * FROM snack_images WHERE id = ?', [Number(result.lastInsertRowid)]);
    return rowToImage(imgResult.rows[0]);
}

export async function linkImagesToSnack(snackId: number, imageIds: number[]): Promise<void> {
    const db = await getDb();
    for (const imageId of imageIds) {
        await db.execute('UPDATE snack_images SET snack_id = ? WHERE id = ?', [snackId, imageId]);
    }
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

// --- Helpers ---

function rowToSnack(row: any): Snack {
    return {
        id: row.id,
        brand_name: row.brand_name || '',
        product_name: row.product_name || '',
        manufacturer_name: row.manufacturer_name || '',
        manufacturer_address: row.manufacturer_address || '',
        manufacturer_contact: row.manufacturer_contact || '',
        ingredients: row.ingredients || '',
        rating_packaging_quality: row.rating_packaging_quality,
        rating_packaging_design: row.rating_packaging_design,
        rating_appearance: row.rating_appearance,
        rating_smell: row.rating_smell,
        rating_taste: row.rating_taste,
        rating_satiety: row.rating_satiety,
        rating_nutrition: row.rating_nutrition,
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
        sort_order: row.sort_order as number,
    };
}
