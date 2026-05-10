/* ============================================================
   KoreHani — Fill-in-the-Blank exercise (article reader)
   Extracted from korehan-shared.js (was lines 3139-3622).

   Teaser card on the article body, 5-question generator, type
   or multiple-choice answer modes, English-translated sentence
   bridge for advanced learners, and result panel with retry +
   share-to-clipboard. Quiz JSON is persisted in article_cache
   under cache_key='fill_…' so repeat attempts skip the API.

   Two adjacent helpers were nested in the same source range
   even though they belong to neighbouring features — kept here
   to preserve their original surface API (admin-mounted onclicks
   in renderArticlePage call them by name):
   - checkArticleSummary       — Review tab "summary check"
   - startArticleListeningQuiz — Review tab listening quiz

   External deps (resolved at runtime via global scope):
   - callClaude                 — from korehan-shared.js
   - getFromCache,
     upsertArticleCacheRow      — from js/core/article-cache.js
   - escapeHTML                 — from js/core/security.js
   - khAlert                    — from js/core/modals.js
   - toast                      — from korehan-shared.js
   - _reviewFlowAdvance         — from korehan-shared.js
   - ttsSpeak                   — from korehan-shared.js
   - artListenPick              — from korehan-shared.js
   ============================================================ */

// ── Fill-in-the-Blank Teaser (기사 하단) ─────────────────────────────────────
// Rendered inside the Review tab's .rv-check shell, so the teaser should
// match that card's clean "intro line + start button" pattern (same as
// the Listening card). The previous teaser's dark navy gradient /
// decorative emojis / bespoke pill made this one card look like it
// belonged to a different section.
function initFillTeaser(article) {
  var teaser = document.getElementById('fill-teaser');
  if (!teaser) return;

  var level = (article && article.level) || 'Beginner';
  var levelLabel = ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]) || level;

  teaser.innerHTML =
      '<div class="rv-fill-teaser">'
    +   '<div class="rv-fill-teaser-copy">6 AI-generated questions mixing vocabulary and grammar from this article.</div>'
    +   '<div class="rv-fill-teaser-meta"><span class="rv-fill-level">' + _khEsc(levelLabel) + '</span><span>· 6 questions · vocab + grammar</span></div>'
    +   '<button id="fill-start-btn" class="rv-start-btn" onclick="startFillExercise()">Start Fill-in-the-Blank</button>'
    + '</div>';
}

async function checkArticleSummary() {
  var ta = document.getElementById('art-summary-ta');
  var fb = document.getElementById('art-summary-feedback');
  if (!ta || !fb) return;
  var text = ta.value.trim();
  if (!text) { fb.innerHTML = '<span style="color:#dc2626">Please write a summary first.</span>'; return; }
  fb.innerHTML = '<span style="color:var(--gray)">Checking...</span>';
  var art = window._currentArticle;
  var articleText = art ? (art.title + ' ' + (art.body || '') + ' ' + (art.full || '')).slice(0, 1000) : '';
  try {
    var r = await callClaude({feature:'summary-check', model:'claude-haiku-4-5-20251001', max_tokens:400,
      messages:[{role:'user', content:'You are a Korean teacher. A student summarized this Korean article:\n\nARTICLE: '+articleText+'\n\nSTUDENT SUMMARY: '+text+'\n\nGive feedback in English:\n1. Key points covered? (list what they got and missed)\n2. Grammar mistakes (if any, show correction)\n3. Overall score: Excellent/Good/Needs improvement\n\nKeep feedback concise (under 150 words).'}]});
    var feedback = (r.content||[]).map(function(c){return c.text||'';}).join('');
    fb.innerHTML = '<div style="background:var(--light);border-radius:10px;padding:12px 14px;line-height:1.7;white-space:pre-wrap">'+feedback.replace(/</g,'&lt;')+'</div>';
  } catch(e) { fb.innerHTML = '<span style="color:#dc2626">Error: '+e.message+'</span>'; }
}

