-- Run in Supabase Dashboard → SQL Editor
-- Adds avatar_config JSONB column to players table

ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_config JSONB;

-- Example valid value:
-- { "shape": "spray-can", "color": "#FF2D78", "accessory": "cap" }
