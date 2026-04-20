/* kh-article-page.js — Article detail page (quiz/grammar/translation/comments) */
// ── Character Reporter Profiles ───────────────────────────────
// reporter_id on article maps to an entry here.
var KH_REPORTERS = {};           // id → { name, img, href, role, color }
var _KH_REPORTERS_PROMISE = null;
var _KH_REPORTERS_LS_KEY  = 'kh_reporters_cache';

// Default reporter data (matches DEF_CHAR_REPORTERS in admin).
// Always available — no Supabase needed for basic display.
var _KH_DEFAULT_REPORTERS_LIST = [
  { id:'cr1',  name:'박서진', role:'사회부 기자',         image:'https://picsum.photos/seed/cr1/200/200',  profilePage:'', color:'#2563eb' },
  { id:'cr2',  name:'김지원', role:'국제부 특파원',       image:'https://picsum.photos/seed/cr2/200/200',  profilePage:'', color:'#7c3aed' },
  { id:'cr3',  name:'이민준', role:'경제부 에디터',       image:'https://picsum.photos/seed/cr3/200/200',  profilePage:'', color:'#059669' },
  { id:'cr4',  name:'최유나', role:'문화부 기자',         image:'https://picsum.photos/seed/cr4/200/200',  profilePage:'', color:'#db2777' },
  { id:'cr5',  name:'정우성', role:'정치부 선임기자',     image:'https://picsum.photos/seed/cr5/200/200',  profilePage:'', color:'#dc2626' },
  { id:'cr6',  name:'한소희', role:'뷰티·트래블 에디터', image:'https://picsum.photos/seed/cr6/200/200',  profilePage:'', color:'#0891b2' },
  { id:'cr7',  name:'오지훈', role:'스포츠부 기자',       image:'https://picsum.photos/seed/cr7/200/200',  profilePage:'', color:'#ea580c' },
  { id:'cr8',  name:'신지은', role:'사회·환경 전문기자', image:'https://picsum.photos/seed/cr8/200/200',  profilePage:'', color:'#16a34a' },
  { id:'cr9',  name:'강태양', role:'국제·외교 기자',      image:'https://picsum.photos/seed/cr9/200/200',  profilePage:'', color:'#4338ca' },
  { id:'cr10', name:'류하늘', role:'문화·라이프 기자',    image:'https://picsum.photos/seed/cr10/200/200', profilePage:'', color:'#c026d3' },
];

// Seed KH_REPORTERS from defaults immediately (synchronous, always works)
_KH_DEFAULT_REPORTERS_LIST.forEach(function(d) {
  KH_REPORTERS[d.id] = { name:d.name, img:d.image, href:d.profilePage||'korehan-reporters.html', role:d.role, color:d.color };
});

// Then override with localStorage cache if present
(function() {
  try {
    var c = JSON.parse(localStorage.getItem(_KH_REPORTERS_LS_KEY) || 'null');
    if (c && typeof c === 'object') {
      Object.keys(c).forEach(function(rid){ KH_REPORTERS[rid] = c[rid]; });
    }
  } catch(e) {}
})();

// Returns a Promise — resolves after KH_REPORTERS is fresh from Supabase.
// Safe to call multiple times; only one fetch ever happens per page load.
function _loadReportersIntoKHMap() {
  if (_KH_REPORTERS_PROMISE) return _KH_REPORTERS_PROMISE;
  _KH_REPORTERS_PROMISE = new Promise(function(resolve) {
    var sb = getSupa();
    if (!sb) { resolve(); return; }
    sb.from('character_reporters').select('id, data').then(function(res) {
      if (!res.error && res.data && res.data.length > 0) {
        var snap = {};
        res.data.forEach(function(row) {
          var d = row.data || {};
          var rid = d.id || row.id;
          if (!rid) return;
          snap[rid] = KH_REPORTERS[rid] = {
            name : d.name  || '',
            img  : d.image || '',
            href : d.profilePage || 'korehan-reporters.html',
            role : d.role  || '',
            color: d.color || '#2563eb'
          };
        });
        try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap)); } catch(e) {}
        _reRenderReporterSlots();
      } else {
        // Supabase empty/missing — fall back to admin's localStorage key
        try {
          var adminList = JSON.parse(localStorage.getItem('korehan_char_reporters') || 'null');
          if (adminList && adminList.length) {
            var snap2 = {};
            adminList.forEach(function(d) {
              if (!d.id) return;
              snap2[d.id] = KH_REPORTERS[d.id] = { name:d.name||'', img:d.image||'', href:d.profilePage||'korehan-reporters.html', role:d.role||'', color:d.color||'#2563eb' };
            });
            try { localStorage.setItem(_KH_REPORTERS_LS_KEY, JSON.stringify(snap2)); } catch(e) {}
            _reRenderReporterSlots();
          }
        } catch(e2) {}
      }
      resolve();
    }).catch(function(){ resolve(); });
  });
  return _KH_REPORTERS_PROMISE;
}

// After KH_REPORTERS loads, patch any .art-reporter-link[data-rid] already in the DOM
function _reRenderReporterSlots() {
  document.querySelectorAll('.art-reporter-link[data-rid]').forEach(function(el) {
    var rid = el.getAttribute('data-rid');
    if (!rid) return;
    var rep = KH_REPORTERS[rid];
    if (!rep || !rep.name) return;
    var color = rep.color || '#2563eb';
    var avatarEl = el.querySelector('.art-reporter-avatar');
    var nameEl   = el.querySelector('.art-reporter-name');
    var roleEl   = el.querySelector('.art-reporter-role');
    el.href = rep.href || 'korehan-reporters.html';
    if (nameEl) nameEl.textContent = rep.name;
    if (avatarEl) {
      avatarEl.innerHTML = rep.img
        ? '<img src="' + rep.img + '" alt="' + rep.name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
          + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + rep.name.charAt(0) + '</div>'
        : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + rep.name.charAt(0) + '</div>';
    }
    if (rep.role && !roleEl) {
      var rs = document.createElement('span');
      rs.className = 'art-reporter-role';
      rs.textContent = rep.role;
      el.appendChild(rs);
    } else if (rep.role && roleEl) {
      roleEl.textContent = rep.role;
    }
  });
}

// Kick off fetch early (non-blocking background prefetch)
document.addEventListener('DOMContentLoaded', function() { _loadReportersIntoKHMap(); });

function getReporterProfileHTML(article) {
  var rid = article.reporter_id || article.reporter || null;
  var rep = rid ? KH_REPORTERS[rid] : null;
  var name  = (rep && rep.name)  ? rep.name  : 'KoreHani Reporter';
  var img   = (rep && rep.img)   ? rep.img   : null;
  var href  = (rep && rep.href && rep.href !== 'korehan-reporters.html') ? rep.href : (rid ? 'korehan-reporter.html?id=' + rid : 'korehan-reporters.html');
  var color = (rep && rep.color) ? rep.color : '#2563eb';
  var avatar = img
    ? '<img src="' + img + '" alt="' + name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
      + '<div class="art-reporter-avatar-placeholder" style="display:none;background:' + color + '">' + name.charAt(0) + '</div>'
    : '<div class="art-reporter-avatar-placeholder" style="background:' + color + '">' + name.charAt(0) + '</div>';
  // data-rid lets _reRenderReporterSlots() update this element once KH_REPORTERS loads
  return '<a href="' + href + '" class="art-reporter-link"' + (rid ? ' data-rid="' + rid + '"' : '') + '>'
    + '<div class="art-reporter-avatar">' + avatar + '</div>'
    + '<span class="art-reporter-name">' + name + '</span>'
    + (rep && rep.role ? '<span class="art-reporter-role">' + rep.role + '</span>' : '')
    + '</a>';
}