function startArticleListeningQuiz() {
  var el = document.getElementById('art-listening-quiz');
  if (!el) return;
  var vocabItems = [];
  document.querySelectorAll('#art-vocab-list .art-vocab-item').forEach(function(item){
    var ko = item.querySelector('.art-vocab-ko');
    var en = item.querySelector('.art-vocab-en');
    if (ko && en) vocabItems.push({ko:ko.textContent.trim(), en:en.textContent.trim()});
  });
  if (!vocabItems.length) { el.innerHTML='<div style="color:#94a3b8;font-size:13px">No vocabulary available. Switch to Vocab tab first.</div>'; return; }
  var items = vocabItems.slice(0,5);
  var qi = 0;
  function renderQ() {
    if (qi >= items.length) {
      el.innerHTML='<div style="text-align:center;padding:16px"><div style="font-size:18px;font-weight:800;color:#16a34a;margin-bottom:4px">Quiz Complete!</div><div style="font-size:13px;color:#64748b">Great listening practice!</div></div>';
      _reviewFlowAdvance(3);
      return;
    }
    var v = items[qi];
    var opts = items.map(function(x){return x.en;}).sort(function(){return Math.random()-.5;}).slice(0,3);
    if (opts.indexOf(v.en)<0) opts[Math.floor(Math.random()*3)] = v.en;
    el.innerHTML='<div style="text-align:center;margin-bottom:12px"><div style="font-size:12px;color:var(--gray);margin-bottom:8px">Listen and pick the meaning ('+(qi+1)+'/'+items.length+')</div>'
      +'<button onclick="ttsSpeak(\''+v.ko.replace(/'/g,"\\'")+'\')" style="padding:12px 24px;background:var(--light);border:1.5px solid var(--border);border-radius:12px;font-size:16px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:18px;height:18px;color:#3b82f6">'+KH_ICON_VOLUME+'</span><span>Play</span></button></div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'+opts.map(function(o){
        return '<button onclick="artListenPick(this,\''+o.replace(/'/g,"\\'")+'\',\''+v.en.replace(/'/g,"\\'")+'\')" style="padding:10px 14px;background:#fff;border:1px solid var(--border);border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;text-align:left">'+o+'</button>';
      }).join('')+'</div>';
  }
  window.artListenPick = function(btn,picked,correct){
    if(picked===correct){btn.style.background='#dcfce7';btn.style.borderColor='#22c55e';btn.style.fontWeight='700';}
    else{btn.style.background='#fee2e2';btn.style.borderColor='#ef4444';}
    qi++; setTimeout(renderQ,800);
  };
  renderQ();
}

function startFillExercise() {
  // teaser 숨기고 로딩 시작
  var teaser = document.getElementById('fill-teaser');
  if (teaser) teaser.style.display = 'none';

  var content = document.getElementById('fill-content');
  if (!content) return;

  // 로딩 표시 붙이기
  var loadDiv = document.createElement('div');
  loadDiv.id = 'fill-exercise-area';
  content.appendChild(loadDiv);

  loadFillExercise(loadDiv);
}


// ══ FILL-IN-THE-BLANK ENGINE ══════════════════════════════════════════════════

