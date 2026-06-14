CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT 'Untitled Snack',
    manufacturer_name TEXT DEFAULT '',
    manufacturer_address TEXT DEFAULT '',
    brand_company TEXT DEFAULT '',
    ingredients TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT '膨化食品',
    review_text TEXT NOT NULL DEFAULT '',

    rating_taste_health INTEGER DEFAULT 5
        CHECK(rating_taste_health >= 1 AND rating_taste_health <= 10),
    rating_ingredients_health INTEGER DEFAULT 5
        CHECK(rating_ingredients_health >= 1 AND rating_ingredients_health <= 10),
    rating_packaging_portability INTEGER DEFAULT 5
        CHECK(rating_packaging_portability >= 1 AND rating_packaging_portability <= 10),
    rating_use_case INTEGER DEFAULT 5
        CHECK(rating_use_case >= 1 AND rating_use_case <= 10),
    rating_value INTEGER DEFAULT 5
        CHECK(rating_value >= 1 AND rating_value <= 10),

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snack_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snack_id INTEGER REFERENCES snacks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snack_id INTEGER NOT NULL REFERENCES snacks(id) ON DELETE CASCADE,
    rating_taste_health INTEGER DEFAULT 5
        CHECK(rating_taste_health >= 1 AND rating_taste_health <= 10),
    rating_ingredients_health INTEGER DEFAULT 5
        CHECK(rating_ingredients_health >= 1 AND rating_ingredients_health <= 10),
    rating_packaging_portability INTEGER DEFAULT 5
        CHECK(rating_packaging_portability >= 1 AND rating_packaging_portability <= 10),
    rating_use_case INTEGER DEFAULT 5
        CHECK(rating_use_case >= 1 AND rating_use_case <= 10),
    rating_value INTEGER DEFAULT 5
        CHECK(rating_value >= 1 AND rating_value <= 10),
    review_text TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