function renderArticlePage() {
  var wrap = document.getElementById('dyn-article');
  if (!wrap) return;

  var params = new URLSearchParams(window.location.search);
  var id     = params.get('id');
  var all    = getCachedArticles();
  var a      = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;

  if (!a) {
    wrap.innerHTML = '<div style="padding:30px">'
      + '<a href="index.html" style="color:#2255a4;text-decoration:none">← Back to Home</a>'
      + '<h1 style="margin-top:16px">Article not found</h1>'
      + '<p style="color:#666;margin-top:8px">This article does not exist or the link is invalid.</p>'
      + '</div>';
    return;
  }

  var img = a.image || ('https://picsum.photos/seed/' + a.id + '/1200/700');
  var dateStr = a.date ? new Date(a.date).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}) : '';

  wrap.innerHTML =
    '<article class="kh-article-wrap">'

    // 브레드크럼
    + '<nav class="art-breadcrumb">'
    + '<a href="index.html">Home</a>'
    + '<span>›</span>'
    + '<a href="korehan-section.html?s=' + encodeURIComponent(a.section) + '">' + sectionLabel(a.section) + '</a>'
    + '</nav>'

    // 카테고리 + 제목
    + '<div class="art-header">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    + '<span class="art-section-badge">' + a.section + '</span>'
    + (a.level ? (function(lv){ var c={'Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828','Starter':'#f3e8ff;color:#6b21a8'}; var dn={'Starter':'Seed','Beginner':'Sprout','Intermediate':'Tree','Advanced':'Forest'}; return '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:'+(c[lv]||'#f0f0f0;color:#666')+'">'+(dn[lv]||lv)+'</span>'; })(a.level) : '')
    + '</div>'
    + '<h1 class="art-title vocab-zone">' + a.title + ' ' + ttsBtn(a.title) + '</h1>'
    + '<div class="art-meta-row">'
    + getReporterProfileHTML(a)
    + '<div class="art-meta-right">'
    + '<span class="art-date">' + dateStr + '</span>'
    + '<span class="art-dot">·</span>'
    + '<span class="art-readtime">' + Math.max(1, Math.ceil((a.full||a.body||'').length / 500)) + ' min read</span>'
    + '</div>'
    + '<div class="art-actions-inline">'
    + '<button class="art-action-icon" id="art-bm-btn" onclick="toggleBookmark(\'' + a.id + '\',this)" title="Bookmark"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>'
    + '<button class="art-action-icon" onclick="shareArticle()" title="Share"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>'
    + '<button class="art-action-icon" id="translate-btn" onclick="toggleTranslate()" title="Translate"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>'
    + '</div>'
    + '</div>'
    + '</div>'

    // 히어로 이미지
    + '<div class="art-hero-img">'
    + '<img src="' + img + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/1200/700\'">'
    + '</div>'

    // 4탭: Read / Grammar / Vocab / Quiz
    + '<div class="art-tabs">'
    + '<button class="art-tab on" onclick="switchArtTab(\'article\',this)">Read</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'grammar\',this)">Grammar</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'vocab\',this)">Vocab</button>'
    + '<button class="art-tab" onclick="switchArtTab(\'quiz\',this)">Quiz</button>'
    + '</div>'

    // Read 탭
    + '<div id="art-tab-article">'
    + '<div class="art-lead vocab-zone">' + formatArticleBody(a.body || '') + '</div>'
    + (a.full ? '<div class="art-full vocab-zone">' + formatArticleBody(a.full) + '</div>' : '')
    + '</div>'

    // Grammar 탭
    + '<div id="art-tab-grammar" style="display:none">'
    + '<div id="grammar-content"><div style="color:#aaa;padding:20px 0;text-align:center">Loading grammar guide...</div></div>'
    + '</div>'

    // Vocab 탭
    + '<div id="art-tab-vocab" style="display:none">'
    + '<div class="art-vocab-box">'
    + '<div class="art-vocab-title">📚 Key Vocabulary</div>'
    + '<div class="art-vocab-list" id="art-vocab-list"></div>'
    + '</div>'
    + '</div>'

    // Quiz 탭
    + '<div id="art-tab-quiz" style="display:none">'
    + '<div id="fill-wrap">'
    + '<div id="fill-content"><div id="fill-teaser"></div></div>'
    + '</div>'
    + '<div style="margin-top:24px;padding-top:20px;border-top:2px solid var(--border)">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:8px">📝 Article Summary</div>'
    + '<p style="font-size:12px;color:var(--gray);margin-bottom:10px">Summarize this article in 3-5 Korean sentences. AI will check your summary.</p>'
    + '<textarea id="art-summary-ta" style="width:100%;min-height:100px;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:\'Noto Sans KR\',sans-serif;font-size:13px;resize:vertical;box-sizing:border-box" placeholder="Write your summary in Korean..."></textarea>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button onclick="checkArticleSummary()" style="padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Check Summary</button>'
    + '</div>'
    + '<div id="art-summary-feedback" style="margin-top:10px;font-size:13px;line-height:1.6"></div>'
    + '</div>'
    + '<div style="margin-top:24px;padding-top:20px;border-top:2px solid var(--border)">'
    + '<div style="font-size:14px;font-weight:800;margin-bottom:8px">🎧 Listening Quiz</div>'
    + '<p style="font-size:12px;color:var(--gray);margin-bottom:10px">Listen to key vocabulary from this article and identify the meaning.</p>'
    + '<div id="art-listening-quiz"><button onclick="startArticleListeningQuiz()" style="width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Start Listening Quiz</button></div>'
    + '</div>'
    + '</div>'

    // 구분선
    + '<hr class="art-divider">'

    // 댓글 섹션
    + '<section class="art-comments" id="art-comments">'
    + '<h3 class="art-comments-title">💬 Comments <span id="comment-count" style="font-size:16px;color:var(--gray)"></span></h3>'
    + '<div id="comment-form-wrap">'
    + '<div class="comment-login-notice" id="comment-login-notice" style="display:none">'
    + '<p>Sign in to leave a comment — <a href="#" onclick="event.preventDefault();openAuthModal(&apos;signin&apos;)">Sign in</a></p>'
    + '</div>'
    + '<div class="comment-form" id="comment-form" style="display:none">'
    + '<textarea id="comment-input" placeholder="Write a comment..." rows="3"></textarea>'
    + '<button class="comment-submit-btn" onclick="submitComment(\'' + a.id + '\')">Post</button>'
    + '</div>'
    + '</div>'
    + '<div id="comments-list"></div>'
    + '</section>'

    // 관련 기사 추천
    + (function() {
        var all = published().filter(function(r){ return r.id !== a.id; });
        // 같은 섹션 우선 → 없으면 같은 레벨 → 없으면 최신순
        var related = all.filter(function(r){ return r.section === a.section; }).slice(0,3);
        if (related.length < 3) {
          var more = all.filter(function(r){ return r.level === a.level && r.section !== a.section; });
          related = related.concat(more).slice(0,3);
        }
        if (!related.length) related = all.slice(0,3);
        if (!related.length) return '';
        return '<div class="art-related">'
          + '<div class="art-related-title">📰 Related Articles</div>'
          + '<div class="art-related-grid">'
          + related.map(function(r){
              var levelColors = {'Starter':'#f3e8ff;color:#6b21a8','Beginner':'#e8f5e9;color:#2e7d32','Intermediate':'#fff8e1;color:#f57f17','Advanced':'#fce4ec;color:#c62828'};
              return '<a href="' + articleUrl(r.id) + '" class="art-related-card">'
                + '<img src="' + (r.image || 'https://picsum.photos/seed/'+r.id+'/300/200') + '" alt="" onerror="this.src=\'https://picsum.photos/seed/fallback/300/200\'">'
                + '<div class="art-related-info">'
                + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">'
                + '<span style="font-size:10px;font-weight:800;text-transform:uppercase;color:#2255a4">' + r.section + '</span>'
                + (r.level ? '<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:' + (levelColors[r.level]||'#f0f0f0;color:#666') + '">' + ({'Starter':'Seed','Beginner':'Sprout','Intermediate':'Tree','Advanced':'Forest'}[r.level]||r.level) + '</span>' : '')
                + '</div>'
                + '<div class="art-related-title-text">' + r.title + '</div>'
                + '</div>'
                + '</a>';
            }).join('')
          + '</div></div>';
      })()

    + '</article>';

  // 현재 기사 참조 저장 (Quiz 탭에서 사용)
  window._currentArticle = a;

  // 핵심 단어 추출
  renderArticleVocab(a);

  // Highlighted expressions
  applyHighlightedExpressions(a.id);

  // 댓글 로드
  loadComments(a.id);

  // 기사 조회수 기록
  if (supaUser) syncArticleView(a.id, a.title, a.section);


  // 세션 로드 후 북마크/댓글폼/읽음처리 업데이트
  var articleId      = a.id;
  var articleTitle   = a.title;
  var articleSection = a.section;
  var articleLevel   = a.level || '';
  var attempts = 0;
  function waitAndUpdate() {
    attempts++;
    updateCommentForm();
    checkBookmarkState(articleId);
    if (supaUser) {
      markArticleRead(articleId, articleTitle, articleSection, articleLevel);
      // 캐시 없는 기사: 첫 방문 유저가 자동으로 전체 캐시 생성 (공유 캐시)
      _bgPregenArticleCache(a);
    } else if (attempts < 20) {
      setTimeout(waitAndUpdate, 300);
    }
  }
  setTimeout(waitAndUpdate, 300);
}

