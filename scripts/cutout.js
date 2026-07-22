// Batch background removal for snack images.
// Usage:
//   node scripts/cutout.js          -> local sqlite database
//   node scripts/cutout.js --prod   -> live Turso database (creds read from
//                                      the commented lines in .env.local)
// Requires (installed with --no-save, local machine only):
//   @imgly/background-removal-node  sharp

const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const MAX_SIZE = 500; // cutouts are used as small falling sprites — keep them light

function readEnv() {
    const env = {};
    const file = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(file)) return env;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        // Accept both active and commented-out entries (#KEY=VALUE)
        const m = line.match(/^\s*#?\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return env;
}

async function main() {
    const { removeBackground } = require('@imgly/background-removal-node');
    const sharp = require('sharp');
    const { createClient } = require('@libsql/client');

    let db;
    if (PROD) {
        const env = readEnv();
        if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
            console.log('[ERROR] TURSO creds not found in .env.local');
            process.exit(1);
        }
        db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
        console.log('Target: LIVE Turso database');
    } else {
        db = createClient({ url: 'file:' + path.join(__dirname, '..', 'database', 'snacks.db').replace(/\\/g, '/') });
        console.log('Target: local sqlite database');
    }

    // Make sure the column exists (same as migration v7)
    try {
        await db.execute("ALTER TABLE snack_images ADD COLUMN cutout TEXT NOT NULL DEFAULT ''");
        console.log('Added cutout column');
    } catch (e) {
        if (!/duplicate column|already exists/i.test(e.message || '')) throw e;
    }

    // Fetch ids only first — pulling every image blob in one query can
    // exceed what the remote HTTP connection tolerates ("terminated").
    // snack_id IS NOT NULL skips orphaned/corrupt rows not attached to any
    // snack (they can't be decoded and only produce noise every run).
    const ids = (await db.execute(
        "SELECT id FROM snack_images WHERE (cutout IS NULL OR cutout = '') AND data != '' AND snack_id IS NOT NULL"
    )).rows.map((r) => r.id);
    console.log(`Images to process: ${ids.length}`);

    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            const row = (await db.execute('SELECT data FROM snack_images WHERE id = ?', [id])).rows[0];
            if (!row || !row.data) { throw new Error('image row disappeared'); }
            // 1. decode (webp/jpeg/png all supported) + downscale, output PNG
            const src = Buffer.from(String(row.data), 'base64');
            const pngBuf = await sharp(src)
                .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer();

            // 2. AI background removal
            const blob = new Blob([pngBuf], { type: 'image/png' });
            const outBlob = await removeBackground(blob, { output: { format: 'image/png' } });
            const outBuf = Buffer.from(await outBlob.arrayBuffer());

            // 3. store
            await db.execute('UPDATE snack_images SET cutout = ? WHERE id = ?', [outBuf.toString('base64'), id]);
            ok++;
            console.log(`  #${id} done (${Math.round(outBuf.length / 1024)} KB)`);
        } catch (e) {
            fail++;
            console.log(`  #${id} FAILED: ${e.message}`);
        }
    }
    console.log(`\nFinished: ${ok} ok, ${fail} failed.`);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
