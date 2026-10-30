// Saved hub (korehan-saved.html) — words, bookmarked articles and saved
// phrases in one place. Each list shows 10 rows at a time ("Show more"),
// rows are one line, and an item is removed by swiping left (touch) or
// the x button (mouse).

var SV_PAGE = 10;
var SV_PHRASES_KEY = 'kh_saved_phrases_v1';
var _sv = {
  tab: 'words', filter: 'all', shown: SV_PAGE,
  words: null, articles: null, phrases: null
};

function _svE(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _svDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function _svLevel(l) { return (typeof KH_LEVEL_MAP !== 'undefined' && KH_LEVEL_MAP[l]) || l || ''; }

// ── Data ─────────────────────────────────────────────────────────
async function _svLoadWords() {
  var r = await getSupa().from('user_saved_words').select('*')
    .eq('user_id', supaUser.id).order('created_at', { ascending: false }).limit(500);
  _sv.words = (r.data || []).map(function (w) {
    return { id: w.id, ko: w.word_ko || w.ko || '', rom: (typeof _khSavedRom === 'function' ? _khSavedRom(w.word_ko || w.ko || '', w.word_rom || '') : (w.word_rom || '')), en: w.word_en || w.en || '', at: w.created_at };
  }).filter(function (w) { return w.ko; });
}

async function _svLoadArticles() {
  var sb = getSupa();
  var bm = await sb.from('bookmarks').select('*').eq('user_id', supaUser.id).order('id', { ascending: false });
  var marks = bm.data || [];
  var ids = marks.map(function (b) { return b.article_id; }).filter(Boolean);
  if (!ids.length) { _sv.articles = []; return; }
  var res = await Promise.all([
    sb.from('articles').select('id,title,section,level,image,date').in('id', ids),
    sb.from('read_articles').select('article_id').eq('user_id', supaUser.id).in('article_id', ids)
  ]);
  var byId = {};
  (res[0].data || []).forEach(function (a) { byId[String(a.id)] = a; });
  var read = {};
  (res[1].data || []).forEach(function (x) { read[String(x.article_id)] = true; });
  _sv.articles = marks.map(function (b) {
    var a = byId[String(b.article_id)];
    if (!a) return null;   // article was removed
    return {
      id: String(a.id), title: a.title || '', image: a.image || '', level: a.level,
      kind: a.section === 'buzz' ? 'buzz' : 'news', read: !!read[String(a.id)],
      at: b.bookmarked_at || b.created_at
    };
  }).filter(Boolean);
}

async function _svLoadPhrases() {
  var local = [];
  try { local = JSON.parse(localStorage.getItem(SV_PHRASES_KEY) || '[]') || []; } catch (_) {}
  var r = await getSupa().from('user_saved_phrases').select('*').eq('user_id', supaUser.id);
  var out = [], seen = {};
  (r.data || []).forEach(function (p) {
    var key = p.source_type + '|' + (p.source_type === 'phrase' ? p.ko : p.id);
    if (seen[key] || !p.ko) return;
    seen[key] = 1;
    out.push({ id: p.id, type: p.source_type === 'phrase' ? 'phrase' : 'conversation', ko: p.ko, en: p.en || '',
      src: p.source_id, at: p.created_at || p.saved_at });
  });
  // Today's-phrase saves made on this device before DB sync existed.
  local.forEach(function (p) {
    if (!p || !p.ko || seen['phrase|' + p.ko]) return;
    seen['phrase|' + p.ko] = 1;
    out.push({ id: null, type: 'phrase', ko: p.ko, en: p.en || '', src: p.ko, at: p.saved_at });
  });
  out.sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
  _sv.phrases = out;
}

// ── Render ───────────────────────────────────────────────────────
function _svCounts() {
  [['words', _sv.words], ['articles', _sv.articles], ['phrases', _sv.phrases]].forEach(function (p) {
    var el = document.getElementById('sv-n-' + p[0]);
    if (el) el.textContent = p[1] ? String(p[1].length) : '';
  });
}

function _svFiltered() {
  var list = _sv[_sv.tab] || [];
  if (_sv.filter === 'all') return list;
  return list.filter(function (x) { return (x.kind || x.type) === _sv.filter; });
}

function _svRow(href, inner, delArg) {
  return '<div class="sv-row" data-del="' + _svE(delArg) + '">'
    + '<button type="button" class="sv-del-bg" tabindex="-1" onclick="svRemove(this)">Remove</button>'
    + '<a class="sv-item" href="' + href + '">' + inner
    + '<button type="button" class="sv-x" aria-label="Remove" onclick="event.preventDefault();event.stopPropagation();svRemove(this)">' + khIcon('x') + '</button>'
    + '</a></div>';
}

function _svRender() {
  document.querySelectorAll('.sv-tab').forEach(function (b) {
    var on = b.getAttribute('data-tab') === _sv.tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  var bar = document.getElementById('sv-bar');
  var listEl = document.getElementById('sv-list');
  var more = document.getElementById('sv-more');
  var all = _sv[_sv.tab];
  if (!all) { listEl.innerHTML = '<div class="sv-empty">Loading…</div>'; more.hidden = true; bar.innerHTML = ''; var h0 = document.querySelector('.sv-hint'); if (h0) h0.hidden = true; return; }

  var chips = { articles: [['all', 'All'], ['news', 'News'], ['buzz', 'Korea Buzz']],
                phrases: [['all', 'All'], ['phrase', "Today's phrase"], ['conversation', 'Conversations']] }[_sv.tab] || [];
  var act = '';
  if (_sv.tab === 'words') act = '<a class="sv-act" href="korehan-study-room.html?tab=words">Practice in My Words</a>';
  if (_sv.tab === 'articles') {
    var nRead = all.filter(function (a) { return a.read; }).length;
    if (nRead) act = '<button type="button" class="sv-act" onclick="svClearRead()">Clear read (' + nRead + ')</button>';
  }
  bar.innerHTML = chips.map(function (c) {
    return '<button type="button" class="sv-chip' + (c[0] === _sv.filter ? ' on' : '') + '" onclick="svFilter(\'' + c[0] + '\')">' + c[1] + '</button>';
  }).join('') + act;

  var list = _svFiltered();
  // The swipe-to-remove hint only makes sense when there is a row to swipe.
  var hint = document.querySelector('.sv-hint');
  if (hint) hint.hidden = !list.length;
  if (!list.length) {
    var empty = {
      words: 'No saved words yet. Tap any word while reading to save it.',
      articles: 'No saved articles yet. Tap the bookmark on any article to keep it here. <a href="korehan-all.html">Browse articles</a>',
      phrases: 'No saved phrases yet. Save one from <a href="korehan-phrase.html">Today\'s Phrase</a> or a conversation line.'
    }[_sv.tab];
    listEl.innerHTML = '<div class="sv-empty">' + (all.length ? 'Nothing here with this filter.' : empty) + '</div>';
    more.hidden = true;
    return;
  }
  listEl.innerHTML = list.slice(0, _sv.shown).map(function (x) {
    if (_sv.tab === 'words') {
      return _svRow('korehan-study-room.html?tab=words',
        '<span class="sv-tx"><b lang="ko">' + _svE(x.ko) + '</b><small>' + _svE([x.rom, x.en].filter(Boolean).join(' · ')) + '</small></span>', x.id);
    }
    if (_sv.tab === 'articles') {
      var meta = [x.kind === 'buzz' ? 'Korea Buzz' : 'News', _svLevel(x.level), x.at ? 'saved ' + _svDate(x.at) : ''].filter(Boolean).join(' · ');
      return _svRow('korehan-article.html?id=' + encodeURIComponent(x.id),
        '<span class="sv-th"' + (x.image ? ' style="background-image:url(\'' + _svE(x.image) + '\')"' : '') + '></span>'
        + '<span class="sv-tx"><b lang="ko">' + _svE(x.title) + '</b><small>' + _svE(meta) + (x.read ? ' · <span class="sv-read">Read</span>' : '') + '</small></span>', x.id);
    }
    var href = x.type === 'phrase' ? 'korehan-phrase.html?q=' + encodeURIComponent(x.ko) : 'korehan-conversations.html?id=' + encodeURIComponent(x.src);
    var sub = [x.en, x.type === 'phrase' ? "Today's phrase" : 'Conversation'].filter(Boolean).join(' · ');
    return _svRow(href, '<span class="sv-tx"><b lang="ko">' + _svE(x.ko) + '</b><small>' + _svE(sub) + '</small></span>',
      (x.type === 'phrase' ? 'p:' : 'c:') + (x.type === 'phrase' ? x.ko : x.id));
  }).join('');
  more.hidden = list.length <= _sv.shown;
  more.textContent = 'Show more (' + (list.length - _sv.shown) + ' left)';
  _svBindSwipe();
}

// ── Actions ──────────────────────────────────────────────────────
function svTab(tab) {
  _sv.tab = tab; _sv.filter = 'all'; _sv.shown = SV_PAGE;
  try { history.replaceState(null, '', 'korehan-saved.html?tab=' + tab); } catch (_) {}
  _svRender();
}
function svFilter(f) { _sv.filter = f; _sv.shown = SV_PAGE; _svRender(); }

async function _svDelete(tab, key) {
  var sb = getSupa();
  if (tab === 'words') {
    var w = _sv.words.find(function (x) { return String(x.id) === key; });
    var del = await sb.from('user_saved_words').delete().eq('user_id', supaUser.id).eq('id', key);
    if (del && del.error) throw del.error;
    // Drop it from the local mirror too, or it would look saved elsewhere
    // (hover tooltips, Word Bank) until the next sync.
    if (w && w.ko) {
      if (typeof khForgetSavedWordLocal === 'function') khForgetSavedWordLocal(w.ko);
      else try {
        var lw = JSON.parse(localStorage.getItem('korehan_saved_words') || '[]') || [];
        localStorage.setItem('korehan_saved_words', JSON.stringify(lw.filter(function (x) { return x && x.ko !== w.ko; })));
      } catch (_) {}
    }
    _sv.words = _sv.words.filter(function (x) { return x !== w; });
  } else if (tab === 'articles') {
    await sb.from('bookmarks').delete().eq('user_id', supaUser.id).eq('article_id', key);
    _sv.articles = _sv.articles.filter(function (x) { return x.id !== key; });
  } else {
    var kind = key.slice(0, 2), val = key.slice(2);
    if (kind === 'p:') {
      await sb.from('user_saved_phrases').delete().eq('user_id', supaUser.id).eq('source_type', 'phrase').eq('source_id', val);
      try {
        var local = JSON.parse(localStorage.getItem(SV_PHRASES_KEY) || '[]') || [];
        localStorage.setItem(SV_PHRASES_KEY, JSON.stringify(local.filter(function (p) { return p && p.ko !== val; })));
      } catch (_) {}
      _sv.phrases = _sv.phrases.filter(function (x) { return !(x.type === 'phrase' && x.ko === val); });
    } else {
      await sb.from('user_saved_phrases').delete().eq('user_id', supaUser.id).eq('id', val);
      _sv.phrases = _sv.phrases.filter(function (x) { return String(x.id) !== val; });
    }
  }
}

async function svRemove(el) {
  var row = el.closest('.sv-row');
  if (!row) return;
  var key = row.getAttribute('data-del');
  row.style.opacity = '.4';
  try { await _svDelete(_sv.tab, key); }
  catch (e) { row.style.opacity = ''; if (typeof toast === 'function') toast('Could not remove — try again.', true); return; }
  _svCounts(); _svRender();
  if (typeof toast === 'function') toast('Removed', false);
}

async function svClearRead() {
  var read = (_sv.articles || []).filter(function (a) { return a.read; });
  if (!read.length) return;
  var ok = typeof khConfirm === 'function'
    ? await khConfirm('Clear read articles?', 'Remove ' + read.length + ' article' + (read.length > 1 ? 's' : '') + ' you have already read from Saved.', { okLabel: 'Clear', destructive: true })
    : confirm('Remove read articles from Saved?');
  if (!ok) return;
  var ids = read.map(function (a) { return a.id; });
  var r = await getSupa().from('bookmarks').delete().eq('user_id', supaUser.id).in('article_id', ids);
  if (r.error) { if (typeof toast === 'function') toast('Could not clear — try again.', true); return; }
  _sv.articles = _sv.articles.filter(function (a) { return !a.read; });
  _svCounts(); _svRender();
}

// Swipe left on touch screens reveals the red Remove strip behind the row.
function _svBindSwipe() {
  document.querySelectorAll('#sv-list .sv-item').forEach(function (it) {
    var x0 = null, y0 = 0, dx = 0, open = false;
    it.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; }, { passive: true });
    it.addEventListener('touchmove', function (e) {
      if (x0 == null) return;
      dx = e.touches[0].clientX - x0;
      if (Math.abs(e.touches[0].clientY - y0) > Math.abs(dx)) { x0 = null; return; }
      var off = Math.max(-90, Math.min(0, dx + (open ? -84 : 0)));
      it.style.transition = 'none';
      it.style.transform = 'translateX(' + off + 'px)';
    }, { passive: true });
    it.addEventListener('touchend', function () {
      if (x0 == null) return;
      it.style.transition = '';
      open = (dx + (open ? -84 : 0)) < -40;
      it.style.transform = open ? 'translateX(-84px)' : '';
      x0 = null;
    });
    it.addEventListener('click', function (e) {
      if (open || Math.abs(dx) > 8) { e.preventDefault(); if (open) { open = false; it.style.transform = ''; } dx = 0; }
    });
  });
}

// ── Boot ─────────────────────────────────────────────────────────
async function _svBoot() {
  if (!supaUser) {
    document.getElementById('sv-list').innerHTML = '<div class="sv-empty">Sign in to see what you saved.<br><a href="#" onclick="openAuthModal(\'signin\');return false">Sign in</a></div>';
    return;
  }
  _svRender();
  var jobs = [['words', _svLoadWords], ['articles', _svLoadArticles], ['phrases', _svLoadPhrases]];
  jobs.forEach(function (j) {
    j[1]().catch(function (e) { console.warn('[saved] ' + j[0], e); _sv[j[0]] = _sv[j[0]] || []; })
      .then(function () { _svCounts(); if (_sv.tab === j[0]) _svRender(); });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var t = new URLSearchParams(location.search).get('tab');
  if (['words', 'articles', 'phrases'].indexOf(t) >= 0) _sv.tab = t;
  document.querySelectorAll('.sv-tab').forEach(function (b) {
    b.addEventListener('click', function () { svTab(b.getAttribute('data-tab')); });
  });
  document.getElementById('sv-more').addEventListener('click', function () { _sv.shown += SV_PAGE; _svRender(); });
  var booted = false;
  function go() { if (booted) return; booted = true; _svBoot(); }
  window.addEventListener('kh-auth-signed-in', function () { booted = false; go(); });
  (function wait(n) {
    if (supaUser || window._sessionChecked || n > 60) { go(); return; }
    setTimeout(function () { wait(n + 1); }, 100);
  })(0);
});