// 로그인 유저가 기사 열 때, 캐시 없으면 백그라운드 자동 생성 → 모든 유저가 공유
async function _bgPregenArticleCache(a) {
  if (!supaUser || _remoteCacheDisabled) return;
  try {
    var cached = await getFromCache('article', a.id, 'ai_analysis');
    // translation/vocab/grammar/quiz 중 하나라도 있으면 이미 캐시 있음
    if (cached && (cached.translation || (cached.vocab && cached.vocab.length) || (cached.grammar && cached.grammar.length) || cached.quiz)) return;
    // quiz만 따로 확인
    var quizCached = await getFromCache('article', a.id, 'fill_intermediate');
    if (quizCached && quizCached.questions && quizCached.questions.length) return;
  } catch(e) { return; }

  // 캐시 완전 비어있음 → 백그라운드 생성 시작
  var _body  = a.body  || '';
  var _title = a.title || '';
  var _level = a.level || 'Intermediate';
  var _patch = {};

  async function _call(instr, maxTok) {
    try {
      var r = await callClaude({
        feature: 'bg-cache', model: 'claude-haiku-4-5-20251001', max_tokens: maxTok,
        messages: [{ role: 'user', content: 'Korean article (level: ' + _level + ')\nTitle: ' + _title + '\n\nBODY START\n' + _body.slice(0, 3000) + '\nBODY END\n\n---\n' + instr }]
      });
      return (r && r.content && r.content[0] && r.content[0].text) || '';
    } catch(e) { return ''; }
  }

  function _json(text) {
    try {
      var ai = text.indexOf('['), bi = text.lastIndexOf(']');
      var oi = text.indexOf('{'), ei = text.lastIndexOf('}');
      if (ai >= 0 && bi > ai && (oi < 0 || ai < oi)) return JSON.parse(text.slice(ai, bi+1));
      if (oi >= 0 && ei > oi) return JSON.parse(text.slice(oi, ei+1));
    } catch(e) {}
    return null;
  }

  try {
    var t = await _call('Translate each paragraph into English. Return ONLY a JSON array of strings, one per paragraph. No other text.', 800);
    var ta = _json(t);
    if (ta) _patch.translation = JSON.stringify({ texts: Array.isArray(ta) ? ta : [ta] });
  } catch(e) {}

  try {
    var v = await _call(window.KH_VOCAB.promptText(_level, _body), 1600);
    var va = _json(v);
    var cleaned = window.KH_VOCAB.validateBest(va, _body || '');
    if (cleaned && cleaned.length) _patch.vocab = JSON.stringify(cleaned);
  } catch(e) {}

  try {
    var g = await _call('Find 3 grammar patterns. Return ONLY: {"patterns":[{"name":"KO+romanization","level":"Starter|Beginner|Intermediate|Advanced","exp":"explanation","ex_ko":"sentence","ex_en":"translation"}]}. No other text.', 900);
    var ga = _json(g);
    if (ga && ga.patterns) _patch.grammar = JSON.stringify(ga);
  } catch(e) {}

  try {
    var q = await _call('Create 10 fill-in-the-blank questions. Return ONLY: {"questions":[{"sentence":"Korean with _____","sentence_en":"English with _____","blank":"answer","blank_en":"meaning","choices":["correct","wrong1","wrong2","wrong3"]}]}. No other text.', 2000);
    var qa = _json(q);
    if (qa && qa.questions) _patch.quiz = JSON.stringify(qa);
  } catch(e) {}

  if (Object.keys(_patch).length > 0) {
    await upsertArticleCacheRow(a.id, _patch);
  }
}

function formatArticleBody(text) {
  if (!text) return '';
  // Strip dangerous tags but keep basic formatting
  text = sanitizeHTML(text);
  // \n\n 기준으로 먼저 분리
  var paras = text.split(/\n\n+/);
  if (paras.length <= 1) {
    // 한국어/영어 마침표 기준으로 문단 나누기
    // 마침표 뒤에 공백이나 줄바꿈이 있으면 단락 구분
    paras = text
      .replace(/([.!?。다요죠]\s)/g, '$1\n')
      .split('\n')
      .filter(function(p){ return p.trim().length > 10; }); // 너무 짧은 조각 제거
  }
  if (paras.length <= 1) {
    // 그래도 1개면 그냥 전체를 하나의 단락으로
    return '<p style="margin-bottom:18px">' + text.trim() + '</p>';
  }
  return paras.map(function(p){
    return '<p style="margin-bottom:18px">' + p.trim().replace(/\n/g,'<br>') + '</p>';
  }).join('');
}

