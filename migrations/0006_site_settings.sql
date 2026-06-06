-- Migration: Create site_settings table
-- Description: Generic key-value store for admin-editable site configuration.
--              First use: hero.featured_video_id (which YouTube video shows as
--              the large main thumbnail in the home hero section).

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
