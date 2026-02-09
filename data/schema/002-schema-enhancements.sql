-- TripAgent Schema Enhancement Migration
-- Adds metadata columns for trails, campgrounds, and parks
-- Safe to run multiple times (all statements use IF NOT EXISTS or conditional ADD COLUMN)

-- ============================================
-- TRAILS TABLE ENHANCEMENTS
-- ============================================

-- Elevation gain in feet (key hiking filter)
ALTER TABLE trails ADD COLUMN IF NOT EXISTS elevation_gain_ft DOUBLE PRECISION;

-- Estimated duration in minutes
ALTER TABLE trails ADD COLUMN IF NOT EXISTS estimated_minutes INT;

-- Surface type: paved, gravel, dirt, rock, mixed
ALTER TABLE trails ADD COLUMN IF NOT EXISTS surface_type TEXT;

-- Pet-friendly flag
ALTER TABLE trails ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN;

-- Seasonal access: year-round, seasonal, winter-only, summer-only
ALTER TABLE trails ADD COLUMN IF NOT EXISTS seasonal_access TEXT;

-- User rating (1.0 - 5.0 scale)
ALTER TABLE trails ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;

-- Number of reviews (for weighting ratings)
ALTER TABLE trails ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- Trail photo URL
ALTER TABLE trails ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Whether trailhead has parking
ALTER TABLE trails ADD COLUMN IF NOT EXISTS trailhead_parking BOOLEAN;

-- Original ID from the source system (USFS trail number, OSM node ID, etc.)
ALTER TABLE trails ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Raw API URL that produced this record (for debugging/re-sync)
ALTER TABLE trails ADD COLUMN IF NOT EXISTS source_url TEXT;

-- When we last verified this record still exists upstream
ALTER TABLE trails ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;

-- Constrain difficulty to known values (skip if constraint exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trails_difficulty_check'
  ) THEN
    -- First normalize any non-standard values
    UPDATE trails SET difficulty = 'easy' WHERE difficulty NOT IN ('easy', 'moderate', 'hard', 'expert') AND difficulty IS NOT NULL AND lower(difficulty) IN ('easy', 'beginner', 'easiest');
    UPDATE trails SET difficulty = 'moderate' WHERE difficulty NOT IN ('easy', 'moderate', 'hard', 'expert') AND difficulty IS NOT NULL AND lower(difficulty) IN ('moderate', 'intermediate', 'medium');
    UPDATE trails SET difficulty = 'hard' WHERE difficulty NOT IN ('easy', 'moderate', 'hard', 'expert') AND difficulty IS NOT NULL AND lower(difficulty) IN ('hard', 'difficult', 'strenuous', 'challenging');
    UPDATE trails SET difficulty = 'expert' WHERE difficulty NOT IN ('easy', 'moderate', 'hard', 'expert') AND difficulty IS NOT NULL AND lower(difficulty) IN ('expert', 'extreme', 'very difficult');
    -- Null out anything that still doesn't match
    UPDATE trails SET difficulty = NULL WHERE difficulty NOT IN ('easy', 'moderate', 'hard', 'expert') AND difficulty IS NOT NULL;
    -- Add the constraint
    ALTER TABLE trails ADD CONSTRAINT trails_difficulty_check CHECK (difficulty IN ('easy', 'moderate', 'hard', 'expert'));
  END IF;
END $$;

-- ============================================
-- CAMPGROUNDS TABLE ENHANCEMENTS
-- ============================================

-- Amenities array: showers, water, electric, flush_toilets, dump_station, wifi, store, laundry
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS amenities TEXT[];

-- Site types array: tent, rv, cabin, yurt, group, equestrian
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS site_types TEXT[];

-- Price range per night
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS price_per_night_min DOUBLE PRECISION;
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS price_per_night_max DOUBLE PRECISION;

-- Open season description: year-round, May-October, etc.
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS open_season TEXT;

-- Contact phone
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS phone TEXT;

-- User rating (1.0 - 5.0 scale)
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;

-- Number of reviews
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- Pet-friendly flag
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN;

-- Link campgrounds to a park (optional, not all campgrounds are in a park)
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS park_id TEXT;

-- Original ID from the source system
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS source_id TEXT;

-- When we last verified this record
ALTER TABLE campgrounds ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;

-- ============================================
-- PARKS TABLE ENHANCEMENTS
-- ============================================

-- Geographic region: Pacific Northwest, Appalachia, Southwest, etc.
ALTER TABLE parks ADD COLUMN IF NOT EXISTS region TEXT;

-- Annual visitor count (NPS publishes this)
ALTER TABLE parks ADD COLUMN IF NOT EXISTS annual_visitors INT;

-- Park base elevation in feet
ALTER TABLE parks ADD COLUMN IF NOT EXISTS elevation_ft DOUBLE PRECISION;

-- ============================================
-- NEW INDEXES
-- ============================================

-- Composite: state + difficulty (map filter combo)
CREATE INDEX IF NOT EXISTS idx_trails_state_difficulty ON trails(state_code, difficulty);

-- Partial index for spatial bbox queries (only rows with coordinates)
CREATE INDEX IF NOT EXISTS idx_trails_bbox_partial ON trails(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Rating index for sorting trails by quality
CREATE INDEX IF NOT EXISTS idx_trails_rating ON trails(rating DESC NULLS LAST) WHERE rating IS NOT NULL;

-- Campground state code + park_id for joins
CREATE INDEX IF NOT EXISTS idx_campgrounds_park_id ON campgrounds(park_id);

-- Campground rating
CREATE INDEX IF NOT EXISTS idx_campgrounds_rating ON campgrounds(rating DESC NULLS LAST) WHERE rating IS NOT NULL;

-- Park annual visitors for popularity sorting
CREATE INDEX IF NOT EXISTS idx_parks_annual_visitors ON parks(annual_visitors DESC NULLS LAST) WHERE annual_visitors IS NOT NULL;

-- Park region for filtering
CREATE INDEX IF NOT EXISTS idx_parks_region ON parks(region);