function switchArtTab(tab, btn) {
  document.querySelectorAll('.art-tab').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  var tabs = ['article','grammar','vocab','quiz'];
  tabs.forEach(function(t){ var el = document.getElementById('art-tab-' + t); if(el) el.style.display = 'none'; });
  var active = document.getElementById('art-tab-' + tab);
  if (active) active.style.display = 'block';
  if (tab === 'grammar') loadGrammarGuide();
  if (tab === 'quiz') { var teaser = document.getElementById('fill-teaser'); if (teaser && !teaser.innerHTML) initFillTeaser(window._currentArticle); }
}


// ── Fill-in-the-Blank Teaser (기사 하단) ─────────────────────────────────────
function initFillTeaser(article) {
  var teaser = document.getElementById('fill-teaser');
  if (!teaser) return;

  var level = article.level || 'Beginner';
  var levelColor = level === 'Beginner' ? '#2e7d32' : level === 'Advanced' ? '#c62828' : '#d97706';
  var levelBg    = level === 'Beginner' ? '#e8f5e9' : level === 'Advanced' ? '#fce4ec' : '#fff8e1';

  teaser.innerHTML =
    '<div style="background:linear-gradient(135deg,#0b1626 0%,#1a3a6b 100%);border-radius:20px;padding:28px 28px 24px;position:relative;overflow:hidden">'
    // 배경 데코
    + '<div style="position:absolute;right:-20px;top:-20px;font-size:100px;opacity:.06;line-height:1">✏️</div>'
    + '<div style="position:absolute;left:-10px;bottom:-15px;font-size:80px;opacity:.04;line-height:1">📝</div>'
    // 내용
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">'
    + '<div style="flex:1;min-width:200px">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    + '<span style="font-size:22px">✏️</span>'
    + '<span style="font-size:11px;font-weight:800;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:2px">Review Practice</span>'
    + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.3">Fill-in-the-Blank</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:16px">'
    + 'Test your vocabulary and grammar from this article.<br>6 AI-generated questions, automatically.'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:' + levelBg + ';color:' + levelColor + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]||level) + '</span>'
    + '<span style="font-size:11px;color:rgba(255,255,255,.4)">· 6 questions · vocab + grammar</span>'
    + '</div>'
    + '</div>'
    + '<div style="flex-shrink:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end">'
    + '<button id="fill-start-btn" onclick="startFillExercise()" '
    + 'style="padding:13px 28px;background:#fff;color:#0b1626;border:none;border-radius:999px;'
    + 'font-size:14px;font-weight:900;cursor:pointer;white-space:nowrap;'
    + 'box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .15s"'
    + 'onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    + "Let's Go →</button>"
    + '</div>'
    + '</div>'
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
      return;
    }
    var v = items[qi];
    var opts = items.map(function(x){return x.en;}).sort(function(){return Math.random()-.5;}).slice(0,3);
    if (opts.indexOf(v.en)<0) opts[Math.floor(Math.random()*3)] = v.en;
    el.innerHTML='<div style="text-align:center;margin-bottom:12px"><div style="font-size:12px;color:var(--gray);margin-bottom:8px">Listen and pick the meaning ('+(qi+1)+'/'+items.length+')</div>'
      +'<button onclick="ttsSpeak(\''+v.ko.replace(/'/g,"\\'")+'\')" style="padding:12px 24px;background:var(--light);border:1.5px solid var(--border);border-radius:12px;font-size:16px;cursor:pointer;font-family:inherit">🔊 Play</button></div>'
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
        el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e">⚠️ Session error. Please reload the page and try again.<br><button onclick="window.location.reload()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">Reload</button></div>';
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      } else {
        el.innerHTML = renderFillNoKey();
        if (typeof openAuthModal === 'function') openAuthModal('signin');
      }
      return;
    }
    el.innerHTML = '<div style="padding:24px;text-align:center;color:#e53e3e">⚠️ Failed to generate exercise. Please try again.<br><button onclick="loadFillExercise()" style="margin-top:12px;padding:8px 20px;background:#2255a4;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🔄 Retry</button></div>';
  }
}

function renderFillLoading() {
  return '<div style="padding:40px;text-align:center">'
    + '<div style="font-size:32px;margin-bottom:16px;animation:spin 1s linear infinite;display:inline-block">✨</div>'
    + '<div style="font-size:15px;font-weight:700;color:#2255a4;margin-bottom:6px">Generating fill-in-the-blank exercise...</div>'
    + '<div style="font-size:12px;color:#94a3b8">Analyzing key vocabulary and grammar from this article</div>'
    + '</div>'
    + '<style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
}

function renderFillNoKey() {
  return '<div style="padding:32px;text-align:center;background:#f8faff;border-radius:16px;margin:16px 0">'
    + '<div style="font-size:36px;margin-bottom:12px">🔒</div>'
    + '<div style="font-size:15px;font-weight:800;color:#0b1626;margin-bottom:8px">Sign in required</div>'
    + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">Fill-in-the-Blank is available for signed-in users.</div>'
    + '<button onclick="openAuthModal(\'signin\')" style="padding:10px 24px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Sign In →</button>'
    + '</div>';
}

// ── 빈칸 문제 렌더링 ──────────────────────────────────────────────────────
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
    + '<div style="font-size:17px;font-weight:900;color:#0b1626;margin-bottom:3px">✏️ Fill in the Blank</div>'
    + '<div style="font-size:12px;color:#94a3b8">' + questions.length + ' key expressions from this article</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center">'
    + '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:999px;background:#f0f4ff;color:' + levelColor + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[level]||level) + '</span>'
    + '<button onclick="resetFill()" style="font-size:11px;font-weight:700;padding:5px 14px;border:2px solid #e2e8f0;border-radius:999px;background:#fff;cursor:pointer;color:#64748b">🔄 Reset</button>'
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
      + (q.type === 'grammar' ? '📐 Grammar' : '📖 Vocabulary') + '</span>'
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
      + '<div style="font-size:11px;color:#60a5fa;margin-bottom:16px;font-weight:600">💡 ' + q.hint + '</div>'

      // 모드 토글 버튼
      + '<div style="display:flex;gap:6px;margin-bottom:12px">'
      + '<button onclick="setFillMode(' + i + ',\'choice\')" id="fill-mode-choice-' + i + '" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:2px solid #2255a4;background:#2255a4;color:#fff;cursor:pointer">🎯 Multiple Choice</button>'
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
  // 타이핑 모드는 부분 매칭 허용 (공백/조사 차이 무시)
  var isCorrect = isTyped
    ? (selected === correct || selected.replace(/\s/g,'') === correct.replace(/\s/g,''))
    : (selected === correct);

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
        + '<span style="font-size:18px">✅</span>'
        + '<div><div style="font-size:13px;font-weight:800;color:#16a34a;margin-bottom:2px">Correct!</div>'
        + '<div style="font-size:12px;color:#166534"><strong>' + correct + '</strong> = ' + q.blank_en + '</div></div>'
        + ttsBtn(correct)
        + '</div>'
      : '<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:10px 14px;display:flex;gap:10px;align-items:flex-start">'
        + '<span style="font-size:18px">❌</span>'
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
  var correct = Object.values(_fillState).filter(function(s){ return s.correct; }).length;
  var total = _fillQuestions.length;
  var pct = Math.round(correct / total * 100);
  var emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';
  var color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';

  var finalEl = document.getElementById('fill-final');
  if (!finalEl) return;
  finalEl.style.display = 'block';
  finalEl.innerHTML =
    '<div style="background:linear-gradient(135deg,#0b1626,#1a3a6b);border-radius:16px;padding:28px;text-align:center;margin-top:8px">'
    + '<div style="font-size:48px;margin-bottom:10px">' + emoji + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:4px">Exercise Complete!</div>'
    + '<div style="font-size:36px;font-weight:900;color:' + color + ';margin:12px 0">' + correct + ' / ' + total + '</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:20px">' + pct + '% correct</div>'
    + '<div style="height:6px;background:rgba(255,255,255,.15);border-radius:999px;margin:0 auto 20px;max-width:200px;overflow:hidden">'
    + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:999px;transition:width .8s"></div>'
    + '</div>'
    + '<button onclick="resetFill()" style="padding:11px 28px;background:#fff;color:#0b1626;border:none;border-radius:999px;font-size:13px;font-weight:900;cursor:pointer;margin-right:8px">🔄 Try Again</button>'
    + '<button onclick="switchArtTab(\'article\',document.querySelectorAll(\'.art-tab\')[0])" style="padding:11px 28px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">📰 Back to Article</button>'
    + '</div>';

  // 퀴즈 완료 뱃지/XP
  if (typeof trackActivityOnQuizComplete === 'function') trackActivityOnQuizComplete(pct);
  await dmTrackFill();
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