async function loadFillExercise(container) {
  var el = container || document.getElementById('fill-exercise-area') || document.getElementById('fill-content');
  if (!el) return;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  if (_fillLoaded && _fillArticleId === id) return;
  _fillLoaded = false;
  _fillArticleId = id;

  var all = getCachedArticles();
  var a = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px">Article not found.</p>'; return; }

  el.innerHTML = renderFillLoading();

  // ── DB 캐시 확인 ──────────────────────────────────────────
  var cacheKey = 'fill_' + (a.level || 'intermediate').toLowerCase();
  try {
    var cached = await getFromCache('article', a.id, cacheKey);
    if (cached && cached.questions && cached.questions.length) {
      _fillLoaded = true;
      renderFillQuestions(el, cached.questions, a);
      return;
    }
  } catch(e) {}

  if (!supaUser) {
    el.innerHTML = renderFillNoKey();
    return;
  }

  var level = a.level || 'Intermediate';
  var text = (a.body || '') + (a.full ? ' ' + a.full : '');

  var prompt = `You are a Korean language teacher creating fill-in-the-blank exercises from a Korean news article.

Article level: ${level}
Article text: "${text.slice(0, 1200)}"

Generate exactly 6 fill-in-the-blank questions from this article. Mix vocabulary gaps (important nouns/verbs) and grammar gaps (particles, verb endings, connectives).

Rules:
- For Starter: only basic nouns and verbs the student just learned (가족, 숫자, 색깔), ~이에요/예요 endings only, no particles
- For Beginner: focus on common vocabulary and basic particles (은/는/이/가/을/를/에서/에)
- For Intermediate: mix vocabulary with grammar patterns (으로/에게/한테/도/만/부터/까지)  
- For Advanced: focus on advanced grammar endings (-으면서/-는데/-아/어서/-기 때문에/-ㄹ 수록)
- Each blank should be a single word or short phrase (1-4 syllables)
- The blank should appear naturally in a sentence from the article
- 4 answer choices: 1 correct + 3 plausible wrong answers

Respond ONLY with this JSON (no markdown, no extra text):
{"questions":[
  {
    "sentence": "Korean sentence with _____ where blank goes",
    "sentence_en": "English translation with _____ where blank goes",
    "blank": "correct answer",
    "blank_en": "English meaning of correct answer",
    "type": "vocab OR grammar",
    "grammar_point": "Korean grammar point name if type=grammar, e.g. '-아/어서' or '은/는 topic marker', else null",
    "choices": ["correct","wrong1","wrong2","wrong3"],
    "hint": "brief hint in English (e.g. 'object marker' or 'means economy')"
  }
]}`;

  try {
    var data = await callClaude({
      feature: 'quiz',
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    var raw = (data.content || []).map(function(c){ return c.text || ''; }).join('');
    var clean = raw.replace(/```json|```/g, '').trim();
    var parsed = JSON.parse(clean);
    _fillLoaded = true;
    renderFillQuestions(el, parsed.questions, a);

    // ── DB에 캐시 저장 ────────────────────────────────────
    try {
      if (parsed.questions) {
        upsertArticleCacheRow(a.id, { quiz: JSON.stringify({ questions: parsed.questions }) });
      }
    } catch(e) {}
  } catch(e) {
    if (e && (e.message === 'unauthorized' || e.message === 'Not signed in')) {
      if (supaUser) {
        // User is logged in but got a token error — don't sign them out, just ask to retry
        el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:16px;height:16px">'+KH_ICON_WARNING+'</span><span>Session error. Please reload the page and try again.</span></span><button onclick="window.location.reload()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">Reload</button></div>';
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      } else {
        el.innerHTML = renderFillNoKey();
        if (typeof openAuthModal === 'function') openAuthModal('signin');
      }
      return;
    }
    el.innerHTML = khEmptyState({
      error: true,
      title: 'Could not generate exercise',
      sub: 'Something went wrong while building the questions for this article.',
      action: { label: 'Try again', onClick: 'loadFillExercise()' },
    });
  }
}

function renderFillLoading() {
  return khLoadingHTML(
    'Generating fill-in-the-blank',
    'Analyzing key vocabulary and grammar from this article — takes a few seconds.'
  );
}

function renderFillNoKey() {
  return khEmptyState({
    title: 'Sign in for Fill-in-the-Blank',
    sub: 'AI-generated practice is available for signed-in users.',
    action: { label: 'Sign in', onClick: "openAuthModal('signin')" },
  });
}

// ── 빈칸 문제 렌더링 ──────────────────────────────────────────────────────
var _fillLoaded = false;
var _fillArticleId = null;
var _fillState = {}; // { qIdx: { selected, correct, mode } }
var _fillQuestions = [];

function renderFillQuestions(container, questions, article) {
  _fillQuestions = questions;
  _fillState = {};
  questions.forEach(function(_, i){ _fillState[i] = { selected: null, correct: null, mode: 'choice' }; });

  var level = article.level || 'Beginner';
  var levelColor = level === 'Beginner' ? '#2e7d32' : level === 'Advanced' ? '#c62828' : '#f57f17';

  var html = '<div style="padding:4px 0">'
    // 헤더
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">'
    + '<div>'
    + '<div style="font-size:17px;font-weight:900;color:#0b1626;margin-bottom:3px;display:inline-flex;align-items:center;gap:8px"><span style="display:inline-flex;width:18px;height:18px">'+KH_ICON_PENCIL+'</span><span>Fill in the Blank</span></div>'
    + '<div style="font-size:12px;color:#94a3b8">' + questions.length + ' key expressions from this article</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:#f0f4ff;color:' + levelColor + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]||level) + '</span>'
    + '<button onclick="resetFill()" style="font-size:11px;font-weight:700;padding:5px 14px;border:2px solid #e2e8f0;border-radius:999px;background:#fff;cursor:pointer;color:#64748b;display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_REFRESH+'</span><span>Reset</span></button>'
    + '</div>'
    + '</div>'

    // 진행 바
    + '<div id="fill-progress-bar" style="height:4px;background:#e2e8f0;border-radius:999px;margin-bottom:24px;overflow:hidden">'
    + '<div id="fill-progress-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#2255a4,#3d7fd4);border-radius:999px;transition:width .4s"></div>'
    + '</div>';

  // 문제들
  questions.forEach(function(q, i) {
    // choices 섞기
    var shuffled = q.choices.slice().sort(function(){ return Math.random() - .5; });

    html += '<div class="fill-q" id="fill-q-' + i + '" style="background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:16px;transition:border-color .2s">'
      // 타입 배지
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
      + '<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:999px;background:' + (q.type==='grammar'?'#f3e8ff;color:#9333ea':'#e8f0fb;color:#2255a4') + '">'
      + (q.type === 'grammar' ? '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_RULER+'</span><span>Grammar</span></span>' : '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_BOOK+'</span><span>Vocabulary</span></span>') + '</span>'
      + '<span style="font-size:11px;color:#94a3b8;font-weight:600">' + (i+1) + ' / ' + questions.length + '</span>'
      + '</div>'

      // 문장 (빈칸 포함)
      + '<div style="font-size:20px;font-weight:700;color:#0b1626;line-height:1.6;margin-bottom:6px;word-break:keep-all">'
      + formatFillSentence(q.sentence, i)
      + '</div>'
      + '<div style="font-size:13px;color:#94a3b8;margin-bottom:4px;font-style:italic">'
      + formatFillSentenceEn(q.sentence_en, i)
      + '</div>'

      // 힌트
      + '<div style="font-size:11px;color:#60a5fa;margin-bottom:16px;font-weight:600;display:flex;align-items:center;gap:5px"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_BULB+'</span><span>' + q.hint + '</span></div>'

      // 모드 토글 버튼
      + '<div style="display:flex;gap:6px;margin-bottom:12px">'
      + '<button onclick="setFillMode(' + i + ',\'choice\')" id="fill-mode-choice-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #2255a4;background:#2255a4;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><span style="display:inline-flex;width:12px;height:12px">'+KH_ICON_TARGET+'</span><span>Multiple Choice</span></button>'
      + '<button onclick="setFillMode(' + i + ',\'type\')" id="fill-mode-type-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer">⌨️ Type Answer</button>'
      + '</div>'

      // Multiple Choice 영역
      + '<div id="fill-choices-' + i + '" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + shuffled.map(function(ch) {
          return '<button onclick="checkFillAnswer(' + i + ',\'' + ch.replace(/'/g, "\\'") + '\')" '
            + 'style="padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;background:#f8faff;'
            + 'font-size:14px;font-weight:700;cursor:pointer;color:#0b1626;transition:all .15s;font-family:inherit">'
            + ch + '</button>';
        }).join('')
      + '</div>'

      // Type Answer 영역
      + '<div id="fill-type-' + i + '" style="display:none">'
      + '<div style="display:flex;gap:8px">'
      + '<input id="fill-input-' + i + '" type="text" placeholder="Type in Korean..." '
      + 'style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:15px;font-family:sans-serif;outline:none" '
      + 'onkeydown="if(event.key===\'Enter\')submitFillType(' + i + ')">'
      + '<button onclick="submitFillType(' + i + ')" style="padding:10px 18px;background:#2255a4;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">Check</button>'
      + '</div>'
      + '</div>'

      // 결과 영역
      + '<div id="fill-result-' + i + '" style="display:none;margin-top:12px"></div>'

      + '</div>';
  });

  html += '<div id="fill-final" style="display:none"></div></div>';
  container.innerHTML = html;
}

