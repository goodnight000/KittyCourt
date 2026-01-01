-- Track last acknowledged level-ups per user to replay animations on return
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_level INTEGER;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_level_partner_id UUID REFERENCES profiles(id);
