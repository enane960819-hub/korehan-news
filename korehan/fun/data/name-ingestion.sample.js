/**
 * Offline-only helper sample.
 *
 * Purpose: convert crawled/scraped raw names into the runtime dataset format.
 * This file is intentionally NOT used by the live app.
 *
 * Target format:
 * { hangul, romanization, gender, meaning, tags: [], popularity }
 */
function normalizeRawName(raw) {
  return {
    hangul: String(raw.hangul || '').trim(),
    romanization: String(raw.romanization || '').trim(),
    gender: String(raw.gender || 'unisex').toLowerCase(),
    meaning: String(raw.meaning || '').trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map(function(t){ return String(t).trim().toLowerCase(); }).filter(Boolean) : [],
    popularity: Number(raw.popularity || 50)
  };
}
