/* ============================================================
   KoreHani — localStorage helpers
   Extracted from korehan-shared.js (was lines 2029-2034).
   Pure functions; no external dependencies.
   ============================================================ */

function lsGet(key, def) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
