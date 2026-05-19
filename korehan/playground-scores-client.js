// Playground scores client — thin wrapper around log_playground_score +
// get_playground_leaderboard RPCs. Every playground game includes this
// file and calls `window.playgroundScores.submit(slug, score, meta)` on
// game-over. Best-only persistence; localStorage best scores stay as a
// signed-out fallback (and as a snappy first paint on returning visits
// before the server response arrives).
//
// Usage:
//   <script src="playground-scores-client.js?v=YYYYMMDDx"></script>
//   ...
//   playgroundScores.submit('worddrop', 230, { mode: 'ko2en' });
//   var best = await playgroundScores.getBest('worddrop');
//   var top  = await playgroundScores.getTop('worddrop', 5);

(function(){
  function _sb() {
    return (typeof getSupa === 'function') ? getSupa() : null;
  }

  // Whitelist of game slugs we know about. Anything outside this list
  // is rejected client-side so a stray call from another page doesn't
  // pollute the table.
  var KNOWN = {
    'worddrop':1, 'chosung':1, 'memory':1, 'hangul-tetris':1, 'ox':1,
    'worldcup':1, 'sentence-order':1, 'dictation-mini':1
  };

  window.playgroundScores = {
    KNOWN_GAMES: Object.keys(KNOWN),

    // Submit a final score. Returns {ok, best, new_best} or null if the
    // user is signed out / RPC errored. Non-fatal — caller can show the
    // localStorage best in either case.
    submit: async function(slug, score, meta) {
      if (!KNOWN[slug]) { console.warn('[playground] unknown slug', slug); return null; }
      if (!window.supaUser) return null;
      var sb = _sb(); if (!sb) return null;
      var s = Math.max(0, Math.floor(Number(score) || 0));
      try {
        var r = await sb.rpc('log_playground_score', {
          p_game_slug: slug,
          p_score:     s,
          p_meta:      meta || {}
        });
        if (r.error) return null;
        return r.data || null;
      } catch (_) {
        return null;
      }
    },

    // Read the user's personal best for one game. 0 if signed out or
    // never played.
    getBest: async function(slug) {
      if (!KNOWN[slug]) return 0;
      if (!window.supaUser) return 0;
      var sb = _sb(); if (!sb) return 0;
      try {
        var r = await sb.from('playground_scores')
          .select('best_score')
          .eq('user_id', window.supaUser.id)
          .eq('game_slug', slug)
          .maybeSingle();
        return (r && r.data && r.data.best_score) || 0;
      } catch (_) { return 0; }
    },

    // Read the top N rows. Returns [] on any failure so the caller can
    // render an empty leaderboard without try/catch.
    getTop: async function(slug, n) {
      if (!KNOWN[slug]) return [];
      var sb = _sb(); if (!sb) return [];
      try {
        var r = await sb.rpc('get_playground_leaderboard', {
          p_game_slug: slug,
          p_limit:     Math.max(1, Math.min(Number(n) || 10, 100))
        });
        if (r.error) return [];
        return r.data || [];
      } catch (_) { return []; }
    }
  };
})();
