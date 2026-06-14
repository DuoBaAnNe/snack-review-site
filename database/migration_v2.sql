-- Migration v2: new rating dimensions, category, review_text, users, reviews, news
-- Each statement is designed to be safely re-runnable (ignored if already applied)

-- Add brand_company column (replaces manufacturer_contact)
ALTER TABLE snacks ADD COLUMN brand_company TEXT NOT NULL DEFAULT '';

-- Add category column
ALTER TABLE snacks ADD COLUMN category TEXT NOT NULL DEFAULT '膨化食品';

-- Add review_text column
ALTER TABLE snacks ADD COLUMN review_text TEXT NOT NULL DEFAULT '';

-- Add new 5 rating columns (replacing old 7)
ALTER TABLE snacks ADD COLUMN rating_taste_health INTEGER DEFAULT 5;
ALTER TABLE snacks ADD COLUMN rating_ingredients_health INTEGER DEFAULT 5;
ALTER TABLE snacks ADD COLUMN rating_packaging_portability INTEGER DEFAULT 5;
ALTER TABLE snacks ADD COLUMN rating_use_case INTEGER DEFAULT 5;
ALTER TABLE snacks ADD COLUMN rating_value INTEGER DEFAULT 5;

-- Users table (for future registration)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reviews table (many users can review same snack)
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snack_id INTEGER NOT NULL REFERENCES snacks(id) ON DELETE CASCADE,
    rating_taste_health INTEGER DEFAULT 5 CHECK(rating_taste_health >= 1 AND rating_taste_health <= 10),
    rating_ingredients_health INTEGER DEFAULT 5 CHECK(rating_ingredients_health >= 1 AND rating_ingredients_health <= 10),
    rating_packaging_portability INTEGER DEFAULT 5 CHECK(rating_packaging_portability >= 1 AND rating_packaging_portability <= 10),
    rating_use_case INTEGER DEFAULT 5 CHECK(rating_use_case >= 1 AND rating_use_case <= 10),
    rating_value INTEGER DEFAULT 5 CHECK(rating_value >= 1 AND rating_value <= 10),
    review_text TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- News table
CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