async function loadGrammarGuide() {
  var el = document.getElementById('grammar-content');
  if (!el) return;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');

  if (el.dataset.loadedId === String(id) && el.dataset.source === 'ai') return;
  el.dataset.loadedId = String(id);
  el.dataset.source = '';

  var all = getCachedArticles();
  var a = id ? all.find(function(x){ return String(x.id) === String(id); }) : null;
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px 0;text-align:center">Article not found.</p>'; return; }

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center">✨ Analyzing grammar...</div>';

  // ── DB 캐시 확인 ──────────────────────────────────────────
  try {
    var cached = await getFromCache('article', a.id, 'grammar_guide');
    if (cached && cached.patterns && cached.patterns.length) {
      el.dataset.source = 'ai';
      renderGrammarGuideHTML(el, cached.patterns);
      return;
    }
  } catch(e) {}
  if (!a) { el.innerHTML = '<p style="color:#aaa;padding:20px 0;text-align:center">Article not found.</p>'; return; }

  el.innerHTML = '<div style="color:#aaa;padding:20px 0;text-align:center">✨ Analyzing grammar with AI...</div>';

  var text = (a.title || '') + '\n\n' + (a.body || '') + '\n\n' + (a.full || '');
  var level = a.level || 'Intermediate';
  var prompt = 'You are a Korean language teacher. Carefully read this specific Korean news article and identify 3-4 grammar patterns that actually appear in THIS article. Do NOT use generic examples — find patterns from the actual sentences in the article.\n\n'
    + 'Article level: ' + level + '\n'
    + 'Article:\n' + text.slice(0, 1200) + '\n\n'
    + 'For each pattern: quote the exact sentence from the article, highlight the grammar point with <strong> tags, and explain it clearly for a ' + level + ' learner.\n\n'
    + 'Respond ONLY in this exact JSON format (no markdown, no extra text):\n'
    + '{"patterns":[{"name":"grammar name in Korean + romanization","level":"Beginner or Intermediate or Advanced","exp":"Clear English explanation in 1-2 sentences.","ex_ko":"Exact sentence from the article with grammar point in <strong> tags","ex_en":"English translation of that sentence"}]}';
  try {
    var res = await callClaude({
      feature: 'grammar',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });
    if (!res.ok && res.status) throw new Error('HTTP ' + res.status);
    var data = res;
    var rawText = '';
    if (data.content && data.content[0] && data.content[0].text) rawText = data.content[0].text;
    else if (data.text) rawText = data.text;
    if (!rawText) throw new Error('empty response');
    var clean = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    var jsonStart = clean.indexOf('{');
    var jsonEnd = clean.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
    var parsed = JSON.parse(clean);
    var guides = parsed.patterns || [];
    el.dataset.source = 'ai';

    renderGrammarGuideHTML(el, guides);

    // ── DB에 캐시 저장 ────────────────────────────────────
    try {
      if (guides.length) {
        upsertArticleCacheRow(a.id, { grammar: JSON.stringify({ patterns: guides }) });
      }
    } catch(e) {}
  } catch(e) {
    if (e && (e.message === 'Not signed in' || e.message === 'unauthorized')) {
      el.dataset.source = ''; // allow retry
      if (supaUser) {
        // User is logged in but got a token error — don't show sign-in prompt
        el.innerHTML = '<div style="text-align:center;padding:28px 16px">'
          + '<div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:8px">Grammar Guide unavailable</div>'
          + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">A session error occurred. Please reload the page and try again.</div>'
          + '<button onclick="loadGrammarGuide()" style="padding:10px 28px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Retry</button>'
          + '</div>';
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      } else {
        el.innerHTML = '<div style="text-align:center;padding:28px 16px">'
          + '<div style="font-size:32px;margin-bottom:12px">🔒</div>'
          + '<div style="font-size:14px;font-weight:700;color:#0b1626;margin-bottom:8px">Sign in to use Grammar Guide</div>'
          + '<div style="font-size:13px;color:#64748b;margin-bottom:20px">AI-powered grammar analysis is available for signed-in users.</div>'
          + '<button onclick="openAuthModal(&apos;signin&apos;)" style="padding:10px 28px;background:linear-gradient(135deg,#2d6be4,#1e4fa3);color:#fff;border:none;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer">Sign In →</button>'
          + '</div>';
      }
    } else {
      renderStaticGrammar(el, a);
    }
  }
}

function renderGrammarGuideHTML(el, guides) {
  el.innerHTML = '<p class="grammar-intro">Grammar patterns found in this article</p>'
    + guides.map(function(g, i){ return renderGrammarGuideCard(g, i); }).join('');
}

function renderGrammarGuideCard(g, idx) {
  var focus = encodeURIComponent(g.name || '');
  var levelColors = { Beginner:'#16a34a', Intermediate:'#d97706', Advanced:'#dc2626' };
  var levelBgs    = { Beginner:'#f0fdf4', Intermediate:'#fffbeb', Advanced:'#fff1f2' };
  var lv = g.level || 'Intermediate';
  var num = (idx !== undefined) ? idx + 1 : '';
  return '<div class="grammar-point">'
    + '<div class="gp-header">'
    + (num ? '<span class="gp-num">' + num + '</span>' : '')
    + '<div class="gp-title-group">'
    + '<span class="grammar-name">' + (g.name || '') + '</span>'
    + '<span class="gp-level-badge" style="background:' + (levelBgs[lv]||'#f0f4ff') + ';color:' + (levelColors[lv]||'#2255a4') + '">' + ({Starter:'Seed',Beginner:'Sprout',Intermediate:'Tree',Advanced:'Forest'}[lv]||lv) + '</span>'
    + '</div>'
    + '</div>'
    + '<p class="grammar-explanation">' + (g.exp || '') + '</p>'
    + '<div class="grammar-example">'
    + '<div class="ge-label">Example</div>'
    + '<p class="ge-ko">' + (g.ex_ko || '') + '</p>'
    + '<p class="ge-en">' + (g.ex_en || '') + '</p>'
    + '</div>'
    + '<div class="gp-footer">'
    + '<a href="korehan-study-room.html?focus=' + focus + '&source=grammar-guide" class="gp-study-btn">Study this grammar →</a>'
    + '</div>'
    + '</div>';
}

