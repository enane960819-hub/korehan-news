/* ============================================================
   KoreHani — Hangul jamo on-screen keyboard

   Tap-driven Korean IME for users who don't have a Korean
   keyboard installed. Used by daily/weekly review's "typed"
   question type so writing answers doesn't depend on the
   native OS IME.

   Public API (window):
     - khComposeJamo(cho, jung, jong)  → 1-char syllable
     - khDecomposeHangul(syllable)     → { cho, jung, jong }
     - khAttachJamoKeyboard(inputEl, opts)
         Renders a keyboard <div> right after `inputEl`.
         Returns { destroy } so the caller can remove it.
         Tapping a jamo runs the standard Korean IME state
         machine (cho → jung → jong, vowel after jong opens
         a new syllable) and writes the composed text into
         inputEl.value.

   Limitations (v1):
     - Compound jung (ㅘ/ㅙ/ㅚ/ㅝ/ㅞ/ㅟ/ㅢ/ㅒ/ㅖ) are entered
       as a single tile (not 2-step compose). 21-slot grid.
     - Compound jong (ㄳ/ㄵ/ㄶ/ㄺ/ㄻ/ㄼ/ㄽ/ㄾ/ㄿ/ㅀ/ㅄ)
       are entered as a single tile. The grid lists them
       under the cho row's "받침+" toggle.
   ============================================================ */