function formatFillSentence(sentence, qIdx) {
  return sentence.replace('_____', '<span id="fill-blank-' + qIdx + '" style="display:inline-block;min-width:60px;border-bottom:3px solid #2255a4;text-align:center;padding:0 4px;margin:0 4px;color:#2255a4;font-weight:900">　　</span>');
}
function formatFillSentenceEn(sentence_en, qIdx) {
  return (sentence_en||'').replace('_____', '<span style="border-bottom:2px solid #cbd5e1;padding:0 4px;color:#94a3b8">_____</span>');
}

function setFillMode(qIdx, mode) {
  _fillState[qIdx].mode = mode;
  var choiceEl = document.getElementById('fill-choices-' + qIdx);
  var typeEl   = document.getElementById('fill-type-' + qIdx);
  var btnChoice = document.getElementById('fill-mode-choice-' + qIdx);
  var btnType   = document.getElementById('fill-mode-type-' + qIdx);
  if (mode === 'choice') {
    choiceEl.style.display = 'grid';
    typeEl.style.display   = 'none';
    btnChoice.style.background = '#2255a4'; btnChoice.style.color = '#fff'; btnChoice.style.borderColor = '#2255a4';
    btnType.style.background   = '#fff';    btnType.style.color = '#64748b'; btnType.style.borderColor = '#e2e8f0';
  } else {
    choiceEl.style.display = 'none';
    typeEl.style.display   = 'block';
    btnType.style.background   = '#2255a4'; btnType.style.color = '#fff'; btnType.style.borderColor = '#2255a4';
    btnChoice.style.background = '#fff';    btnChoice.style.color = '#64748b'; btnChoice.style.borderColor = '#e2e8f0';
    setTimeout(function(){ var inp = document.getElementById('fill-input-' + qIdx); if(inp) inp.focus(); }, 50);
  }
}

