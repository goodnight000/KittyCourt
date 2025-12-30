-- Migration: Add description and source_url to documents table
-- Run this to update existing databases

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS source_url VARCHAR(512) DEFAULT 'No';

-- Update existing documents to have 'No' as source_url if NULL
UPDATE documents 
SET source_url = 'No' 
WHERE source_url IS NULL;

