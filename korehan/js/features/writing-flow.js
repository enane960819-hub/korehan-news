// ═══════════════════════════════════════════════════════════════
// Writing flow (2026-10) — the weekly "Write & get feedback" step.
// 1 Get ready (format + model sentences + patterns)
// 2 Fill the frames (topic sentence frames, particles auto-fitted)
// 3 Write your own (frames prefilled, live checklist, free quick check)
// 4 Feedback → rewrite (AI corrections, fix them yourself, model answer)
//
// Content comes from `writing_topic_content` (one reviewed pack per weekly
// topic + level, shared by every learner — no per-user AI call). Topics
// without a pack fall back to this week's helpers / grammar / vocab and
// skip step 2. Submission reuses the weekly package pipeline in
// korehan-study-room.js (saveDraft → _submitWeeklyPackage →
// _triggerPackageFeedback), so feedback, scoring and Growth Lab logging
// stay identical to the writing room.
// ═══════════════════════════════════════════════════════════════
var _wf = null;          // { step, c, picks, text, fb, sub }
var _wfCache = {};       // topic|level → content pack (or null)

var WF_MIN_SENTENCES = { Starter: 2, Beginner: 3, Intermediate: 4, Advanced: 5 };
var WF_STEP_NAMES = ['Get ready', 'Fill the frames', 'Write', 'Feedback'];