function renderStaticGrammar(el, a) {
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var patterns = [
    { pattern:/었|았/, name:'~었/았 Past Tense', level:'Beginner', exp:'Added to verb stems to express past tense, like "-ed" in English. Use 았 after ㅏ/ㅗ vowels, 었 everywhere else.', ex_ko:'경제가 회복됐<strong>어요</strong>.', ex_en:'The economy recovered.' },
    { pattern:/이다|입니다|이에요|예요/, name:'~이에요/예요 "To Be"', level:'Beginner', exp:'Korean equivalent of "is/are". Use 이에요 after a final consonant, 예요 after a vowel.', ex_ko:'서울<strong>이에요</strong>.', ex_en:"It's Seoul." },
    { pattern:/을|를/, name:'을/를 Object Marker', level:'Beginner', exp:'Attaches to the object of a verb. Use 을 after a consonant, 를 after a vowel.', ex_ko:'뉴스<strong>를</strong> 읽어요.', ex_en:'I read the news.' },
    { pattern:/에서/, name:'에서 Location Marker', level:'Beginner', exp:'Marks where an action takes place — like "at" or "in" in English.', ex_ko:'서울<strong>에서</strong> 발표했어요.', ex_en:'It was announced in Seoul.' },
    { pattern:/위한|위해/, name:'~을 위해/위한 "For"', level:'Intermediate', exp:'Means "for the purpose of" or "in order to". 위해 precedes verbs, 위한 precedes nouns.', ex_ko:'경제 회복<strong>을 위한</strong> 방안이에요.', ex_en:"It's a plan for economic recovery." },
    { pattern:/로 인해|로 인한/, name:'~로 인해 "Due to"', level:'Intermediate', exp:'Means "due to" or "because of" — used to state a cause or reason.', ex_ko:'수출 증가<strong>로 인해</strong> 흑자가 됐어요.', ex_en:'Due to export growth, it turned a surplus.' },
    { pattern:/면서|하면서/, name:'~면서 "While"', level:'Intermediate', exp:'Connects two simultaneous actions, like "while" in English.', ex_ko:'일하<strong>면서</strong> 공부해요.', ex_en:'I study while working.' },
    { pattern:/것으로|것이다|것을/, name:'~는 것 Nominalization', level:'Intermediate', exp:'Turns a verb into a noun clause — similar to adding "-ing" in English. 것 means "thing" or "fact".', ex_ko:'결정한 <strong>것으로</strong> 알려졌어요.', ex_en:'It is known that a decision was made.' },
  ];
  var guides = patterns.filter(function(p){ return p.pattern.test(text); }).slice(0, 4);
  if (guides.length < 3) guides = patterns.slice(0, 4);

  el.innerHTML = '<p class="grammar-intro">Grammar patterns in this article:</p>'
    + guides.map(renderGrammarGuideCard).join('');
}

function isWordSaved(ko) {
  // Prefer DB-backed set (synced on auth) for cross-device consistency
  if (_savedWordsSet) return _savedWordsSet.has(ko);
  // Fallback to localStorage for logged-out users or before DB sync completes
  var saved = lsGet(K_SAVED, []);
  return saved.some(function(w){ return (w.ko || w.word_ko || '') === ko; });
}