(function(){
  var CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  function _idx(arr, ch) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === ch) return i;
    return -1;
  }

  function khComposeJamo(cho, jung, jong) {
    var ci = _idx(CHO, cho);
    var ji = _idx(JUNG, jung);
    var ki = jong ? _idx(JONG, jong) : 0;
    if (ci < 0 || ji < 0 || ki < 0) return cho + jung + (jong || '');
    return String.fromCharCode(0xAC00 + (ci * 588) + (ji * 28) + ki);
  }

  function khDecomposeHangul(ch) {
    if (!ch) return null;
    var code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null;
    return {
      cho:  CHO[Math.floor(code / 588)],
      jung: JUNG[Math.floor((code % 588) / 28)],
      jong: JONG[code % 28] || '',
    };
  }

  function _isCho(ch)  { return _idx(CHO,  ch) >= 0; }
  function _isJung(ch) { return _idx(JUNG, ch) >= 0; }
  function _isJong(ch) { return _idx(JONG, ch) >  0; } // 0 = empty, treat as not-a-jong

  // Korean IME state machine driven by tap events.
  // Holds the in-progress syllable as { cho, jung, jong } and a
  // committed prefix string for everything before it.
  function _makeIme() {
    var prefix = '';
    var cur = null; // { cho, jung, jong }

    function flush() {
      if (!cur) return;
      if (cur.cho && cur.jung) prefix += khComposeJamo(cur.cho, cur.jung, cur.jong || '');
      else if (cur.cho)        prefix += cur.cho;
      cur = null;
    }

    function value() {
      if (!cur) return prefix;
      if (cur.cho && cur.jung) return prefix + khComposeJamo(cur.cho, cur.jung, cur.jong || '');
      if (cur.cho) return prefix + cur.cho;
      return prefix;
    }

    function feedJamo(j) {
      if (!cur) {
        if (_isCho(j))  { cur = { cho: j, jung: '', jong: '' }; return; }
        if (_isJung(j)) { prefix += j; return; }                   // floating vowel
        prefix += j;
        return;
      }
      // cho only — waiting for jung
      if (cur.cho && !cur.jung) {
        if (_isJung(j)) { cur.jung = j; return; }
        if (_isCho(j))  { flush(); cur = { cho: j, jung: '', jong: '' }; return; }
        prefix += j;
        return;
      }
      // cho + jung — could add jong, OR roll into next syllable
      if (cur.cho && cur.jung && !cur.jong) {
        if (_isJong(j)) { cur.jong = j; return; }
        if (_isJung(j)) {
          // Vowel after a complete CV — finalize and start a new
          // syllable with floating vowel (rare; learners usually
          // chain cho first).
          flush(); prefix += j; return;
        }
        if (_isCho(j))  { flush(); cur = { cho: j, jung: '', jong: '' }; return; }
        prefix += j;
        return;
      }
      // cho + jung + jong — vowel transfers jong to next syllable
      if (cur.cho && cur.jung && cur.jong) {
        if (_isJung(j)) {
          // The conventional Korean IME rule: when a vowel
          // arrives after CVC, the C2 splits off and pairs with
          // the new vowel. Compound jong (ㄺ etc.) splits into
          // its second component for the new syllable; v1 keeps
          // it simple and only handles single-jamo jong.
          var carry = cur.jong;
          cur.jong = '';
          flush();
          cur = { cho: carry, jung: j, jong: '' };
          return;
        }
        if (_isCho(j))  { flush(); cur = { cho: j, jung: '', jong: '' }; return; }
        if (_isJong(j)) {
          // Already have a jong — no compound logic in v1, just
          // commit and start a new syllable with this consonant
          // as the new cho (it is a cho/jong duplicate).
          flush();
          if (_isCho(j)) cur = { cho: j, jung: '', jong: '' };
          else prefix += j;
          return;
        }
        prefix += j;
        return;
      }
    }

    function backspace() {
      if (cur) {
        if (cur.jong) { cur.jong = ''; return; }
        if (cur.jung) { cur.jung = ''; return; }
        if (cur.cho)  { cur = null; return; }
      }
      if (prefix.length) prefix = prefix.slice(0, -1);
    }

    function clear() { prefix = ''; cur = null; }
    function space() { flush(); prefix += ' '; }

    return { feedJamo: feedJamo, backspace: backspace, clear: clear, space: space, value: value };
  }

  function khAttachJamoKeyboard(inputEl, opts) {
    if (!inputEl) return null;
    opts = opts || {};
    var ime = _makeIme();
    var wrap = document.createElement('div');
    wrap.className = 'kh-jamo-kb';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '한글 자모 키보드');

    function sync() {
      inputEl.value = ime.value();
      try { inputEl.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
    }

    var rows = [
      // Consonants — 19 cho letters
      CHO,
      // Vowels — 21 jung letters (compound diphthongs included so the
      // user can tap ㅘ/ㅢ/etc. directly without the 2-step compose).
      JUNG,
    ];

    var rowsHtml = rows.map(function(row) {
      return '<div class="kh-jamo-row">' + row.map(function(j) {
        return '<button type="button" class="kh-jamo-key" data-j="' + j + '">' + j + '</button>';
      }).join('') + '</div>';
    }).join('');

    wrap.innerHTML = rowsHtml
      + '<div class="kh-jamo-row kh-jamo-ctrl">'
      +   '<button type="button" class="kh-jamo-key kh-jamo-space" data-act="space">space</button>'
      +   '<button type="button" class="kh-jamo-key kh-jamo-bs" data-act="bs">⌫</button>'
      +   '<button type="button" class="kh-jamo-key kh-jamo-clr" data-act="clear">Clear</button>'
      + '</div>';

    wrap.addEventListener('click', function(ev) {
      var btn = ev.target.closest && ev.target.closest('button');
      if (!btn || !wrap.contains(btn)) return;
      ev.preventDefault();
      var j = btn.getAttribute('data-j');
      var act = btn.getAttribute('data-act');
      if (j) ime.feedJamo(j);
      else if (act === 'bs')    ime.backspace();
      else if (act === 'space') ime.space();
      else if (act === 'clear') ime.clear();
      sync();
    });

    // Keep the IME state synced if the user also types directly.
    inputEl.addEventListener('input', function() {
      if (inputEl.value === ime.value()) return;
      ime.clear();
      var v = inputEl.value || '';
      // Replay what the user typed into the IME state by character.
      for (var i = 0; i < v.length; i++) {
        var ch = v[i];
        var d = khDecomposeHangul(ch);
        if (d) {
          ime.feedJamo(d.cho);
          ime.feedJamo(d.jung);
          if (d.jong) ime.feedJamo(d.jong);
        } else if (ch === ' ') {
          ime.space();
        } else {
          // Drop anything that isn't hangul / space — keeps the
          // IME state predictable for review answer entry.
        }
      }
      // No re-sync — the user's literal typing is already in the
      // input; only the internal IME state needed updating.
    });

    if (!document.getElementById('kh-jamo-kb-style')) {
      var st = document.createElement('style');
      st.id = 'kh-jamo-kb-style';
      st.textContent = [
        '.kh-jamo-kb{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;font-family:"Noto Sans KR",sans-serif}',
        '.kh-jamo-row{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}',
        '.kh-jamo-key{flex:1 1 32px;min-width:30px;max-width:48px;padding:8px 6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s}',
        '.kh-jamo-key:hover{background:rgba(125,211,252,.18);border-color:rgba(125,211,252,.4)}',
        '.kh-jamo-key:active{transform:scale(.96)}',
        '.kh-jamo-ctrl .kh-jamo-key{flex:1 1 60px;max-width:none;font-size:13px;font-weight:700}',
        '.kh-jamo-space{flex:2 1 120px !important}',
        '.kh-jamo-bs{background:rgba(248,113,113,.18) !important;border-color:rgba(248,113,113,.35) !important}',
        '@media(max-width:560px){.kh-jamo-key{font-size:14px;padding:7px 4px;min-width:26px}}',
      ].join('\n');
      document.head.appendChild(st);
    }

    if (inputEl.parentNode) inputEl.parentNode.insertBefore(wrap, inputEl.nextSibling);

    return {
      destroy: function() {
        try { wrap.parentNode.removeChild(wrap); } catch(_) {}
      },
    };
  }

  window.khComposeJamo       = khComposeJamo;
  window.khDecomposeHangul   = khDecomposeHangul;
  window.khAttachJamoKeyboard = khAttachJamoKeyboard;
})();
