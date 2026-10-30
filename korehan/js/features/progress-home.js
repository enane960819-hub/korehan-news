// ═══════════════════════════════════════════════════════════════
// Progress page (Growth Lab, 2026-10 redesign — owner-approved mockup)
//
// One dark screen: chips (level · streak · XP) → This week → Your skills
// (this week vs last week) → Fix next → Writing feedback → Activity (active
// days per week, last 8 weeks) → Word Universe → Recent badges.
//
// Reuses the page's working pieces (This-week card, feedback list + modal,
// badges, Universe hero) by moving them into the new layout, and replaces
// the old loaders: loadHub() ran ~20 sequential queries (~15 s) to feed
// stat tiles / charts that no longer exist. Everything here is fetched in
// one parallel batch.
// ═══════════════════════════════════════════════════════════════
(function () {
  var LV_NAME = { Starter: 'Seed', Beginner: 'Sprout', Intermediate: 'Tree', Advanced: 'Forest' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kstDate(offsetDays) { return new Date(Date.now() + 9 * 3600000 + (offsetDays || 0) * 86400000).toISOString().slice(0, 10); }
  function addDays(dateStr, n) { return new Date(new Date(dateStr + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
  function mondayOf(dateStr) { var d = new Date(dateStr + 'T00:00:00Z'); return addDays(dateStr, -((d.getUTCDay() + 6) % 7)); }
  function safe(q) { return Promise.resolve(q).then(function (r) { return r; }, function () { return null; }); }

  // ── Layout ────────────────────────────────────────────────────
  function build() {
    var wrap = document.querySelector('.wrap');
    if (!wrap || document.getElementById('pg-root')) return;
    document.body.classList.add('pg-on');
    var root = document.createElement('div');
    root.id = 'pg-root';
    root.innerHTML =
      '<div class="pg-hd"><h1>Progress</h1><div class="pg-chips" id="pg-chips"></div></div>'
      + '<div class="pg-grid"><div class="pg-col" id="pg-col-a"></div><div class="pg-col" id="pg-col-b"></div></div>';
    wrap.insertBefore(root, wrap.firstChild);
    var a = document.getElementById('pg-col-a'), b = document.getElementById('pg-col-b');
    var card = function (id, title, right) {
      var el = document.createElement('section');
      el.className = 'pg-card'; el.id = id;
      el.innerHTML = '<div class="pg-h"><b>' + title + '</b><span>' + (right || '') + '</span></div><div class="pg-body"><div class="pg-skel"></div></div>';
      return el;
    };
    var week = document.getElementById('gl-week');
    var fb = (document.getElementById('fb-history-list-top') || {}).closest ? document.getElementById('fb-history-list-top').closest('section') : null;
    var badges = (document.getElementById('recent-badges-list') || {}).closest ? document.getElementById('recent-badges-list').closest('section') : null;
    var uni = document.getElementById('gl-universe-hero');
    if (week) { week.classList.add('pg-o1'); a.appendChild(week); }
    var fix = card('pg-fix', 'Fix next', 'from your mistakes · 4 weeks'); fix.classList.add('pg-o3'); a.appendChild(fix);
    if (fb) { fb.classList.add('pg-reuse', 'pg-o4'); a.appendChild(fb); }
    if (badges) { badges.classList.add('pg-reuse', 'pg-o7'); a.appendChild(badges); }
    var skills = card('pg-skills', 'Your skills', 'this week · <i class="pg-tick"></i> last week'); skills.classList.add('pg-o2'); b.appendChild(skills);
    var act = card('pg-act', 'Activity', 'active days / week'); act.classList.add('pg-o5'); b.appendChild(act);
    if (uni) { uni.classList.add('pg-o6'); b.appendChild(uni); }
  }

  // ── Data ──────────────────────────────────────────────────────
  async function load() {
    var sb = (typeof getSupa === 'function') ? getSupa() : null;
    var u = (typeof supaUser !== 'undefined') ? supaUser : null;
    if (!sb || !u) return;
    // The This-week card's own timer can fire before auth is ready.
    try { if (typeof window._glRenderWeek === 'function') window._glRenderWeek(); } catch (_) {}
    var today = kstDate(0), thisMon = mondayOf(today), lastMon = addDays(thisMon, -7);
    var since8 = addDays(thisMon, -49), since28 = kstDate(-28);
    var res = await Promise.all([
      safe(sb.from('user_stats').select('xp, streak').eq('user_id', u.id).maybeSingle()),
      safe(sb.from('daily_missions').select('date, articles, words, quizzes, fill').eq('user_id', u.id).gte('date', since8)),
      safe(sb.from('user_activity_log').select('study_date, activity_type').eq('user_id', u.id).gte('study_date', since8)),
      safe(sb.from('user_saved_words').select('srs_last_reviewed, srs_next_review, mastered').eq('user_id', u.id).limit(2000)),
      safe(sb.from('user_quiz_results').select('study_date, score, max_score, accuracy_pct, wrong_patterns').eq('user_id', u.id).gte('study_date', addDays(lastMon, -21))),
      safe(sb.from('user_submissions').select('study_date, submitted_at').eq('user_id', u.id).gte('submitted_at', lastMon + 'T00:00:00+09:00')),
      safe(sb.from('user_weekly_goals').select('goal_active_days').eq('user_id', u.id).eq('week_start', thisMon).maybeSingle()),
      safe((typeof getUnifiedWeakGrammarItems === 'function') ? getUnifiedWeakGrammarItems(1) : [])
    ]);
    var data = function (i) { return (res[i] && res[i].data) || []; };

    // Chips
    var stats = (res[0] && res[0].data) || {};
    var act = (typeof khActivityStreak === 'function') ? await khActivityStreak() : null;
    var streak = (typeof act === 'number') ? act : ((typeof khStreakNow === 'function') ? khStreakNow() : 0);
    var lvl = ''; try { lvl = localStorage.getItem('kh_level') || ''; } catch (_) {}
    var chips = document.getElementById('pg-chips');
    if (chips) chips.innerHTML = (LV_NAME[lvl] ? '<span class="pg-chip">' + LV_NAME[lvl] + '</span>' : '')
      + '<span class="pg-chip"><b class="pg-fire">' + streak + '</b>-day streak</span>'
      + '<span class="pg-chip"><b>' + (Number(stats.xp) || 0).toLocaleString() + '</b> XP total</span>';

    // Active days (daily_missions activity + activity log), per KST week
    var active = {};
    data(1).forEach(function (d) { if ((d.articles || 0) + (d.words || 0) + (d.quizzes || 0) + (d.fill || 0) > 0) active[d.date] = 1; });
    data(2).forEach(function (a) { if (a.study_date && a.activity_type !== 'visit') active[a.study_date] = 1; });

    // Skills — this week vs last week
    var inWeek = function (date, mon) { return date >= mon && date <= addDays(mon, 6); };
    var read = [0, 0];
    data(1).forEach(function (d) { if (inWeek(d.date, thisMon)) read[0] += d.articles || 0; else if (inWeek(d.date, lastMon)) read[1] += d.articles || 0; });
    var rev = [0, 0], due = 0;
    data(3).forEach(function (w) {
      var r = w.srs_last_reviewed ? String(w.srs_last_reviewed).slice(0, 10) : '';
      if (r && inWeek(r, thisMon)) rev[0]++; else if (r && inWeek(r, lastMon)) rev[1]++;
      if (!w.mastered && w.srs_next_review && w.srs_next_review <= today) due++;
    });
    var acc = function (mon) {
      var s = 0, n = 0;
      data(4).forEach(function (q) {
        if (!inWeek(q.study_date, mon)) return;
        var p = q.accuracy_pct != null ? Number(q.accuracy_pct) : (q.max_score ? q.score / q.max_score * 100 : null);
        if (p != null && isFinite(p)) { s += p; n++; }
      });
      return n ? Math.round(s / n) : null;
    };
    var gram = [acc(thisMon), acc(lastMon)];
    var wr = [0, 0];
    data(5).forEach(function (x) {
      var d = x.study_date || (x.submitted_at ? new Date(new Date(x.submitted_at).getTime() + 9 * 3600000).toISOString().slice(0, 10) : '');
      if (inWeek(d, thisMon)) wr[0]++; else if (inWeek(d, lastMon)) wr[1]++;
    });
    renderSkills([
      { name: 'Reading', color: '#60a5fa', v: read[0], last: read[1], scale: Math.max(10, read[0], read[1]), label: read[0] + ' read', sub: 'Articles & conversations' },
      { name: 'Vocabulary', color: '#a78bfa', v: rev[0], last: rev[1], scale: Math.max(20, rev[0], rev[1], due), label: rev[0] + (due ? ' / ' + due : ''), sub: 'Words reviewed' + (due ? ' · ' + due + ' due' : '') },
      { name: 'Grammar', color: '#fbbf24', v: gram[0] || 0, last: gram[1] || 0, scale: 100, label: gram[0] == null ? '—' : gram[0] + '%', sub: gram[0] == null ? 'No quizzes this week' : 'Quiz accuracy', noData: gram[0] == null },
      { name: 'Writing', color: '#4ade80', v: wr[0], last: wr[1], scale: Math.max(3, wr[0], wr[1]), label: String(wr[0]), sub: 'Submitted this week' }
    ]);

    // Fix next — mistake patterns (4 weeks) + the weakest grammar point
    var totals = {};
    data(4).forEach(function (q) {
      if (q.study_date < since28 || !q.wrong_patterns) return;
      var wp = typeof q.wrong_patterns === 'string' ? (function () { try { return JSON.parse(q.wrong_patterns); } catch (_) { return {}; } })() : q.wrong_patterns;
      Object.keys(wp || {}).forEach(function (k) { totals[k] = (totals[k] || 0) + (Number(wp[k]) || 0); });
    });
    var weak = (res[7] && res[7][0]) || null;
    renderFix(totals, weak);

    // Activity — active days per week, last 8 weeks
    var goal = Math.max(1, Math.min(7, Number(res[6] && res[6].data && res[6].data.goal_active_days) || 5));
    renderActivity(active, thisMon, goal, streak);
  }

  // ── Renderers ─────────────────────────────────────────────────
  function body(id) { var el = document.querySelector('#' + id + ' .pg-body'); return el; }

  function renderSkills(rows) {
    var el = body('pg-skills'); if (!el) return;
    el.innerHTML = rows.map(function (r) {
      var w = Math.min(100, Math.round(r.v / r.scale * 100));
      var lw = Math.min(100, Math.round(r.last / r.scale * 100));
      var cls = r.noData ? 'mut' : (r.v > r.last ? 'up' : r.v < r.last ? 'down' : '');
      return '<div class="pg-sk"><div class="pg-sk-n">' + r.name + '</div>'
        + '<div class="pg-sk-bar"><i style="width:' + w + '%;background:' + r.color + '"></i>' + (r.last || r.v ? '<s style="left:' + lw + '%"></s>' : '') + '</div>'
        + '<div class="pg-sk-v ' + cls + '">' + esc(r.label) + '</div>'
        + '<small>' + esc(r.sub) + '</small></div>';
    }).join('');
  }

  var PATTERN = {
    PARTICLE: ['PARTICLE', 'Particles (은/는 · 이/가 · 을/를)', 'particle'],
    TENSE: ['TENSE', 'Tense & verb endings', 'tense'],
    WORD_ORDER: ['ORDER', 'Word order', 'word_order'],
    SPELLING: ['SPELLING', 'Spelling & spacing', 'spelling'],
    VOCAB: ['VOCAB', 'Word choice', 'vocab'],
    NUANCE: ['NUANCE', 'Nuance & naturalness', 'vocab']
  };
  function renderFix(totals, weak) {
    var el = body('pg-fix'); if (!el) return;
    var sum = Object.keys(totals).reduce(function (s, k) { return s + totals[k]; }, 0);
    var items = Object.keys(totals).filter(function (k) { return totals[k] > 0 && PATTERN[k]; })
      .sort(function (x, y) { return totals[y] - totals[x]; }).slice(0, 3)
      .map(function (k) { var p = PATTERN[k]; return { tag: p[0], t: p[1], s: Math.round(totals[k] / sum * 100) + '% of your mistakes', href: 'korehan-study-room.html?focus=' + p[2] + '&source=growth-lab' }; });
    if (weak && weak.grammar_point && (weak.wrong_count || 0) > 0) {
      var tot = (weak.correct_count || 0) + (weak.wrong_count || 0);
      items.unshift({ tag: 'GRAMMAR', t: weak.grammar_point, s: tot ? Math.round((weak.correct_count || 0) / tot * 100) + '% correct' : 'Missed recently', href: 'korehan-study-room.html?focus=' + encodeURIComponent(weak.grammar_point) + '&source=growth-lab' });
      items = items.slice(0, 3);
    }
    el.innerHTML = items.length ? items.map(function (it) {
      return '<a class="pg-fix" href="' + esc(it.href) + '"><span class="pg-tag">' + esc(it.tag) + '</span>'
        + '<span class="pg-fix-t">' + esc(it.t) + '<small>' + esc(it.s) + '</small></span><span class="pg-go">Practice</span></a>';
    }).join('') : '<div class="pg-empty">No mistakes to fix yet — quizzes and writing feedback will show up here.</div>';
  }

  function renderActivity(active, thisMon, goal, streak) {
    var el = body('pg-act'); if (!el) return;
    var weeks = [];
    for (var i = 7; i >= 0; i--) {
      var mon = addDays(thisMon, -7 * i), n = 0;
      for (var d = 0; d < 7; d++) if (active[addDays(mon, d)]) n++;
      weeks.push({ mon: mon, n: n, now: i === 0 });
    }
    // Longest streak inside the 8-week window
    var longest = 0, run = 0, start = addDays(thisMon, -49), today = kstDate(0);
    for (var day = start; day <= today; day = addDays(day, 1)) { if (active[day]) { run++; if (run > longest) longest = run; } else run = 0; }
    longest = Math.max(longest, streak);
    var total = weeks.reduce(function (s, w) { return s + w.n; }, 0);
    var H = 100;
    el.innerHTML = '<div class="pg-bars"><div class="pg-goal" style="bottom:' + (goal / 7 * H + 22) + 'px"><span>goal ' + goal + '</span></div>'
      + weeks.map(function (w) {
          var m = w.mon.slice(5).replace(/^0/, '').replace('-0', '/').replace('-', '/');
          return '<div class="pg-bar"><b>' + w.n + '</b><i class="' + (w.now ? 'now' : (w.n >= goal ? 'hit' : '')) + '" style="height:' + Math.max(3, w.n / 7 * H) + 'px"></i><small>' + (w.now ? 'Now' : m) + '</small></div>';
        }).join('') + '</div>'
      + '<div class="pg-sum"><div><b>' + streak + '</b><small>day streak</small></div><div><b>' + longest + '</b><small>longest</small></div><div><b>' + total + '</b><small>days in 8 weeks</small></div></div>';
  }

  function renderSignedOut() {
    var root = document.getElementById('pg-root');
    if (!root) return;
    root.querySelector('.pg-grid').innerHTML = '<section class="pg-card pg-signin"><b>See your progress</b>'
      + '<p>Sign in to track your week, skills, mistakes to fix and streak.</p>'
      + '<button type="button" onclick="openAuthModal(\'signin\')">Sign in</button></section>';
  }

  // ── Wire-up: replace the old loaders ─────────────────────────
  // Old: loadHub() → ~20 sequential queries for removed tiles/charts;
  // loadNewHubSections() → radar snapshot, comparison, review history.
  window.loadHub = function () {
    if (typeof supaUser === 'undefined' || !supaUser) { if (window._sessionChecked) renderSignedOut(); return; }
    load();
  };
  window.loadNewHubSections = function () {
    if (window._pgSectionsLoaded) return;
    window._pgSectionsLoaded = true;
    try { loadFeedbackHistory(); } catch (_) {}
    try { loadRecentBadges(); } catch (_) {}
    try { loadCalendarData(); } catch (_) {}   // also logs today's visit
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