function submitFillType(qIdx) {
  var inp = document.getElementById('fill-input-' + qIdx);
  if (!inp) return;
  var val = inp.value.trim();
  if (!val) return;
  checkFillAnswer(qIdx, val, true);
}

function checkFillAnswer(qIdx, selected, isTyped) {
  var q = _fillQuestions[qIdx];
  if (!q || _fillState[qIdx].selected !== null) return; // 이미 답한 문제

  var correct = q.blank;
  // 정답 판정: 과도한 부분 매칭 제거(오답이 정답으로 처리되는 이슈 방지)
  var normalize = function(v){ return String(v||'').trim().toLowerCase().replace(/\s+/g,' '); };
  var isCorrect = normalize(selected) === normalize(correct);

  _fillState[qIdx].selected = selected;
  _fillState[qIdx].correct  = isCorrect;

  // grammar point 기록 (localStorage + Supabase)
  if (q.type === 'grammar') {
    var gKey = q.grammar_point || q.hint || '';
    if (gKey) {
      try {
        var gStats = JSON.parse(localStorage.getItem('kh_quiz_grammar_stats') || '{}');
        if (!gStats[gKey]) gStats[gKey] = { correct:0, wrong:0 };
        isCorrect ? gStats[gKey].correct++ : gStats[gKey].wrong++;
        localStorage.setItem('kh_quiz_grammar_stats', JSON.stringify(gStats));
      } catch(e) {}
      if (supaUser) {
        try {
          var _sb = getSupa();
          if (_sb) _sb.rpc('log_quiz_result', {
            p_user_id: supaUser.id, p_quiz_type: 'fill_blank',
            p_grammar_point: gKey, p_is_correct: isCorrect
          });
        } catch(e) {}
      }
    }
  }

  // 빈칸에 정답 표시
  var blankEl = document.getElementById('fill-blank-' + qIdx);
  if (blankEl) {
    blankEl.textContent = correct;
    blankEl.style.color = isCorrect ? '#16a34a' : '#dc2626';
    blankEl.style.borderBottomColor = isCorrect ? '#16a34a' : '#dc2626';
    blankEl.style.background = isCorrect ? '#f0fdf4' : '#fff5f5';
    blankEl.style.borderRadius = '4px';
    blankEl.style.padding = '0 6px';
  }

  // 카드 테두리 색 변경
  var card = document.getElementById('fill-q-' + qIdx);
  if (card) card.style.borderColor = isCorrect ? '#86efac' : '#fca5a5';

  // Multiple Choice 버튼 색 변경
  if (!isTyped) {
    var choicesEl = document.getElementById('fill-choices-' + qIdx);
    if (choicesEl) {
      Array.from(choicesEl.querySelectorAll('button')).forEach(function(btn) {
        btn.disabled = true;
        if (btn.textContent === correct) {
          btn.style.background = '#f0fdf4'; btn.style.borderColor = '#86efac'; btn.style.color = '#16a34a';
        } else if (btn.textContent === selected && !isCorrect) {
          btn.style.background = '#fff5f5'; btn.style.borderColor = '#fca5a5'; btn.style.color = '#dc2626';
        } else {
          btn.style.opacity = '.45';
        }
      });
    }
  }

  // 결과 + 설명
  var resultEl = document.getElementById('fill-result-' + qIdx);
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = (isCorrect
      ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="display:inline-flex;width:18px;height:18px;color:#22c55e">'+KH_ICON_CHECK+'</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#16a34a;margin-bottom:2px">Correct!</div>'
        + '<div style="font-size:12px;color:#166534"><strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
      : '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="display:inline-flex;width:18px;height:18px;color:#dc2626">'+KH_ICON_X+'</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#dc2626;margin-bottom:2px">'
        + (isTyped ? 'Incorrect (your answer: ' + selected + ')' : 'Incorrect')
        + '</div>'
        + '<div style="font-size:12px;color:#991b1b">Answer: <strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
    );
  }

  // 진행 바 업데이트
  updateFillProgress();

  // 전체 완료 체크
  var answeredCount = Object.values(_fillState).filter(function(s){ return s.selected !== null; }).length;
  if (answeredCount === _fillQuestions.length) {
    setTimeout(function(){ showFillResult(); }, 600);
  }
}