function _wfE(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Korean helpers ──────────────────────────────────────────────
function _wfBatchim(word) {
  var s = String(word || '').trim();
  if (!s) return null;
  var code = s.charCodeAt(s.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return null;
  return (code - 0xAC00) % 28 !== 0;
}
// Attach a particle that depends on the final consonant.
function _wfJosa(word, josa) {
  if (!josa) return word;
  if (josa.indexOf('/') < 0) return word + josa;          // 에, 에서 … invariant
  var b = _wfBatchim(word);
  var pair = josa.split('/');
  if (b === null) return word + '(' + josa + ')';
  return word + (b ? pair[0] : pair[1]);
}

function _wfSentences(text) {
  return String(text || '').split(/[.!?。\n]+/).filter(function (s) {
    return (s.match(/[가-힣]/g) || []).length >= 2;
  });
}

// Free, conservative checks only — anything ambiguous is left to the AI.
var WF_EUL_WORDS = /(마을|가을|노을|고을|이을)$/;
function _wfQuickCheck(text) {
  var tips = [], seen = {};
  var re = /([가-힣]+?)(을|를)(?=[\s.,!?]|$)/g, m;
  while ((m = re.exec(text))) {
    var stem = m[1], josa = m[2];
    if (WF_EUL_WORDS.test(stem + josa)) continue;
    var b = _wfBatchim(stem);
    if (b === null) continue;
    var want = b ? '을' : '를';
    if (want !== josa && !seen[stem + josa]) {
      seen[stem + josa] = 1;
      tips.push('<b>' + _wfE(stem + josa) + '</b> → ' + _wfE(stem) + '<b>' + want + '</b> ('
        + (b ? 'ends in a consonant → 을' : 'ends in a vowel → 를') + ')');
    }
  }
  var re2 = /([가-힣]+)예요/g;
  while ((m = re2.exec(text))) {
    if (_wfBatchim(m[1]) && !seen[m[0]]) {
      seen[m[0]] = 1;
      tips.push('<b>' + _wfE(m[0]) + '</b> → ' + _wfE(m[1]) + '<b>이에요</b> (consonant → 이에요)');
    }
  }
  return tips;
}

// Checklist token match. "@reason" = any ~아서/어서 form, contracted ones
// included (끝나서, 가서, 바빠서) — listing endings can't cover them all.
function _wfHas(text, token) {
  if (token === '@reason') {
    return String(text).split(/[\s.,!?]+/).some(function (w) {
      return w.length >= 2 && /[가-힣]서$/.test(w) && !/에서$/.test(w);
    });
  }
  return String(text).indexOf(token) >= 0;
}

// ── Content ─────────────────────────────────────────────────────
function _wfFallbackContent() {
  var lvl = _currentLevel || 'Beginner';
  var ai = (typeof _aiContent !== 'undefined' && _aiContent) || {};
  var n = WF_MIN_SENTENCES[lvl] || 3;
  return {
    fallback: true,
    format: { label: 'Short answer · ' + n + '–' + (n + 2) + ' sentences', hint: 'Answer the question in your own words.' },
    min_sentences: n,
    models: (ai.helpers || []).slice(0, 3).map(function (h) { return { ko: h.ko, en: h.en, hl: [] }; }),
    patterns: (ai.grammar || []).slice(0, 3).map(function (g) {
      return { name: g.pattern, exp: g.explanation, ex_ko: g.example_ko, ex_en: g.example_en, match: [] };
    }),
    frames: [],
    words: [],
    checklist: [],
    model_answer: ''
  };
}

async function _wfLoadContent() {
  var topic = (_todayTopic && _todayTopic.topic_ko) || '';
  var lvl = _currentLevel || 'Beginner';
  var key = topic + '|' + lvl;
  if (key in _wfCache) return _wfCache[key] || _wfFallbackContent();
  var pack = null;
  try {
    var sb = getSupa();
    if (sb && topic) {
      var r = await sb.from('writing_topic_content').select('content')
        .eq('topic_ko', topic).eq('level', lvl).limit(1);
      pack = (r && r.data && r.data[0] && r.data[0].content) || null;
    }
  } catch (_) {}
  _wfCache[key] = pack;
  return pack || _wfFallbackContent();
}

// Reviewed pack for this week's topic + level, or null (shared cache with
// the writing flow). Used by Topic Yum Yum for its practice sentences.
async function khTopicPack() {
  var c = await _wfLoadContent();
  return (c && !c.fallback) ? c : null;
}
try { window.khTopicPack = khTopicPack; } catch (_) {}

// This week's words: pack words + lesson vocab (deduped, short list).
function _wfWords() {
  var out = [], seen = {};
  var ai = (typeof _aiContent !== 'undefined' && _aiContent) || {};
  (ai.vocab || []).forEach(function (v) {
    var w = v && (v.ko || v.word);
    if (w && !seen[w]) { seen[w] = 1; out.push(String(w)); }
  });
  return out.slice(0, 8);
}

// ── Open / close ────────────────────────────────────────────────
async function khOpenWritingFlow() {
  if (typeof closeLearningSelector === 'function') { try { closeLearningSelector(); } catch (_) {} }
  if (!supaUser) { openAuthModal('signin'); return; }
  if (!ensureStudyUnlocked()) return;
  var submitted = (typeof _wmWeekSubmitted === 'function') && _wmWeekSubmitted();
  if (!submitted && !canEnterWritingRoom()) return;
  _wfMount();
  _wf = { step: 1, c: null, picks: [], text: '', fb: null, sub: submitted };
  _wfRenderLoading();
  _wf.c = await _wfLoadContent();
  _wf.picks = (_wf.c.frames || []).map(function (f) { return f.parts.map(function () { return ''; }); });
  _wf.text = _wfLoadText();
  if (submitted) { _wf.step = 4; _wfLoadSubmitted(); return; }
  _wfRender();
}
try { window.khOpenWritingFlow = khOpenWritingFlow; } catch (_) {}

function khCloseWritingFlow() {
  var ov = document.getElementById('wf-overlay');
  if (ov) ov.remove();
  document.body.style.overflow = '';
  if (typeof renderTodayPlan === 'function') { try { renderTodayPlan(); } catch (_) {} }
}

function _wfMount() {
  _wfInjectCss();
  var ov = document.getElementById('wf-overlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'wf-overlay';
  ov.className = 'wf-overlay';
  ov.innerHTML = '<div class="wf-modal" role="dialog" aria-modal="true" aria-label="Weekly writing"><div id="wf-inner"></div></div>';
  ov.addEventListener('click', function (e) { if (e.target === ov) khCloseWritingFlow(); });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}

function _wfTextKey() { return 'kh_wf_text_' + (supaUser ? supaUser.id : 'g') + '_' + kstWeekKey() + '_' + (_currentLevel || 'Beginner'); }
function _wfLoadText() {
  try {
    var t = localStorage.getItem(_wfTextKey());
    if (t) return t;
    var d = (getAllDrafts().express_practice || [])[0];
    return (d && d.text) || '';
  } catch (_) { return ''; }
}
function _wfSaveText() {
  try {
    if (_wf.text.trim()) localStorage.setItem(_wfTextKey(), _wf.text);
    else localStorage.removeItem(_wfTextKey());
  } catch (_) {}
}

// ── Rendering ───────────────────────────────────────────────────
function _wfHasFrames() { return !!(_wf && _wf.c && _wf.c.frames && _wf.c.frames.length); }

function _wfHeader(title, sub) {
  var bars = '';
  for (var i = 1; i <= 4; i++) {
    var skip = i === 2 && !_wfHasFrames();
    bars += '<i class="' + (i <= _wf.step ? 'on' : '') + (skip ? ' skip' : '') + '"></i>';
  }
  return '<div class="wf-hd">'
    + '<button type="button" class="wf-x" onclick="khCloseWritingFlow()" aria-label="Close"><i data-lucide="x"></i></button>'
    + '<div class="wf-steps">' + bars + '</div>'
    + '<div class="wf-lbl">Step ' + _wf.step + ' of 4 · ' + WF_STEP_NAMES[_wf.step - 1] + '</div>'
    + '<div class="wf-ttl">' + title + '</div>'
    + (sub ? '<div class="wf-sub">' + sub + '</div>' : '')
    + '</div>';
}

function _wfSet(html) {
  var box = document.getElementById('wf-inner');
  if (box) box.innerHTML = html;
  var bd = box && box.querySelector('.wf-bd');
  if (bd) bd.scrollTop = 0;
}

function _wfRenderLoading() {
  _wfSet('<div class="wf-hd"><button type="button" class="wf-x" onclick="khCloseWritingFlow()" aria-label="Close"><i data-lucide="x"></i></button>'
    + '<div class="wf-lbl">Weekly writing</div><div class="wf-ttl">Loading…</div></div>'
    + '<div class="wf-bd"><div class="wf-wait"><span class="wf-spin"></span></div></div>');
}

function _wfRender() {
  if (!_wf) return;
  if (_wf.step === 1) return _wfStep1();
  if (_wf.step === 2) return _wfStep2();
  if (_wf.step === 3) return _wfStep3();
  return _wfStep4();
}

function _wfGo(step) {
  if (!_wf) return;
  if (step === 2 && !_wfHasFrames()) step = _wf.step < 2 ? 3 : 1;
  if (step === 3 && !_wf.text.trim()) {
    var pre = _wfFrameSentences().join(' ');
    if (pre) { _wf.text = pre + ' '; _wfSaveText(); }
  }
  _wf.step = step;
  _wfRender();
}

function _wfHighlight(ko, hl) {
  var out = _wfE(ko);
  (hl || []).forEach(function (h) {
    if (!h) return;
    var e = _wfE(h);
    var i = out.indexOf(e);
    if (i >= 0) out = out.slice(0, i) + '<span class="wf-hl">' + e + '</span>' + out.slice(i + e.length);
  });
  return out;
}

function _wfSpeakBtn(text) {
  return '<button type="button" class="wf-play" aria-label="Listen" onclick="srSpeak(this.dataset.t,this)" data-t="' + _wfE(text) + '"><i data-lucide="volume-2"></i></button>';
}

function _wfStep1() {
  var c = _wf.c, t = _todayTopic || {};
  var html = _wfHeader(_wfE(t.topic_ko || 'This week’s topic'), _wfE(t.topic_en || ''))
    + '<div class="wf-bd">'
    + '<div class="wf-card wf-fmt"><span class="wf-ico"><i data-lucide="pen-line"></i></span><div><b>This week: ' + _wfE(c.format.label) + '</b><span>' + _wfE(c.format.hint) + '</span></div></div>';
  if (c.models && c.models.length) {
    html += '<div class="wf-sec">Listen to a model answer</div>';
    c.models.forEach(function (m) {
      html += '<div class="wf-card wf-model">' + _wfSpeakBtn(m.ko)
        + '<div><div class="wf-ko">' + _wfHighlight(m.ko, m.hl) + '</div><div class="wf-en">' + _wfE(m.en) + '</div></div></div>';
    });
  }
  if (c.patterns && c.patterns.length) {
    html += '<div class="wf-sec">Patterns you’ll use</div><div class="wf-pats">';
    c.patterns.forEach(function (p, i) {
      html += '<button type="button" class="wf-pat" onclick="_wfTogglePat(' + i + ')"><b>' + _wfE(p.name) + '</b><span>' + _wfE(p.exp || '') + '</span>'
        + '<div class="wf-pat-ex" id="wf-pat-' + i + '" hidden><div class="wf-ko">' + _wfE(p.ex_ko || '') + '</div><div class="wf-en">' + _wfE(p.ex_en || '') + '</div></div></button>';
    });
    html += '</div>';
  }
  html += '<div class="wf-foot"><button type="button" class="wf-btn" onclick="_wfGo(2)">'
    + (_wfHasFrames() ? 'Next: fill the frames' : 'Next: write your answer') + ' <i data-lucide="arrow-right"></i></button></div>'
    + '</div>';
  _wfSet(html);
}

function _wfTogglePat(i) {
  var el = document.getElementById('wf-pat-' + i);
  if (el) el.hidden = !el.hidden;
}

// Build a frame's sentence from the picks (null if a slot is still empty).
function _wfFrameText(fi, allowEmpty) {
  var f = _wf.c.frames[fi], picks = _wf.picks[fi], out = '';
  for (var i = 0; i < f.parts.length; i++) {
    var p = f.parts[i];
    if (typeof p === 'string') { out += p; continue; }
    var v = (picks[i] || '').trim();
    if (!v) { if (!allowEmpty) return null; out += '___'; continue; }
    out += _wfJosa(v, p.josa);
  }
  return out;
}
function _wfFrameSentences() {
  if (!_wfHasFrames()) return [];
  return _wf.c.frames.map(function (_, i) { return _wfFrameText(i); }).filter(Boolean);
}

function _wfStep2() {
  var html = _wfHeader('Make it about you', 'Tap a word or type your own — particles fit automatically.')
    + '<div class="wf-bd">';
  _wf.c.frames.forEach(function (f, fi) {
    var line = '';
    f.parts.forEach(function (p, pi) {
      if (typeof p === 'string') { line += _wfE(p); return; }
      var v = (_wf.picks[fi][pi] || '').trim();
      line += v ? '<span class="wf-blank done">' + _wfE(_wfJosa(v, p.josa)) + '</span>' : '<span class="wf-blank">&nbsp;</span>';
    });
    html += '<div class="wf-card"><div class="wf-frame" id="wf-fr-' + fi + '">' + line + '</div><div class="wf-en">' + _wfE(f.en || '') + '</div>';
    f.parts.forEach(function (p, pi) {
      if (typeof p === 'string') return;
      var cur = (_wf.picks[fi][pi] || '').trim();
      html += '<div class="wf-chips">';
      (p.options || []).forEach(function (o) {
        html += '<button type="button" class="wf-chip' + (cur === o ? ' used' : '') + '" onclick="_wfPick(' + fi + ',' + pi + ',this.dataset.v)" data-v="' + _wfE(o) + '">' + _wfE(o) + '</button>';
      });
      var custom = cur && (p.options || []).indexOf(cur) < 0 ? cur : '';
      html += '<input class="wf-own" type="text" placeholder="Your own…" value="' + _wfE(custom) + '" oninput="_wfOwn(' + fi + ',' + pi + ',this.value)" lang="ko"></div>';
    });
    html += '</div>';
  });
  html += '<div class="wf-tip" id="wf-josa-tip">Particles like 이/가 and 을/를 change with the last sound: after a consonant use 이 / 을, after a vowel use 가 / 를.</div>'
    + '<div class="wf-foot"><button type="button" class="wf-btn ghost" onclick="_wfGo(1)"><i data-lucide="arrow-left"></i> Back</button>'
    + '<button type="button" class="wf-btn" onclick="_wfGo(3)">Next: write your own <i data-lucide="arrow-right"></i></button></div>'
    + '</div>';
  _wfSet(html);
}

function _wfRefreshFrame(fi) {
  var el = document.getElementById('wf-fr-' + fi);
  if (!el) return;
  var f = _wf.c.frames[fi], line = '';
  f.parts.forEach(function (p, pi) {
    if (typeof p === 'string') { line += _wfE(p); return; }
    var v = (_wf.picks[fi][pi] || '').trim();
    line += v ? '<span class="wf-blank done">' + _wfE(_wfJosa(v, p.josa)) + '</span>' : '<span class="wf-blank">&nbsp;</span>';
  });
  el.innerHTML = line;
}

function _wfPick(fi, pi, v) {
  _wf.picks[fi][pi] = (_wf.picks[fi][pi] === v) ? '' : v;
  var bd = document.querySelector('#wf-inner .wf-bd');
  var y = bd ? bd.scrollTop : 0;
  _wfStep2();
  bd = document.querySelector('#wf-inner .wf-bd');
  if (bd) bd.scrollTop = y;
}
function _wfOwn(fi, pi, v) {
  _wf.picks[fi][pi] = v;
  _wfRefreshFrame(fi);
}

function _wfStep3() {
  var c = _wf.c, lim = getWriteCharLimit();
  var lead = _wfFrameSentences().length ? 'Your frames are already in — add a sentence or two.' : 'Answer in your own words. Short and natural is great.';
  var html = _wfHeader('Your answer', lead)
    + '<div class="wf-bd wf-write">'
    + '<div class="wf-wmain">'
    + '<textarea id="wf-ta" class="wf-ta" lang="ko" maxlength="' + lim.max + '" placeholder="여기에 써 보세요…" oninput="_wfOnInput(this.value)">' + _wfE(_wf.text) + '</textarea>'
    + '<div class="wf-meter"><span id="wf-count"></span><span>Goal: ' + _wfE(c.format.label.split('·').pop().trim()) + '</span></div>'
    + '<div class="wf-tip" id="wf-qc" hidden></div>'
    + '</div>'
    + '<div class="wf-wside">'
    + '<div class="wf-sec">Checklist</div><div class="wf-card wf-check" id="wf-check"></div>'
    + '<div id="wf-words-wrap"></div>'
    + (c.model_answer || (c.models && c.models.length) ? '<button type="button" class="wf-btn ghost sm" onclick="_wfPeekModels()"><i data-lucide="eye"></i> Peek at the model sentences</button><div id="wf-peek"></div>' : '')
    + '</div>'
    + '<div class="wf-foot"><button type="button" class="wf-btn ghost" onclick="_wfGo(' + (_wfHasFrames() ? 2 : 1) + ')"><i data-lucide="arrow-left"></i> Back</button>'
    + '<button type="button" class="wf-btn" id="wf-submit" onclick="_wfSubmit()">Submit for feedback <i data-lucide="send"></i></button></div>'
    + '<div class="wf-note">One submission per week · feedback appears on the next screen</div>'
    + '</div>';
  _wfSet(html);
  _wfOnInput(_wf.text);
  var ta = document.getElementById('wf-ta');
  if (ta && window.matchMedia && window.matchMedia('(min-width: 768px)').matches) {
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
}

function _wfPeekModels() {
  var el = document.getElementById('wf-peek');
  if (!el) return;
  if (el.innerHTML) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="wf-card">' + (_wf.c.models || []).map(function (m) {
    return '<div class="wf-ko sm">' + _wfE(m.ko) + '</div>';
  }).join('') + '</div>';
}

var _wfQcTimer = null;
function _wfOnInput(v) {
  _wf.text = v || '';
  _wfSaveText();
  var c = _wf.c, lim = getWriteCharLimit();
  var nS = _wfSentences(_wf.text).length, nC = _wf.text.trim().length;
  var cnt = document.getElementById('wf-count');
  if (cnt) cnt.textContent = nS + ' sentence' + (nS === 1 ? '' : 's') + ' · ' + nC + ' chars';
  // Checklist
  var items = (c.checklist || []).map(function (it) {
    var ok = (it.any || []).some(function (s) { return _wfHas(_wf.text, s); });
    return { label: it.label + (it.optional ? ' — optional' : ''), ok: ok, opt: !!it.optional };
  });
  items.unshift({ label: 'At least ' + (c.min_sentences || 2) + ' sentences', ok: nS >= (c.min_sentences || 2) });
  var words = (c.words && c.words.length ? c.words : _wfWords());
  var used = words.filter(function (w) {
    var stem = /.다$/.test(w) ? w.slice(0, -1) : w;   // 쉬다 → 쉬 (matches 쉬어요)
    return _wf.text.indexOf(stem) >= 0;
  });
  var ck = document.getElementById('wf-check');
  if (ck) ck.innerHTML = items.map(function (it) {
    return '<div class="wf-ck' + (it.ok ? ' ok' : '') + (it.opt ? ' opt' : '') + '"><i>' + (it.ok ? '<i data-lucide="check"></i>' : '') + '</i>' + _wfE(it.label) + '</div>';
  }).join('');
  var ww = document.getElementById('wf-words-wrap');
  if (ww && !(c.words && c.words.length) && words.length) {
    ww.innerHTML = '<div class="wf-sec">This week’s words</div><div class="wf-chips">' + words.map(function (w) {
      return '<span class="wf-chip' + (used.indexOf(w) >= 0 ? ' used' : '') + '">' + _wfE(w) + '</span>';
    }).join('') + '</div>';
  }
  var btn = document.getElementById('wf-submit');
  if (btn) btn.disabled = !(nC >= lim.min && nS >= (c.min_sentences || 2));
  clearTimeout(_wfQcTimer);
  _wfQcTimer = setTimeout(function () {
    var qc = document.getElementById('wf-qc');
    if (!qc) return;
    var tips = _wfQuickCheck(_wf.text);
    qc.hidden = !tips.length;
    qc.innerHTML = tips.length ? '<b>Quick check:</b> ' + tips.join(' · ') : '';
  }, 400);
}

// ── Submit + feedback ───────────────────────────────────────────
async function _wfSubmit() {
  if (!_wf || window._wmSubmitting) return;
  var text = _wf.text.trim(), lim = getWriteCharLimit();
  if (text.length < lim.min) { showToast('A little more! At least ' + lim.min + ' characters.'); return; }
  if (_wmWeekSubmitted()) { _wf.sub = true; _wf.step = 4; _wfLoadSubmitted(); return; }
  window._wmSubmitting = true;
  var btn = document.getElementById('wf-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  saveDraft('express_practice', {
    text: text,
    topic_ko: (_todayTopic && _todayTopic.topic_ko) || '',
    topic_en: (_todayTopic && _todayTopic.topic_en) || '',
    writing_mode: 'topic',
    context_key: 'express_' + kstWeekKey(),
    context: { flow: 'writing_flow', pack: !_wf.c.fallback }
  });
  var res;
  try {
    res = await _submitWeeklyPackage({ lenient: true });
  } catch (e) {
    showToast('Submit error: ' + (e.message || e));
    window._wmSubmitting = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Submit for feedback'; }
    return;
  }
  try { markStageDone('topic'); } catch (_) {}
  try { playCorrectSound(); } catch (_) {}
  try { localStorage.removeItem(_wfTextKey()); } catch (_) {}
  if (typeof _wmClearAutosave === 'function') _wmClearAutosave();
  _wf.sub = true; _wf.step = 4; _wf.fb = 'loading';
  _wfRender();
  try {
    var fb = res.id ? await _triggerPackageFeedback(res.id, res.items) : null;
    if (_wf) { _wf.fb = fb || 'pending'; _wfRender(); }
  } finally {
    window._wmSubmitting = false;
  }
}

async function _wfLoadSubmitted() {
  _wf.fb = 'loading';
  _wfRender();
  var sb = getSupa();
  try {
    var r = await sb.from('user_submissions')
      .select('ai_feedback, context_data')
      .eq('user_id', supaUser.id).eq('study_date', kstWeekKey())
      .in('content_type', ['daily_package', 'writing'])
      .order('submitted_at', { ascending: false }).limit(1);
    var row = r && r.data && r.data[0];
    if (row) {
      try {
        var items = JSON.parse(row.context_data || '{}').items || [];
        var mine = items.find(function (it) { return it.type === 'express_practice'; }) || items[0];
        if (mine) _wf.text = mine.text;
      } catch (_) {}
    }
    _wf.fb = (row && row.ai_feedback) || 'pending';
  } catch (_) { _wf.fb = 'pending'; }
  if (_wf) _wfRender();
}

function _wfActivity(fb) {
  var acts = (fb && Array.isArray(fb.activities)) ? fb.activities : [];
  return acts.find(function (a) { return a && (a.type === 'express_practice' || /express/i.test(a.activity_name || '')); }) || acts[0] || null;
}

function _wfNorm(s) { return String(s || '').replace(/[\s.,!?~]/g, ''); }

function _wfStep4() {
  var fb = _wf.fb;
  if (fb === 'loading' || !fb) {
    _wfSet(_wfHeader('Checking your writing…', 'This takes about 10–20 seconds.')
      + '<div class="wf-bd"><div class="wf-wait"><span class="wf-spin"></span></div>'
      + '<div class="wf-card"><div class="wf-sec">What you wrote</div><div class="wf-ko sm">' + _wfE(_wf.text) + '</div></div></div>');
    return;
  }
  if (fb === 'pending') {
    _wfSet(_wfHeader('Submitted', 'Feedback isn’t ready yet — it will appear here when it is.')
      + '<div class="wf-bd"><div class="wf-card"><div class="wf-sec">What you wrote</div><div class="wf-ko sm">' + _wfE(_wf.text) + '</div></div>'
      + _wfModelBlock()
      + '<div class="wf-foot"><button type="button" class="wf-btn" onclick="khCloseWritingFlow()">Done</button></div></div>');
    return;
  }
  var a = _wfActivity(fb) || {};
  var corr = (Array.isArray(a.corrections) ? a.corrections : []).filter(function (x) { return x && x.original && x.corrected; });
  var title = corr.length ? (corr.length === 1 ? 'Nice work — 1 thing to fix' : 'Nice work — ' + corr.length + ' things to fix') : 'Great job — no mistakes found';
  var html = _wfHeader(title, corr.length ? 'Fix them yourself to lock them in.' : _wfE(a.overall || fb.overall_assessment || ''))
    + '<div class="wf-bd">';
  if (corr.length && (a.overall || fb.overall_assessment)) html += '<div class="wf-sub2">' + _wfE(a.overall || fb.overall_assessment) + '</div>';
  corr.slice(0, 5).forEach(function (x, i) {
    var tag = String(x.pattern || '').replace(/_/g, ' ');
    html += '<div class="wf-card"><div class="wf-corr">' + (tag ? '<span class="wf-tag">' + _wfE(tag) + '</span>' : '')
      + '<span class="wf-del">' + _wfE(x.original) + '</span> → <span class="wf-ins">' + _wfE(x.corrected) + '</span></div>'
      + (x.reason ? '<div class="wf-why">' + _wfE(x.reason) + '</div>' : '')
      + '<input class="wf-rw" type="text" lang="ko" placeholder="Type the fixed version" data-c="' + _wfE(x.corrected) + '" data-o="' + _wfE(x.original) + '" oninput="_wfCheckRw(this)" id="wf-rw-' + i + '">'
      + '</div>';
  });
  if (a.naturalness && a.naturalness.comment) html += '<div class="wf-tip">' + _wfE(a.naturalness.comment) + '</div>';
  html += _wfModelBlock(a.corrected_full);
  if (corr.length && typeof logQuizResult === 'function') {
    html += '<div class="wf-saved"><i data-lucide="check-circle-2"></i> Mistakes are saved to your Growth Lab.</div>';
  }
  html += '<div class="wf-foot"><button type="button" class="wf-btn" onclick="khCloseWritingFlow()">Finish this week’s writing</button></div>'
    + '</div>';
  _wfSet(html);
}

function _wfModelBlock(corrected) {
  var ma = _wf.c && _wf.c.model_answer;
  if (!ma && !corrected) return '';
  return '<button type="button" class="wf-btn ghost" onclick="var n=this.nextElementSibling;n.hidden=!n.hidden">Compare with a model answer</button>'
    + '<div hidden>'
    + (corrected ? '<div class="wf-card"><div class="wf-sec">Your text, corrected</div><div class="wf-ko sm">' + _wfE(corrected) + '</div></div>' : '')
    + (ma ? '<div class="wf-card"><div class="wf-sec">Model answer</div><div class="wf-model">' + _wfSpeakBtn(ma) + '<div class="wf-ko sm">' + _wfE(ma) + '</div></div></div>' : '')
    + '</div>';
}

function _wfCheckRw(el) {
  var v = _wfNorm(el.value), c = _wfNorm(el.dataset.c), o = _wfNorm(el.dataset.o);
  // Passes when the fix is there and the original mistake is gone (unless
  // the original is contained in the fix itself, e.g. 먹어요 → 먹었어요).
  var ok = !!v && v.indexOf(c) >= 0 && (c.indexOf(o) >= 0 || v.indexOf(o) < 0);
  el.classList.toggle('ok', ok);
}

// ── Styles (scoped, injected once) ──────────────────────────────
function _wfInjectCss() {
  if (document.getElementById('wf-css')) return;
  var s = document.createElement('style');
  s.id = 'wf-css';
  s.textContent = ''
    + '.wf-overlay{position:fixed;inset:0;z-index:10050;background:rgba(5,10,25,.62);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.wf-modal{width:100%;max-width:760px;max-height:min(92vh,900px);border-radius:22px;overflow:hidden;background:linear-gradient(180deg,#0f1d3a,#0a1428);color:#e2e8f0;box-shadow:0 24px 60px rgba(0,0,0,.45);display:flex;flex-direction:column;font-family:"DM Sans","Noto Sans KR",sans-serif}'
    + '#wf-inner{display:flex;flex-direction:column;min-height:0;flex:1}'
    + '.wf-hd{position:relative;padding:18px 56px 14px 22px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}'
    + '.wf-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}'
    + '.wf-x svg{width:18px;height:18px}'
    + '.wf-steps{display:flex;gap:6px;margin-bottom:10px;max-width:280px}'
    + '.wf-steps i{flex:1;height:4px;border-radius:9px;background:rgba(255,255,255,.12)}'
    + '.wf-steps i.on{background:#8b5cf6}.wf-steps i.skip{opacity:.35}'
    + '.wf-lbl{font-size:11px;font-weight:800;letter-spacing:.08em;color:#a78bfa;text-transform:uppercase}'
    + '.wf-ttl{font-family:"Noto Sans KR",sans-serif;font-size:19px;font-weight:800;color:#fff;margin-top:3px;line-height:1.35}'
    + '.wf-sub{font-size:12.5px;color:rgba(255,255,255,.6);margin-top:4px}'
    + '.wf-sub2{font-size:13px;color:rgba(255,255,255,.75)}'
    + '.wf-bd{padding:16px 22px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}'
    + '.wf-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 14px}'
    + '.wf-fmt{display:flex;align-items:center;gap:12px;background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.35)}'
    + '.wf-fmt b{font-size:13.5px;color:#fff;display:block}.wf-fmt span{font-size:12px;color:rgba(255,255,255,.62);display:block;margin-top:1px}'
    + '.wf-ico{width:32px;height:32px;border-radius:9px;background:#8b5cf6;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff}.wf-ico svg{width:17px;height:17px}'
    + '.wf-sec{font-size:11px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:.06em;text-transform:uppercase;margin-top:4px}'
    + '.wf-card .wf-sec{margin:0 0 6px}'
    + '.wf-model{display:flex;gap:10px;align-items:flex-start}'
    + '.wf-ko{font-family:"Noto Sans KR",sans-serif;font-size:15.5px;font-weight:700;color:#fff;line-height:1.55}.wf-ko.sm{font-size:14.5px;font-weight:500;line-height:1.75}'
    + '.wf-en{font-size:12px;color:rgba(255,255,255,.55);margin-top:2px}'
    + '.wf-hl{color:#c4b5fd;background:rgba(139,92,246,.2);border-radius:3px}'
    + '.wf-play{width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}.wf-play svg{width:15px;height:15px}'
    + '.wf-pats{display:flex;flex-direction:column;gap:6px}'
    + '.wf-pat{text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:9px 12px;color:#e2e8f0;cursor:pointer;font:inherit}'
    + '.wf-pat b{font-family:"Noto Sans KR",sans-serif;font-size:14px;color:#fff;margin-right:8px}.wf-pat span{font-size:12px;color:rgba(255,255,255,.6)}'
    + '.wf-pat-ex{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.15)}.wf-pat-ex .wf-ko{font-size:14px}'
    + '.wf-frame{font-family:"Noto Sans KR",sans-serif;font-size:16px;color:#fff;line-height:2}'
    + '.wf-blank{display:inline-block;min-width:64px;border-bottom:2px dashed #a78bfa;color:#c4b5fd;text-align:center;font-weight:700;padding:0 4px}'
    + '.wf-blank.done{border-bottom-style:solid;color:#86efac;border-color:#4ade80}'
    + '.wf-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}'
    + '.wf-chip{font-family:"Noto Sans KR",sans-serif;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#e2e8f0;cursor:pointer}'
    + 'span.wf-chip{cursor:default}'
    + '.wf-chip.used{background:rgba(74,222,128,.14);border-color:rgba(74,222,128,.45);color:#86efac}'
    + '.wf-own{flex:1;min-width:110px;max-width:180px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.25);border-radius:999px;padding:6px 12px;color:#fff;font:600 13px "Noto Sans KR",sans-serif;outline:none}'
    + '.wf-own:focus{border-color:#a78bfa;border-style:solid}'
    + '.wf-tip{font-size:12.5px;line-height:1.55;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#fde68a;border-radius:10px;padding:9px 11px}'
    + '.wf-tip b{color:#fff}.wf-modal [hidden]{display:none!important}'
    + '.wf-foot{display:flex;gap:8px;margin-top:auto;padding-top:6px}'
    + '.wf-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:14px;border-radius:14px;border:0;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;font:800 15px "DM Sans",sans-serif;cursor:pointer}'
    + '.wf-btn svg{width:17px;height:17px}.wf-btn:disabled{opacity:.45;cursor:not-allowed}'
    + '.wf-btn.ghost{flex:0 0 auto;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);font-size:13.5px;padding:11px 14px}'
    + '.wf-bd>.wf-btn.ghost,.wf-wside>.wf-btn.ghost{width:100%}'
    + '.wf-btn.sm{padding:9px 12px;font-size:12.5px}'
    + '.wf-ta{width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1.5px solid rgba(167,139,250,.5);border-radius:14px;padding:12px 14px;font:500 16px/1.85 "Noto Sans KR",sans-serif;color:#fff;min-height:200px;resize:vertical;outline:none}'
    + '.wf-ta:focus{border-color:#a78bfa;box-shadow:0 0 0 3px rgba(139,92,246,.2)}'
    + '.wf-meter{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:rgba(255,255,255,.55);margin:6px 2px 8px}'
    + '.wf-check{display:flex;flex-direction:column;gap:7px}'
    + '.wf-ck{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.78)}'
    + '.wf-ck>i{width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0}'
    + '.wf-ck>i svg{width:12px;height:12px;stroke-width:3}'
    + '.wf-ck.ok>i{background:#22c55e;border-color:#22c55e;color:#fff}.wf-ck.opt:not(.ok){color:rgba(255,255,255,.5)}'
    + '.wf-note{font-size:11.5px;color:rgba(255,255,255,.45);text-align:center}'
    + '.wf-write{display:grid;grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto;gap:10px}.wf-write .wf-foot{align-self:end}'
    + '.wf-wside{display:flex;flex-direction:column;gap:8px}'
    + '.wf-corr{font-family:"Noto Sans KR",sans-serif;font-size:15px;line-height:1.7;color:#fff}'
    + '.wf-tag{display:inline-block;font:800 10px "DM Sans",sans-serif;padding:2px 7px;border-radius:6px;background:rgba(56,189,248,.16);color:#7dd3fc;margin-right:6px;letter-spacing:.04em;vertical-align:2px}'
    + '.wf-del{text-decoration:line-through;color:#fca5a5}.wf-ins{color:#86efac;font-weight:700}'
    + '.wf-why{font-size:12.5px;color:rgba(255,255,255,.65);margin-top:3px}'
    + '.wf-rw{width:100%;box-sizing:border-box;margin-top:8px;background:rgba(255,255,255,.04);border:1.5px dashed rgba(255,255,255,.25);border-radius:10px;padding:8px 10px;font:500 14.5px "Noto Sans KR",sans-serif;color:#fff;outline:none}'
    + '.wf-rw.ok{border-style:solid;border-color:#4ade80;background:rgba(74,222,128,.08)}'
    + '.wf-saved{font-size:12.5px;color:#86efac;display:flex;gap:6px;align-items:center}.wf-saved svg{width:15px;height:15px}'
    + '.wf-wait{display:flex;justify-content:center;padding:28px 0}'
    + '.wf-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:#a78bfa;animation:wfspin .9s linear infinite}'
    + '@keyframes wfspin{to{transform:rotate(360deg)}}'
    + '@media (min-width:768px){'
    + '.wf-write{grid-template-columns:1fr 250px;grid-template-rows:auto 1fr auto;align-items:start}'
    + '.wf-write .wf-foot,.wf-write .wf-note{grid-column:1/-1}'
    + '.wf-ta{min-height:300px}'
    + '}'
    + '@media (max-width:767px){'
    + '.wf-overlay{padding:0;align-items:stretch}'
    + '.wf-modal{max-width:none;max-height:none;height:100%;border-radius:0}'
    + '.wf-hd{padding:14px 52px 12px 16px}.wf-bd{padding:14px 16px 16px}'
    + '.wf-ttl{font-size:17px}'
    + '}';
  document.head.appendChild(s);
}