function renderArticleVocab(a) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.full || '');
  var found = [];
  Object.keys(VOCAB).forEach(function(k) {
    if (text.indexOf(k) !== -1 && found.length < 10) found.push(k);
  });
  if (!found.length) { var box = el.closest('.art-vocab-box'); if(box) box.style.display = 'none'; return; }

  el.innerHTML = found.map(function(k) {
    var v = VOCAB[k];
    var saved = isWordSaved(k);
    var safeK  = k.replace(/'/g, "\\'");
    var safeR  = (v.rom||'').replace(/'/g, "\\'");
    var safeE  = (v.en||'').replace(/'/g, "\\'");
    return '<div class="art-vocab-item" id="avi-' + k + '">'
      + '<div class="avi-main">'
      + '<span class="art-vocab-ko">' + k + '</span>'
      + '<span class="art-vocab-rom">' + (v.rom||'') + '</span>'
      + '<span class="art-vocab-en">' + (v.en||'') + '</span>'
      + '</div>'
      + '<div class="avi-actions">'
      + ttsBtn(k)
      + '<button class="avi-save-btn' + (saved?' saved':'') + '" title="' + (saved?'Saved':'Save word') + '" '
      + 'onclick="handleVocabSave(this,\'' + safeK + '\',\'' + safeR + '\',\'' + safeE + '\')">'
      + (saved ? '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg><span>Saved</span>' : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Save</span>')
      + '</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function _addWordToKeyVocabList(ko, rom, en) {
  var el = document.getElementById('art-vocab-list');
  if (!el) return;
  // 이미 있으면 스킵
  if (document.getElementById('avi-' + ko)) return;
  // 박스 보이게
  var box = el.closest('.art-vocab-box');
  if (box) box.style.display = '';
  var safeK = ko.replace(/'/g, "\\'");
  var safeR = (rom||'').replace(/'/g, "\\'");
  var safeE = (en||'').replace(/'/g, "\\'");
  var item = document.createElement('div');
  item.className = 'art-vocab-item';
  item.id = 'avi-' + ko;
  item.innerHTML =
    '<div class="avi-main">'
    + '<span class="art-vocab-ko">' + ko + '</span>'
    + '<span class="art-vocab-rom">' + (rom||'') + '</span>'
    + '<span class="art-vocab-en">' + (en||'') + '</span>'
    + '</div>'
    + '<div class="avi-actions">'
    + ttsBtn(ko)
    + '<button class="avi-save-btn" title="Save word" '
    + 'onclick="handleVocabSave(this,\'' + safeK + '\',\'' + safeR + '\',\'' + safeE + '\')">'
    + '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>Save</span>'
    + '</button>'
    + '</div>';
  el.insertBefore(item, el.firstChild);
}

async function handleVocabSave(btn, ko, rom, en) {
  var already = btn.classList.contains('saved');
  if (already) {
    if (typeof toast === 'function') toast('Already in your word list.', false);
    return;
  }
  btn.disabled = true;
  await dbSaveWord(ko, rom, en);
  btn.classList.add('saved');
  btn.title = 'Saved';
  btn.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg><span>Saved</span>';
  btn.disabled = false;
  if (typeof toast === 'function') toast('Saved to your word list!', false);
}

// ── Highlighted Expressions ───────────────────────────────────
// Expressions are stored in article_cache.expressions as:
// [{"phrase":"표현","color":"blue","note":"optional note"}]
// Colors: "blue" (default), "green", "amber", "rose"
var _EXPR_COLORS = {
  blue:  { bg:'rgba(37,99,235,.1)',   border:'#93c5fd', text:'#1e40af' },
  green: { bg:'rgba(22,163,74,.1)',   border:'#86efac', text:'#15803d' },
  amber: { bg:'rgba(217,119,6,.1)',   border:'#fcd34d', text:'#92400e' },
  rose:  { bg:'rgba(225,29,72,.1)',   border:'#fda4af', text:'#9f1239' },
};

async function applyHighlightedExpressions(articleId) {
  if (!articleId) return;
  try {
    var exprs = await getFromCache('article', articleId, 'expressions');
    if (!exprs || !exprs.length) return;
    var articleEl = document.getElementById('art-tab-article');
    if (!articleEl) return;
    exprs.forEach(function(ex) {
      if (!ex.phrase) return;
      var c = _EXPR_COLORS[ex.color] || _EXPR_COLORS.blue;
      var safePhrase = ex.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var note = ex.note ? ' title="' + ex.note.replace(/"/g,'&quot;') + '"' : '';
      var html = '<mark class="kh-expr"'
        + ' style="background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + '"'
        + note + '>' + ex.phrase + '</mark>';
      // Walk text nodes and replace
      var walker = document.createTreeWalker(articleEl, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function(n) {
        if (n.nodeValue && n.nodeValue.indexOf(ex.phrase) !== -1) {
          var parent = n.parentNode;
          if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;
          if (parent.closest('.kh-expr')) return;
          var parts = n.nodeValue.split(ex.phrase);
          if (parts.length < 2) return;
          var frag = document.createDocumentFragment();
          parts.forEach(function(part, i) {
            if (part) frag.appendChild(document.createTextNode(part));
            if (i < parts.length - 1) {
              var span = document.createElement('mark');
              span.className = 'kh-expr';
              span.style.cssText = 'background:' + c.bg + ';border-bottom:2px solid ' + c.border + ';color:' + c.text + ';border-radius:3px;padding:0 1px';
              if (ex.note) span.title = ex.note;
              span.textContent = ex.phrase;
              frag.appendChild(span);
            }
          });
          parent.replaceChild(frag, n);
        }
      });
    });
  } catch(e) {}
}

// ── 기사 검색 ─────────────────────────────────────────────────
function doSearch(q) {
  if (!q || !q.trim()) return;
  window.location.href = 'korehan-all.html?search=' + encodeURIComponent(q.trim());
}

function renderSearchResults(q, articles) {
  var filtered = articles.filter(function(a) {
    var text = (a.title || '') + ' ' + (a.body || '') + ' ' + (a.section || '');
    return text.toLowerCase().indexOf(q.toLowerCase()) !== -1;
  });
  return { query: q, results: filtered };
}

// ── 읽은 기사 저장 ─────────────────────────────────────────────
async function markArticleRead(articleId, title, section, level) {
  // localStorage에 오늘 읽은 기사 ID 기록 (데일리 테스트용)
  try {
    var todayKey = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10);
    var readLog = JSON.parse(localStorage.getItem('kh_read_log') || '{}');
    if (!readLog[todayKey]) readLog[todayKey] = [];
    var id = String(articleId);

    if (readLog[todayKey].indexOf(id) === -1) {
      // 오늘 처음 보는 기사 — 조회수 카운터 증가 후 XP 여부 결정
      var artViews = JSON.parse(localStorage.getItem('kh_art_views') || '{}');
      var prevViews = artViews[id] || 0;
      artViews[id] = prevViews + 1;
      localStorage.setItem('kh_art_views', JSON.stringify(artViews));
      var canEarnXP = prevViews < 2; // 총 2일치 읽기만 XP (3일째부터 없음)

      readLog[todayKey].push(id);
      localStorage.setItem('kh_read_log', JSON.stringify(readLog));
      trackActivityOnArticleRead(section, { grantXP: canEarnXP && readLog[todayKey].length <= ARTICLE_XP_DAILY_CAP });
    } else {
      // 오늘 이미 읽은 기사 — 재방문은 artViews 카운트에 포함시키지 않음
      localStorage.setItem('kh_read_log', JSON.stringify(readLog));
    }
  } catch(e) {}

  var sb = getSupa();
  if (!sb || !supaUser) return;
  try {
    // 기존 read_articles 테이블
    await sb.from('read_articles').upsert({
      user_id: supaUser.id,
      article_id: String(articleId),
      title: title || '',
      section: section || '',
      read_at: new Date().toISOString()
    }, { onConflict: 'user_id,article_id' });
  } catch(e) {}
  // learning hub read_history 테이블 (RPC)
  try {
    await sb.rpc('log_read_event', {
      p_user_id: supaUser.id,
      p_content_type: 'article',
      p_content_id: String(articleId),
      p_title: title || '',
      p_level: level || '',
      p_category: section || '',
      p_completed: false
    });
  } catch(e) {} // RPC 미설치 시 조용히 무시
  // Activity pipeline
  if (typeof logActivity === 'function') {
    logActivity('read', { content_type:'article', content_id:String(articleId), content_title:title||'', metadata:{section:section||'',level:level||''} });
  }
}

// ── 영어 번역 토글 ─────────────────────────────────────────────
var translateActive = false;
var translateCache = {};

async function toggleTranslate() {
  var btn = document.getElementById('translate-btn');
  var zones = document.querySelectorAll('.vocab-zone');
  if (!btn || !zones.length) return;

  if (translateActive) {
    // 원문으로 복원
    zones.forEach(function(z) {
      if (z.dataset.original) z.innerHTML = z.dataset.original;
    });
    translateActive = false;
    btn.textContent = '🌐 Translate';
    btn.classList.remove('active');
    return;
  }

  btn.textContent = '⏳ Translating...';
  btn.disabled = true;

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var cacheKey = 'trans_' + id;

  try {
    var sharedCached = await getFromCache('article', id, 'translation_en');
    if (sharedCached && sharedCached.translations && sharedCached.translations.length) {
      translateCache[cacheKey] = sharedCached.translations;
      applyTranslation(zones, sharedCached.translations);
      btn.textContent = '🇰🇷 Back to Korean';
      btn.disabled = false;
      btn.classList.add('active');
      translateActive = true;
      return;
    }
  } catch(e) {}

  if (translateCache[cacheKey]) {
    applyTranslation(zones, translateCache[cacheKey]);
    btn.textContent = '🇰🇷 Back to Korean';
    btn.disabled = false;
    btn.classList.add('active');
    translateActive = true;
    return;
  }

  if (!supaUser) {
    btn.textContent = '🌐 Translate';
    btn.disabled = false;
    if (typeof toast === 'function') toast('Please sign in to create a new translation when no shared cache exists.', true);
    return;
  }

  // 번역할 텍스트 수집 - 원본 텍스트만 추출
  var texts = [];
  zones.forEach(function(z) {
    if (!z.dataset.original) z.dataset.original = z.innerHTML;
    // kh-word span 제거하고 순수 텍스트만
    var clone = z.cloneNode(true);
    clone.querySelectorAll('.kh-hover-word,.kh-word').forEach(function(s){ s.replaceWith(s.textContent); });
    texts.push(clone.textContent.trim());
  });

  // 빈 존 제거 (인덱스 매핑 보존용으로 빈 문자열 유지)
  var prompt = 'You are a Korean-to-English translator. Translate each numbered Korean text segment below into natural English. Translate the COMPLETE text without any truncation. Return ONLY a JSON array of translated strings in the exact same order. No markdown, no explanations, just the JSON array.\n\nSegments:\n'
    + JSON.stringify(texts);

  try {
    var res = await callClaude({
      feature: 'translate',
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    var data = res;

    // 응답 파싱 (Workers vs 직접 API 둘 다 대응)
    var raw = '';
    if (data.content && data.content[0] && data.content[0].text) raw = data.content[0].text;
    else if (data.text) raw = data.text;
    else if (typeof data === 'string') raw = data;

    if (!raw) throw new Error('empty response');

    var clean = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    // JSON 배열만 추출
    var arrStart = clean.indexOf('[');
    var arrEnd   = clean.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) clean = clean.slice(arrStart, arrEnd + 1);

    var translations = JSON.parse(clean);
    if (!Array.isArray(translations)) throw new Error('not array');

    translateCache[cacheKey] = translations;
    applyTranslation(zones, translations);
    translateActive = true;
    btn.textContent = '🇰🇷 Back to Korean';
    btn.classList.add('active');

    try {
      if (translations.length) {
        upsertArticleCacheRow(id, { translation: JSON.stringify({ texts: translations }) });
      }
    } catch(e) {}
  } catch(e) {
    btn.textContent = '🌐 Translate';
    btn.classList.remove('active');
    translateActive = false;
    if (e && (e.message === 'unauthorized' || e.message === 'Not signed in')) {
      if (!supaUser) {
        if (typeof openAuthModal === 'function') openAuthModal('signin');
        if (typeof toast === 'function') toast('Please sign in to use Translation.', true);
      } else {
        if (typeof toast === 'function') toast('Session error — please reload and try again.', true);
      }
    } else {
      if (typeof toast === 'function') toast('Translation failed — check your connection and try again.', true);
    }
  }
  btn.disabled = false;
}

function applyTranslation(zones, translations) {
  zones.forEach(function(z, i) {
    if (translations[i]) z.innerHTML = '<p>' + translations[i] + '</p>';
  });
}

function shareArticle() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(function() {
      toast('Link copied ✓');
    });
  }
}

// ── 북마크 ────────────────────────────────────────────────────
async function toggleBookmark(articleId, btn) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var sb = getSupa();
  if (!sb) return;

  var isBookmarked = btn.classList.contains('active');
  if (isBookmarked) {
    await sb.from('bookmarks').delete().eq('user_id', supaUser.id).eq('article_id', articleId);
    btn.classList.remove('active');
    btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    toast('Bookmark removed');
  } else {
    await sb.from('bookmarks').insert({ user_id: supaUser.id, article_id: articleId });
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
    toast('Bookmarked ✓');
  }
}

async function checkBookmarkState(articleId) {
  var btn = document.getElementById('art-bm-btn');
  if (!btn || !supaUser) return;
  var sb = getSupa();
  if (!sb) return;
  var { data } = await sb.from('bookmarks').select('id').eq('user_id', supaUser.id).eq('article_id', articleId).maybeSingle();
  if (data) {
    btn.classList.add('active');
    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 0-2-2h10a2 2 0 0 0 2 2z"/></svg>';
  }
}

// ── 댓글 ──────────────────────────────────────────────────────
function updateCommentForm() {
  var formEl   = document.getElementById('comment-form');
  var noticeEl = document.getElementById('comment-login-notice');
  if (!formEl || !noticeEl) return;
  if (supaUser) {
    formEl.style.display = 'block';
    noticeEl.style.display = 'none';
  } else {
    formEl.style.display = 'none';
    noticeEl.style.display = 'block';
  }
}

async function loadComments(articleId) {
  var sb = getSupa();
  var listEl = document.getElementById('comments-list');
  var countEl = document.getElementById('comment-count');
  if (!listEl) return;

  if (!sb) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Loading comments...</p>';
    return;
  }

  var { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error || !data || !data.length) {
    listEl.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">Be the first to comment!</p>';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = '(' + data.length + ')';

  listEl.innerHTML = data.map(function(c) {
    var isOwn = supaUser && supaUser.id === c.user_id;
    var avatar = (c.avatar_url && isValidImageURL(c.avatar_url))
      ? '<img src="' + escapeAttr(c.avatar_url) + '" class="comment-avatar" onerror="this.style.display=\'none\'">'
      : '<div class="comment-avatar" style="background:#2255a4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (c.user_name||'?').charAt(0) + '</div>';
    var timeStr = c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="comment-row" id="comment-' + c.id + '">'
      + '<div class="comment-top">'
      + avatar
      + '<div class="comment-meta">'
      + '<span class="comment-name">' + escapeHTML(c.user_name || 'Anonymous') + '</span>'
      + '<span class="comment-date">' + timeStr + '</span>'
      + '</div>'
      + (isOwn ? '<button class="comment-del" onclick="deleteComment(\'' + escapeAttr(c.id) + '\')" title="Delete">✕</button>' : '')
      + '</div>'
      + '<div class="comment-body">' + escapeHtml(c.content) + '</div>'
      + '</div>';
  }).join('');
}

// 댓글 rate limit: 유저별 마지막 작성 시간 추적
var _commentLastTime = {};
var COMMENT_COOLDOWN_MS = 30000; // 30초
var COMMENT_MAX_LENGTH  = 500;
var COMMENT_MIN_LENGTH  = 2;

// 기본 스팸 패턴 (URL 도배, 반복 문자)
function isSpamComment(text) {
  // 동일 문자 10개 이상 반복
  if (/(.)(\1){9,}/.test(text)) return true;
  // URL 3개 이상
  if ((text.match(/https?:\/\//g) || []).length >= 3) return true;
  // 전체가 공백/특수문자만
  if (!/[가-힣a-zA-Z0-9]/.test(text)) return true;
  return false;
}

async function submitComment(articleId) {
  if (!supaUser) { openAuthModal("signin"); return; }
  var input = document.getElementById('comment-input');
  var content = input ? input.value.trim() : '';

  // 길이 체크
  if (!content || content.length < COMMENT_MIN_LENGTH) {
    toast('Comment is too short.', true); return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    toast('Comment is too long (max ' + COMMENT_MAX_LENGTH + ' characters).', true); return;
  }

  // 스팸 체크
  if (isSpamComment(content)) {
    toast('Comment looks like spam. Please write normally.', true); return;
  }

  // Rate limit 체크 (30초 쿨다운)
  var now = Date.now();
  var last = _commentLastTime[supaUser.id] || 0;
  if (now - last < COMMENT_COOLDOWN_MS) {
    var wait = Math.ceil((COMMENT_COOLDOWN_MS - (now - last)) / 1000);
    toast('Please wait ' + wait + ' seconds before posting again.', true); return;
  }

  var sb = getSupa();
  if (!sb) return;

  var { error } = await sb.from('comments').insert({
    article_id:  articleId,
    user_id:     supaUser.id,
    user_name:   supaUser.user_metadata && supaUser.user_metadata.full_name || supaUser.email,
    avatar_url:  supaUser.user_metadata && supaUser.user_metadata.avatar_url || null,
    content:     content,
  });

  if (error) { toast('Error posting comment: ' + error.message, true); return; }
  _commentLastTime[supaUser.id] = Date.now();
  input.value = '';
  toast('Comment posted ✓');
  loadComments(articleId);
}

async function deleteComment(commentId) {
  if (!supaUser) return;
  if (!confirm('Delete this comment?')) return;
  var sb = getSupa();
  if (!sb) return;
  var { error } = await sb.from('comments').delete().eq('id', commentId).eq('user_id', supaUser.id);
  if (error) { toast('Delete failed', true); return; }
  var el = document.getElementById('comment-' + commentId);
  if (el) el.remove();
  toast('Comment deleted');
}

// Alias for escapeHTML (defined earlier) — single entry point for all HTML escaping
var escapeHtml = escapeHTML;

