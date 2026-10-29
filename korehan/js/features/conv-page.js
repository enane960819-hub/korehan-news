/* ============================================================
   KoreHani — Conversations (mockup F, 2026-10-28)

   One page for every conversation: a list (level / situation filters,
   today's pick, New · In progress · Done) and a conversation view at
   ?id=N with three steps:
     1 Listen & read (free) — tap a line to hear it, English Off/Tap/On,
       key expressions highlighted, Play all at 0.8× / 1×
     2 Key expressions (free) — what to keep, with the line it came from
     3 Role-play (Premium: conversation_study) — you play the second
       speaker and choose each reply; wrong options are wrong for a reason
       (speech level, doesn't answer) and say why
   Done → expressions can be saved to My Words (Today's Review picks them
   up), the conversation is marked Done (user_study_progress), and the next
   one at your level is suggested.

   Role-play options are built by rule (no AI cost): the 반말 version of a
   polite line, and the speaker's other lines. An admin can override them
   per line with msgs[i].options = [{ ko, why }] (wrong options only).
   ============================================================ */
(function () {
  var LV = { s: 'Seed', b: 'Sprout', i: 'Tree', a: 'Forest' };
  var LV_KEY = { Seed: 's', Sprout: 'b', Tree: 'i', Forest: 'a', Starter: 's', Beginner: 'b', Intermediate: 'i', Advanced: 'a' };
  var CAT = { everyday: 'Everyday', friends: 'Friends', family: 'Family', work: 'Work', dating: 'Dating', food: 'Food', travel: 'Travel', shopping: 'Shopping', school: 'School', health: 'Health', service: 'Service', culture: 'Culture', drama: 'Drama' };
  var COLORS = ['#2563eb', '#db2777', '#ea580c', '#16a34a', '#7c3aed', '#0891b2', '#ca8a04', '#0f172a'];
  var FEMALE = /(엄마|어머니|할머니|언니|누나|이모|고모|딸|아내|여자친구|여친|선생님\(여\))/;
  var MALE = /(아빠|아버지|할아버지|형|오빠|삼촌|아들|남편|남자친구|남친)/;

  var S = { rows: [], progress: {}, lvl: '', cat: 'all', conv: null, step: 1, english: 'tap', rate: 1, playing: false, rp: null };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n) { return (typeof khIcon === 'function') ? khIcon(n) : ''; }
  function lucide() { if (window.renderKhLucideIcons) { try { renderKhLucideIcons(); } catch (_) {} } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function hash(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function colorOf(name) { return COLORS[hash(name) % COLORS.length]; }
  // The two speakers of a conversation always get different colours.
  function pairColors(c) {
    var a = c.speakers[0] || '', b = c.speakers[1] || '';
    var ca = colorOf(a), cb = colorOf(b);
    if (cb === ca) cb = COLORS[(COLORS.indexOf(ca) + 3) % COLORS.length];
    var m = {}; m[a] = ca; m[b] = cb; return m;
  }
  function col(c, who) { return (c._col || (c._col = pairColors(c)))[who] || colorOf(who); }
  function initial(name) { var n = String(name || '?').replace(/\s+/g, ''); return n.charAt(0); }

  // ── Data shape ────────────────────────────────────────────────
  function norm(row) {
    var d = row.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = {}; } }
    d = d || {};
    var msgs = (d.msgs || []).filter(function (m) { return m && (m.txt || m.text) && m.s !== 'n'; })
      .map(function (m) { return { who: String(m.who || m.name || '').trim(), txt: String(m.txt || m.text).trim(), en: String(m.en || '').trim(), options: Array.isArray(m.options) ? m.options : null }; });
    var order = [];
    msgs.forEach(function (m) { if (m.who && order.indexOf(m.who) < 0) order.push(m.who); });
    var c = {
      id: row.id, status: row.status || d.status || 'published',
      lvl: row.lvl || d.lvl || 'b', cat: row.cat || d.cat || 'everyday',
      title: row.ctx_en || d.topic || d.ctx_en || row.ctx || d.ctx || 'Conversation',
      ctx: row.ctx || d.ctx || '', msgs: msgs, speakers: order.slice(0, 2), cast: order,
      vocab: Array.isArray(d.vocab) ? d.vocab : [], grammar: Array.isArray(d.grammar) ? d.grammar : [],
      kx: (Array.isArray(d.key_expressions) ? d.key_expressions : []).filter(function (k) { return k && k.ko; }),
      speech: d.speech || null
    };
    if (!c.kx.length) c.kx = c.vocab.slice(0, 4).map(function (v) { return { ko: v.ko, en: v.en }; });
    c.level = speechLevels(c);
    return c;
  }

  // 존댓말 if most of a speaker's sentence endings are polite.
  function isPolite(t) {
    var s = String(t).replace(/[ㅠㅜㅋㅎ~…!?.,\s"'”“)(]+$/g, '');
    return /(요|니다|니까|세요|죠|십시오)$/.test(s);
  }
  function speechLevels(c) {
    var out = {};
    (c.cast || c.speakers).forEach(function (sp) {
      if (c.speech && c.speech[sp]) { out[sp] = c.speech[sp]; return; }
      var lines = c.msgs.filter(function (m) { return m.who === sp; });
      var pol = lines.filter(function (m) { return isPolite(m.txt); }).length;
      out[sp] = lines.length && pol / lines.length >= 0.5 ? '존댓말' : '반말';
    });
    return out;
  }
  function levelTag(c) {
    var a = c.level[c.speakers[0]], b = c.level[c.speakers[1]];
    if (!a || !b) return a || b || '';
    return a === b ? a : '반말 ↔ 존댓말';
  }
  function voiceOf(c, who) {
    if (FEMALE.test(who)) return 'female';
    if (MALE.test(who)) return 'male';
    return c.speakers.indexOf(who) === 1 ? 'male' : 'female';
  }

  // Key expressions inside a line: the longest piece of each expression
  // (split at "~") gets highlighted where it occurs.
  function markKx(c, text) {
    var html = esc(text);
    c.kx.forEach(function (k) {
      var parts = String(k.ko).split(/[~…]/).map(function (p) { return p.replace(/[?.!]/g, '').trim(); }).filter(function (p) { return p.length >= 2; });
      parts.sort(function (a, b) { return b.length - a.length; });
      var p = parts[0];
      if (!p) return;
      var e = esc(p);
      var i = html.indexOf(e);
      if (i >= 0 && html.lastIndexOf('<u>', i) <= html.lastIndexOf('</u>', i)) html = html.slice(0, i) + '<u>' + e + '</u>' + html.slice(i + e.length);
    });
    return html;
  }

  // ── Progress (user_study_progress, content_type 'conversation') ──
  async function loadProgress() {
    var sb = getSupa(), u = (typeof supaUser !== 'undefined') ? supaUser : null;
    if (!sb || !u) return;
    try {
      var r = await sb.from('user_study_progress').select('content_type,content_id,progress,completed').eq('user_id', u.id).in('content_type', ['conversation', 'conversation_study']);
      (r.data || []).forEach(function (row) {
        var cur = S.progress[row.content_id] || {};
        var p = row.progress || {};
        S.progress[row.content_id] = { step: Math.max(cur.step || 0, p.step || 0), done: !!(cur.done || row.completed) };
      });
    } catch (_) {}
  }
  function saveProgress(id, patch) {
    var cur = S.progress[id] || {};
    var next = { step: Math.max(cur.step || 0, patch.step || 0), done: !!(cur.done || patch.done) };
    S.progress[id] = next;
    var sb = getSupa(), u = (typeof supaUser !== 'undefined') ? supaUser : null;
    if (!sb || !u) return;
    sb.from('user_study_progress').upsert({ user_id: u.id, content_type: 'conversation', content_id: String(id), progress: { step: next.step }, completed: next.done, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,content_type,content_id' }).then(function () {}, function () {});
  }
  function statusOf(c) {
    var p = S.progress[String(c.id)];
    if (p && p.done) return { k: 'done', t: 'Done' };
    if (p && p.step >= 1) return { k: 'prog', t: Math.min(p.step, 3) + ' / 3' };
    return { k: 'new', t: 'New' };
  }

  // ── List ──────────────────────────────────────────────────────
  function userLevel() {
    var l = '';
    try { l = localStorage.getItem('kh_level') || ''; } catch (_) {}
    return LV_KEY[l] || 'b';
  }
  function visible() {
    return S.rows.filter(function (c) {
      return (!S.lvl || c.lvl === S.lvl) && (S.cat === 'all' || c.cat === S.cat);
    });
  }
  function avatars(c, small) {
    var a = c.speakers[0] || '?', b = c.speakers[1] || '?';
    return '<span class="cv-av2' + (small ? ' sm' : '') + '"><i style="background:' + col(c, a) + '">' + esc(initial(a)) + '</i><i style="background:' + col(c, b) + '">' + esc(initial(b)) + '</i></span>';
  }
  function renderList() {
    var root = document.getElementById('cv-root');
    document.body.classList.remove('cv-dark');
    if (!root) return;
    document.title = 'Conversations — KoreHani';
    var cats = Object.keys(CAT).filter(function (k) { return S.rows.some(function (c) { return c.cat === k; }); });
    var list = visible();
    var pick = list.filter(function (c) { return statusOf(c).k !== 'done'; })[0];
    root.innerHTML = '<div class="cv-wrap">'
      + '<h1 class="cv-h1">Conversations</h1><p class="cv-hs">Real Korean dialogue for everyday situations</p>'
      + '<div class="cv-chips">' + ['', 's', 'b', 'i', 'a'].map(function (k) {
          return '<button type="button" class="cv-chip' + (S.lvl === k ? ' on' : '') + '" onclick="khConv.level(\'' + k + '\')">' + (k ? LV[k] : 'All levels') + '</button>';
        }).join('') + '</div>'
      + '<div class="cv-chips">' + ['all'].concat(cats).map(function (k) {
          return '<button type="button" class="cv-chip' + (S.cat === k ? ' on' : '') + '" onclick="khConv.category(\'' + k + '\')">' + (k === 'all' ? 'All' : CAT[k]) + '</button>';
        }).join('') + '</div>'
      + (pick ? '<button type="button" class="cv-pick" onclick="khConv.open(' + pick.id + ')"><small>Today’s pick · ' + esc(LV[pick.lvl] || '') + '</small>'
          + '<b>' + esc(pick.title) + '</b><span class="ko">' + esc(pick.ctx) + '</span>'
          + '<span class="cv-pick-go">' + (statusOf(pick).k === 'prog' ? 'Continue' : 'Start') + ' · ' + Math.max(1, Math.round(pick.msgs.length / 3)) + ' min</span></button>' : '')
      + '<div class="cv-list">' + (list.length ? list.map(function (c) {
          var st = statusOf(c), lt = levelTag(c);
          return '<a class="cv-card" href="?id=' + c.id + '" onclick="event.preventDefault();khConv.open(' + c.id + ')">'
            + avatars(c)
            + '<span class="cv-ct"><b>' + esc(c.title) + '</b><span class="ko">' + esc(c.ctx) + '</span>'
            + '<span class="cv-meta">' + (lt ? '<em class="' + (lt === '반말' ? 'ban' : lt === '존댓말' ? 'jon' : 'mix') + '">' + esc(lt) + '</em>' : '')
            + '<em>' + esc(CAT[c.cat] || c.cat) + '</em><em>' + esc(LV[c.lvl] || '') + '</em><em>' + c.msgs.length + ' lines</em></span></span>'
            + '<span class="cv-st ' + st.k + '">' + st.t + '</span></a>';
        }).join('') : '<div class="cv-empty">No conversations here yet — try another level or situation.</div>') + '</div>'
      + '</div>';
    lucide();
  }

  // ── Conversation view ─────────────────────────────────────────
  function stepDots(n) { return '<div class="cv-steps">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= n ? 'on' : '') + '"></span>'; }).join('') + '</div>'; }
  function head(c) {
    var a = c.speakers[0] || '', b = c.speakers[1] || '';
    // Third speakers (아빠 in a family scene) used to be left out of the
    // cast and the register note.
    var cast = (c.cast && c.cast.length > 2) ? c.cast : [a, b].filter(Boolean);
    var lvls = cast.map(function (n) { return c.level[n]; });
    var same = lvls.every(function (l) { return l && l === lvls[0]; });
    var note = lvls.every(Boolean) ? (same ? (cast.length > 2 ? 'Everyone speaks ' : 'Both speak ') + lvls[0]
      : cast.map(function (n) { return esc(n) + ' uses ' + c.level[n]; }).join(', ')) : '';
    return '<div class="cv-head"><button type="button" class="cv-back" onclick="khConv.back()">' + icon('arrow-left') + 'Conversations</button>'
      + '<h1 class="cv-title">' + esc(c.title) + '</h1><p class="cv-ko">' + esc(c.ctx) + '</p>'
      + '<div class="cv-spk">' + cast.map(function (n) {
          return '<div class="cv-sp"><i style="background:' + col(c, n) + '">' + esc(initial(n)) + '</i><span><b>' + esc(n) + '</b><small>' + esc(c.level[n] || '') + (n === b ? ' · you play this part' : '') + '</small></span></div>';
        }).join('') + '</div>'
      + (note ? '<div class="cv-lv"><span class="' + (same ? (lvls[0] === '반말' ? 'ban' : 'jon') : 'mix') + '">' + esc(same ? lvls[0] : '반말 ↔ 존댓말') + '</span>' + note + '</div>' : '')
      + '</div>';
  }
  function renderRead() {
    var c = S.conv, root = document.getElementById('cv-root');
    document.body.classList.remove('cv-dark');
    var b = c.speakers[1];
    root.innerHTML = '<div class="cv-wrap cv-conv">' + head(c)
      + '<div class="cv-ctrl"><button type="button" class="' + (S.playing ? 'on' : '') + '" onclick="khConv.playAll()">' + icon(S.playing ? 'square' : 'play') + (S.playing ? 'Stop' : 'Play all') + '</button>'
      + '<button type="button" onclick="khConv.rate()">' + (S.rate === 1 ? '1×' : '0.8×') + '</button>'
      + '<button type="button" onclick="khConv.english()">English: ' + ({ off: 'Off', tap: 'Tap', on: 'On' })[S.english] + '</button></div>'
      + '<div class="cv-chat" data-english="' + S.english + '">' + c.msgs.map(function (m, i) {
          var right = m.who === b;
          return '<div class="cv-ln' + (right ? ' r' : '') + '" id="cv-ln-' + i + '"><i style="background:' + col(c, m.who) + '" title="' + esc(m.who) + '">' + esc(initial(m.who)) + '</i>'
            + '<button type="button" class="cv-bb" onclick="khConv.tapLine(' + i + ')"><span class="cv-who">' + esc(m.who) + '</span>' + markKx(c, m.txt)
            + (m.en ? '<small>' + esc(m.en) + '</small>' : '') + '</button></div>';
        }).join('') + '</div>'
      + '<div class="cv-dock">' + stepDots(1) + '<button type="button" class="cv-next" onclick="khConv.step(2)">Next: Key expressions ' + icon('arrow-right') + '</button></div>'
      + '</div>';
    lucide();
  }
  function renderExpressions() {
    var c = S.conv, root = document.getElementById('cv-root');
    document.body.classList.remove('cv-dark');
    root.innerHTML = '<div class="cv-wrap cv-conv">' + head(c)
      + '<div class="cv-sec"><h2>Key expressions</h2><p>What to keep from this conversation — tap to hear it.</p>'
      + c.kx.map(function (k, i) {
          var piece = String(k.ko).split(/[~…]/).map(function (p) { return p.replace(/[?.!]/g, '').trim(); }).filter(function (p) { return p.length >= 2; }).sort(function (a, b) { return b.length - a.length; })[0] || '';
          var line = piece ? c.msgs.filter(function (m) { return m.txt.indexOf(piece) >= 0; })[0] : null;
          return '<div class="cv-kx"><button type="button" class="cv-kx-say" onclick="khConv.say(' + i + ')" aria-label="Listen">' + icon('volume-2') + '</button>'
            + '<div class="cv-kx-tx"><b>' + esc(k.ko) + '</b><span>' + esc(k.en || '') + '</span>'
            + (line ? '<small><i>' + esc(line.who) + ':</i> ' + markKx(c, line.txt) + '</small>' : '') + '</div></div>';
        }).join('')
      + (c.grammar.length ? '<h2 style="margin-top:18px">Grammar in this conversation</h2>' + c.grammar.slice(0, 4).map(function (g) {
          return '<div class="cv-gr"><b>' + esc(g.point || g.pattern || '') + '</b><span>' + esc(g.ex || g.explanation || '') + '</span></div>';
        }).join('') : '')
      + '</div>'
      + '<div class="cv-dock">' + stepDots(2) + '<div class="cv-dock-row"><button type="button" class="cv-sec-btn" onclick="khConv.step(1)">' + icon('arrow-left') + 'Back</button>'
      + '<button type="button" class="cv-next" onclick="khConv.step(3)">Next: Role-play ' + icon('arrow-right') + '</button></div></div>'
      + '</div>';
    lucide();
  }

  // ── Role-play (rule-built options) ────────────────────────────
  var BAN_OK = /[아어여해와워봐줘돼게지네래까군걸데대야자고]$/;
  function toBanmal(t) {
    var changed = false;
    var out = String(t).replace(/([가-힣]+)요([?!.…~]*)(?=\s|$)/g, function (all, stem, p) {
      if (/이에$/.test(stem)) { changed = true; return stem.replace(/이에$/, '이야') + p; }
      if (/예$/.test(stem)) { changed = true; return stem.replace(/예$/, '야') + p; }
      if (/세$/.test(stem)) return all;
      if (BAN_OK.test(stem)) { changed = true; return stem + p; }
      return all;
    });
    return changed && out !== t ? out : null;
  }
  function buildRoleplay(c) {
    var a = c.speakers[0], b = c.speakers[1];
    var qs = [];
    c.msgs.forEach(function (m, i) {
      if (m.who !== b || i === 0) return;
      var prev = c.msgs[i - 1];
      var wrong = [];
      if (m.options && m.options.length) {
        m.options.forEach(function (o) { if (o && o.ko && o.ko !== m.txt) wrong.push({ ko: o.ko, why: o.why || '' }); });
      } else {
        if (c.level[b] === '존댓말') {
          var ban = toBanmal(m.txt);
          if (ban) wrong.push({ ko: ban, why: '반말 — ' + b + ' speaks 존댓말 to ' + a + ' here.' });
        }
        shuffle(c.msgs.filter(function (x, j) { return x.who === b && j !== i && x.txt !== m.txt && Math.abs(j - i) > 1; }))
          .forEach(function (x) { if (wrong.length < 2) wrong.push({ ko: x.txt, en: x.en, why: 'That’s ' + b + '’s line from another point in the conversation — it doesn’t answer what ' + a + ' just said.' }); });
      }
      if (!wrong.length) return;
      qs.push({ prev: prev, line: m, opts: shuffle([{ ko: m.txt, en: m.en, ok: true }].concat(wrong.slice(0, 2))) });
    });
    return qs.slice(0, 5);
  }
  function dark(on) { document.body.classList.toggle('cv-dark', !!on); }
  function renderRoleplay() {
    var c = S.conv, root = document.getElementById('cv-root'), R = S.rp;
    dark(true);
    if (R.i >= R.qs.length) return renderDone();
    var q = R.qs[R.i], b = c.speakers[1];
    root.innerHTML = '<div class="cv-rp">'
      + '<div class="cv-rp-top"><button type="button" class="cv-x" onclick="khConv.step(2)" aria-label="Back">' + icon('x') + '</button>'
      + '<div class="cv-bar"><div style="width:' + Math.round(R.i / R.qs.length * 100) + '%"></div></div><span>' + (R.i + 1) + ' / ' + R.qs.length + '</span></div>'
      + '<div class="cv-rp-eb">Step 3 of 3 · Role-play</div>'
      + '<div class="cv-rp-q">What does ' + esc(b) + ' say next?</div>'
      + '<div class="cv-rp-ctx"><div class="cv-ln"><i style="background:' + col(c, q.prev.who) + '">' + esc(initial(q.prev.who)) + '</i>'
      + '<button type="button" class="cv-bb" onclick="khConv.sayText(' + R.i + ',\'prev\')"><span class="cv-who">' + esc(q.prev.who) + '</span>' + esc(q.prev.txt) + (q.prev.en ? '<small>' + esc(q.prev.en) + '</small>' : '') + '</button></div></div>'
      + '<div class="cv-rp-you">You are ' + esc(b) + (c.level[b] ? ' · ' + esc(c.level[b]) : '') + '</div>'
      + '<div class="cv-rp-opts">' + q.opts.map(function (o, k) {
          var cls = R.answered ? (o.ok ? ' ok' : (k === R.pick ? ' bad' : '')) : '';
          return '<button type="button" class="cv-opt' + cls + '" ' + (R.answered ? 'disabled' : '') + ' onclick="khConv.pick(' + k + ')">' + esc(o.ko)
            + (R.answered && o.en ? '<small>' + esc(o.en) + '</small>' : '') + '</button>';
        }).join('') + '</div>'
      + (R.answered ? (function () {
          var chosen = q.opts[R.pick];
          var bad = q.opts.filter(function (o) { return !o.ok && o.why; });
          return '<div class="cv-why">' + (chosen.ok ? '<b>Right.</b> ' : '<b>Not quite.</b> ') + esc((chosen.ok ? (bad[0] && bad[0].why ? 'The other options: ' + bad.map(function (o) { return o.why; }).join(' ') : '') : chosen.why) || '') + '</div>'
            + '<div class="cv-rp-say"><button type="button" onclick="khConv.sayText(' + R.i + ',\'line\')">' + icon('volume-2') + 'Hear it</button></div>'
            + '<button type="button" class="cv-next wide" onclick="khConv.nextQ()">' + (R.i + 1 >= R.qs.length ? 'See results' : 'Next') + '</button>';
        })() : '')
      + '</div>';
    lucide();
  }
  function renderDone() {
    var c = S.conv, root = document.getElementById('cv-root'), R = S.rp || { qs: [], right: 0 };
    dark(true);
    saveProgress(c.id, { step: 3, done: true });
    try { if (typeof logActivity === 'function') logActivity('quiz', { content_type: 'conversation', score: R.right, max_score: R.qs.length }); } catch (_) {}
    var total = R.qs.length, pct = total ? Math.round(R.right / total * 100) : 100;
    var next = S.rows.filter(function (x) { return x.id !== c.id && x.lvl === c.lvl && statusOf(x).k !== 'done'; })[0]
      || S.rows.filter(function (x) { return x.id !== c.id && statusOf(x).k !== 'done'; })[0];
    var savedSet = (typeof _savedWordsSet !== 'undefined' && _savedWordsSet) ? _savedWordsSet : null;
    root.innerHTML = '<div class="cv-rp">'
      + '<div class="cv-dn">' + (total ? '<div class="cv-ring" style="background:conic-gradient(#34d399 0 ' + pct + '%,rgba(255,255,255,.1) ' + pct + '% 100%)"><div>' + R.right + '/' + total + '</div></div>' : '')
      + '<h2>Conversation done</h2><p>' + esc(c.title) + '</p></div>'
      + '<div class="cv-box"><h4>Key expressions</h4>' + c.kx.map(function (k, i) {
          var saved = savedSet && savedSet.has(k.ko);
          return '<div class="cv-ex"><b>' + esc(k.ko) + '</b><span>' + esc(k.en || '') + '</span>' + (saved ? '<em>saved</em>' : '') + '</div>';
        }).join('')
      + '<button type="button" class="cv-save" id="cv-save" onclick="khConv.saveAll()">Save expressions to My Words</button></div>'
      + (next ? '<button type="button" class="cv-nextc" onclick="khConv.open(' + next.id + ')">' + avatars(next, true) + '<span><b>Next: ' + esc(next.title) + '</b><small>' + esc(LV[next.lvl] || '') + ' · ' + esc(levelTag(next)) + ' · ' + next.msgs.length + ' lines</small></span></button>' : '')
      + '<button type="button" class="cv-next wide" onclick="khConv.back()">Back to Conversations</button>'
      + '</div>';
    lucide();
  }

  // ── Audio ─────────────────────────────────────────────────────
  function stopAudio() {
    S.playing = false;
    try { if (window._khSpeakAudio) _khSpeakAudio.pause(); } catch (_) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (_) {}
    document.querySelectorAll('.cv-bb.play').forEach(function (e) { e.classList.remove('play'); });
  }
  function speakWait(text, voice) {
    return new Promise(function (resolve) {
      var done = false, finish = function () { if (!done) { done = true; resolve(); } };
      Promise.resolve(typeof khSpeak === 'function' ? khSpeak(text, voice) : null).then(function () {
        var a = window._khSpeakAudio;
        if (a && !a.ended) {
          try { a.playbackRate = S.rate; } catch (_) {}
          a.addEventListener('ended', finish); a.addEventListener('error', finish); a.addEventListener('pause', finish);
        } else {
          var t = setInterval(function () { if (!window.speechSynthesis || !speechSynthesis.speaking) { clearInterval(t); finish(); } }, 250);
        }
        setTimeout(finish, 15000);
      }, finish);
    });
  }
  async function playAll() {
    if (S.playing) { stopAudio(); renderRead(); return; }
    S.playing = true; renderRead();
    var c = S.conv;
    for (var i = 0; i < c.msgs.length && S.playing && S.conv === c; i++) {
      var el = document.querySelector('#cv-ln-' + i + ' .cv-bb');
      document.querySelectorAll('.cv-bb.play').forEach(function (e) { e.classList.remove('play'); });
      if (el) { el.classList.add('play'); try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {} }
      await speakWait(c.msgs[i].txt, voiceOf(c, c.msgs[i].who));
      await new Promise(function (r) { setTimeout(r, 250); });
    }
    if (S.conv === c) { S.playing = false; renderRead(); }
  }
  function tapLine(i) {
    var c = S.conv, m = c.msgs[i];
    if (!m) return;
    stopAudio();
    var el = document.querySelector('#cv-ln-' + i + ' .cv-bb');
    if (el) { el.classList.add('play'); if (S.english === 'tap') el.classList.toggle('show-en'); }
    speakWait(m.txt, voiceOf(c, m.who)).then(function () { if (el) el.classList.remove('play'); });
  }

  // ── Navigation ────────────────────────────────────────────────
  function open(id, noPush) {
    var c = S.rows.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!c) return;
    stopAudio();
    S.conv = c; S.step = 1; S.rp = null;
    document.body.classList.add('kh-reading-page');   // focused view: no bottom tab bar
    if (!noPush) try { history.pushState({ cv: id }, '', '?id=' + id); } catch (_) {}
    document.title = c.title + ' — KoreHani';
    saveProgress(c.id, { step: 1 });
    renderRead();
    try { window.scrollTo(0, 0); } catch (_) {}
  }
  function back(noPush) {
    stopAudio();
    S.conv = null;
    document.body.classList.remove('kh-reading-page');
    if (!noPush) try { history.pushState({}, '', location.pathname + (S.cat !== 'all' ? '?cat=' + S.cat : '')); } catch (_) {}
    renderList();
    try { window.scrollTo(0, 0); } catch (_) {}
  }
  function step(n) {
    var c = S.conv; if (!c) return;
    stopAudio();
    if (n === 3) {
      if (typeof requirePlan === 'function' && !requirePlan('conversation_study')) return;
      var qs = buildRoleplay(c);
      if (!qs.length) { S.rp = { qs: [], i: 0, right: 0 }; renderDone(); return; }
      S.rp = { qs: qs, i: 0, right: 0, answered: false, pick: -1 };
      saveProgress(c.id, { step: 3 });
      renderRoleplay();
    } else {
      S.step = n;
      saveProgress(c.id, { step: n });
      if (n === 2) renderExpressions(); else renderRead();
    }
    try { window.scrollTo(0, 0); } catch (_) {}
  }

  async function init() {
    var root = document.getElementById('cv-root');
    if (!root) return;
    root.innerHTML = '<div class="cv-wrap"><p class="cv-hs" style="padding:40px 0;text-align:center">Loading conversations…</p></div>';
    var q = new URLSearchParams(location.search);
    if (q.get('cat') && CAT[q.get('cat')]) S.cat = q.get('cat');
    try { S.english = localStorage.getItem('kh_conv_english') || 'tap'; } catch (_) {}
    S.lvl = q.get('lvl') && LV[q.get('lvl')] ? q.get('lvl') : userLevel();
    for (var i = 0; i < 30 && typeof getSupa !== 'function'; i++) await new Promise(function (r) { setTimeout(r, 100); });
    var sb = getSupa();
    var r = sb ? await sb.from('conversations_data').select('*').order('created_at', { ascending: false }).limit(500) : { data: [] };
    S.rows = (r.data || []).map(norm).filter(function (c) { return c.status !== 'draft' && c.msgs.length >= 2 && c.speakers.length >= 2; });
    for (var k = 0; k < 20 && typeof supaUser === 'undefined'; k++) await new Promise(function (r2) { setTimeout(r2, 100); });
    await loadProgress();
    if (S.lvl && !S.rows.some(function (c) { return c.lvl === S.lvl; })) S.lvl = '';
    if (q.get('id')) open(q.get('id'), true); else renderList();
  }

  window.addEventListener('popstate', function () {
    var id = new URLSearchParams(location.search).get('id');
    if (id) open(id, true); else back(true);
  });
  window.addEventListener('kh-auth-signed-in', function () { loadProgress().then(function () { if (!S.conv) renderList(); }); });
  document.addEventListener('DOMContentLoaded', init);

  // Shared with the admin editor (korehan-x9f4k2m7-conversations.html) so
  // the preview uses exactly the learner rules.
  window.khConvRules = { norm: norm, speechLevels: speechLevels, isPolite: isPolite, toBanmal: toBanmal, buildRoleplay: buildRoleplay, markKx: markKx, LV: LV, CAT: CAT };

  window.khConv = {
    open: open, back: back, step: step, playAll: playAll, tapLine: tapLine,
    level: function (k) { S.lvl = k; renderList(); },
    category: function (k) { S.cat = k; renderList(); },
    rate: function () { S.rate = S.rate === 1 ? 0.8 : 1; renderRead(); },
    english: function () { S.english = ({ off: 'tap', tap: 'on', on: 'off' })[S.english]; try { localStorage.setItem('kh_conv_english', S.english); } catch (_) {} renderRead(); },
    say: function (i) { var k = S.conv && S.conv.kx[i]; if (k) speakWait(String(k.ko).replace(/~/g, ''), 'female'); },
    sayText: function (i, which) { var q = S.rp && S.rp.qs[i]; if (!q) return; var m = which === 'prev' ? q.prev : q.line; speakWait(m.txt, voiceOf(S.conv, m.who)); },
    pick: function (k) {
      var R = S.rp; if (!R || R.answered) return;
      R.answered = true; R.pick = k;
      var ok = R.qs[R.i].opts[k].ok;
      if (ok) R.right++;
      try { (ok ? playCorrectSound : playWrongSound)(); } catch (_) {}
      renderRoleplay();
    },
    nextQ: function () { var R = S.rp; R.i++; R.answered = false; R.pick = -1; renderRoleplay(); try { window.scrollTo(0, 0); } catch (_) {} },
    saveAll: async function () {
      var c = S.conv, btn = document.getElementById('cv-save');
      if (typeof supaUser === 'undefined' || !supaUser) { if (typeof openAuthModal === 'function') openAuthModal('signin'); return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      for (var i = 0; i < c.kx.length; i++) { try { if (typeof dbSaveWord === 'function') await dbSaveWord(c.kx[i].ko, '', c.kx[i].en || ''); } catch (_) {} }
      if (btn) btn.textContent = 'Saved · they’ll come back in Today’s Review';
      document.querySelectorAll('.cv-ex').forEach(function (e) { if (!e.querySelector('em')) e.insertAdjacentHTML('beforeend', '<em>saved</em>'); });
    }
  };
})();