function updateFillProgress() {
  var answered = Object.values(_fillState).filter(function(s){ return s.selected !== null; }).length;
  var pct = answered / _fillQuestions.length * 100;
  var fillBar = document.getElementById('fill-progress-fill');
  if (fillBar) fillBar.style.width = pct + '%';
}

async function showFillResult() {
  // The big "Exercise Complete!" celebration card with Try Again / Back
  // to Article buttons used to flash here before _reviewFlowAdvance(2)
  // hid the whole fill section and revealed the next step. The
  // interstitial added nothing — the next step's reveal animation
  // gives enough completion signal, and the buttons (Try Again,
  // Back to Article) duplicate already-available navigation. Drop it
  // and just advance.
  var correct = Object.values(_fillState).filter(function(s){ return s.correct; }).length;
  var total = _fillQuestions.length;
  var pct = Math.round(correct / total * 100);

  // 퀴즈 완료 뱃지/XP
  if (typeof trackActivityOnQuizComplete === 'function') trackActivityOnQuizComplete(pct);
  await dmTrackFill();
  _reviewFlowAdvance(2);
}

function resetFill() {
  _fillLoaded = false;
  _fillArticleId = null;
  // 기존 exercise 영역 비우기
  var area = document.getElementById('fill-exercise-area');
  if (area) area.innerHTML = '';
  loadFillExercise();
}
// ══ END FILL-IN-THE-BLANK ENGINE ═══════════════════════════════════════════════
