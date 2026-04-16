/* ============================================================
   KH Quiz Arena  v1
   Fullscreen quiz overlay for Daily/Weekly/Monthly Review
   Depends on: kh-canvas-engine.js (KHCanvas.Gauge, Ring, ParticleSystem)
   ============================================================ */

(function() {
  'use strict';

  var QA = window.KHQuizArena = {};

  // ── State ──
  var _questions = [];
  var _index = 0;
  var _scores = [];     // true/false per question
  var _combo = 0;        // consecutive correct
  var _maxCombo = 0;
  var _answered = false;
  var _mode = 'daily';   // 'daily' | 'weekly' | 'monthly'
  var _timerDuration = 0; // 0 = no timer
  var _gauge = null;
  var _particleOverlay = null;
  var _onFinish = null;
  var _orderSelected = [];

  // ── DOM IDs ──
  var OVERLAY_ID = 'qa-overlay';

  // ── Create the overlay HTML (once) ──
  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) QA.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:560px">'
      // Header
      + '<div class="kh-fs-header">'
      +   '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'
      +     '<div id="qa-title" style="font-size:15px;font-weight:900;color:#fff">Review</div>'
      +     '<div id="qa-combo" style="display:none"></div>'
      +   '</div>'
      +   '<div id="qa-counter" style="font-size:12px;color:rgba(255,255,255,.45);font-weight:700;white-space:nowrap">0/0</div>'
      +   '<button class="kh-fs-close" onclick="KHQuizArena.close()">&#10005;</button>'
      + '</div>'
      // Progress path
      + '<div class="kh-progress-path" id="qa-progress-path"></div>'
      // Timer + Body
      + '<div class="kh-fs-body" id="qa-body" style="position:relative">'
      +   '<div style="display:flex;justify-content:center;margin-bottom:16px">'
      +     '<canvas id="qa-timer-canvas"></canvas>'
      +   '</div>'
      +   '<div id="qa-card-front" style="background:#15243a;border-radius:18px;padding:24px;border:1px solid rgba(255,255,255,.08)"></div>'
      + '</div>'
      // Footer
      + '<div class="kh-fs-footer" style="display:flex;justify-content:flex-end;gap:8px">'
      +   '<button id="qa-next-btn" onclick="KHQuizArena.next()" disabled style="padding:10px 24px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;opacity:.5">Next →</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
  }

  // ── Progress path nodes ──
  function _renderProgressPath() {
    var wrap = document.getElementById('qa-progress-path');
    if (!wrap) return;
    var html = '';
    for (var i = 0; i < _questions.length; i++) {
      if (i > 0) {
        var lineDone = i <= _index && _scores[i - 1] !== undefined;
        html += '<div class="kh-pp-line' + (lineDone ? ' done' : '') + '"></div>';
      }
      var cls = 'kh-pp-node';
      if (i < _index) cls += _scores[i] ? ' done' : ' wrong';
      else if (i === _index) cls += ' current';
      html += '<div class="' + cls + '">' + (i + 1) + '</div>';
    }
    wrap.innerHTML = html;
  }

  // ── Render current question onto card front ──
  function _renderQuestion() {
    var q = _questions[_index];
    if (!q) return;
    var front = document.getElementById('qa-card-front');
    if (!front) return;

    // Update counter
    var counter = document.getElementById('qa-counter');
    if (counter) counter.textContent = (_index + 1) + '/' + _questions.length;

    // Entrance animation
    front.style.animation = 'none';
    void front.offsetWidth;
    front.style.animation = 'khCardIn 0.4s ease forwards';

    _answered = false;
    var nextBtn = document.getElementById('qa-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '.5'; }

    // Hide timer if no duration
    var timerCanvas = document.getElementById('qa-timer-canvas');
    if (timerCanvas) timerCanvas.style.display = _timerDuration > 0 ? '' : 'none';

    var html = '';

    if (q.type === 'meaning') {
      html = '<div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">What does this mean?</div>'
        + '<div style="font-family:\'Noto Serif KR\',serif;font-size:28px;font-weight:900;color:#fff;text-align:center;margin:16px 0">' + _esc(q.word_ko) + '</div>'
        + (q.word_rom ? '<div style="font-size:13px;color:rgba(255,255,255,.45);text-align:center;margin-bottom:16px">' + _esc(q.word_rom) + '</div>' : '')
        + '<div style="display:flex;flex-direction:column;gap:8px" id="qa-choices">'
        + q.choices.map(function(c, i) {
            return '<button class="qa-choice-btn" onclick="KHQuizArena._selectMC(this,\'' + _escAttr(c) + '\')" style="width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s">' + _esc(c) + '</button>';
          }).join('')
        + '</div>';
    } else if (q.type === 'order') {
      _orderSelected = [];
      html = '<div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Arrange into a correct sentence</div>'
        + '<div style="font-size:14px;color:rgba(255,255,255,.55);margin-bottom:16px;text-align:center">' + _esc(q.en) + '</div>'
        + '<div id="qa-order-target" style="min-height:48px;border:2px dashed rgba(255,255,255,.15);border-radius:14px;padding:10px 12px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
        +   '<span style="font-size:12px;color:rgba(255,255,255,.25)">Tap words below</span>'
        + '</div>'
        + '<div id="qa-order-pool" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">'
        + q.words.map(function(w, i) {
            return '<button id="qow_' + i + '" class="qa-choice-btn" onclick="KHQuizArena._selectOrder(' + i + ',\'' + _escAttr(w) + '\')" style="padding:10px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif">' + _esc(w) + '</button>';
          }).join('')
        + '</div>'
        + '<button onclick="KHQuizArena._checkOrder()" style="width:100%;padding:12px;border-radius:12px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">Check</button>';
    } else if (q.type === 'typed') {
      // Convert typed to MCQ: show English, pick correct Korean
      var typedChoices = q.choices || [q.correct];
      // Build distractors if not provided
      if (typedChoices.length < 4) {
        var pool = _questions.filter(function(qq) { return qq.word_ko && qq.word_ko !== q.correct; }).map(function(qq) { return qq.word_ko; });
        var fallback = ['학생','친구','음식','날씨','학교','여행','가족','행복','경제','시간'];
        pool = pool.concat(fallback).filter(function(w) { return w !== q.correct; });
        pool.sort(function() { return Math.random() - 0.5; });
        typedChoices = [q.correct].concat(pool.slice(0, 3));
        for (var ti = typedChoices.length - 1; ti > 0; ti--) {
          var tj = Math.floor(Math.random() * (ti + 1));
          var tt = typedChoices[ti]; typedChoices[ti] = typedChoices[tj]; typedChoices[tj] = tt;
        }
      }
      html = '<div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Choose the Korean word</div>'
        + '<div style="font-size:22px;font-weight:800;color:#fff;text-align:center;margin:16px 0">' + _esc(q.word_en) + '</div>'
        + (q.word_rom ? '<div style="font-size:13px;color:rgba(255,255,255,.35);text-align:center;margin-bottom:16px">Hint: ' + _esc(q.word_rom) + '</div>' : '')
        + '<div style="display:flex;flex-direction:column;gap:8px" id="qa-choices">'
        + typedChoices.map(function(c) {
            return '<button class="qa-choice-btn" onclick="KHQuizArena._selectMC(this,\'' + _escAttr(c) + '\')" style="width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:\'Noto Sans KR\',sans-serif;text-align:center;transition:all .15s">' + _esc(c) + '</button>';
          }).join('')
        + '</div>';
    }

    html += '<div id="qa-feedback" style="margin-top:14px;display:none"></div>';
    front.innerHTML = html;

    _renderProgressPath();

    // Start timer if applicable
    if (_timerDuration > 0 && _gauge) {
      _gauge.reset(_timerDuration);
      _gauge.start(function() {
        // Time up — mark wrong
        if (!_answered) QA._timeUp();
      });
    }

    // Focus typed input
    if (q.type === 'typed') {
      var inp = document.getElementById('qa-typed-input');
      if (inp) setTimeout(function() { inp.focus(); }, 200);
    }
  }

  // ── Answer handlers ──

  QA._selectMC = function(btn, answer) {
    if (_answered) return;
    _answered = true;
    var q = _questions[_index];
    var correct = answer === q.correct;
    _recordAnswer(correct);

    // Highlight buttons
    var btns = document.querySelectorAll('#qa-choices .qa-choice-btn');
    btns.forEach(function(b) {
      b.style.pointerEvents = 'none';
      if (b.textContent === q.correct) {
        b.style.background = 'rgba(34,197,94,.2)';
        b.style.borderColor = '#22c55e';
        b.style.color = '#4ade80';
      } else if (b === btn && !correct) {
        b.style.background = 'rgba(239,68,68,.2)';
        b.style.borderColor = '#ef4444';
        b.style.color = '#f87171';
      }
    });
    _showFeedback(correct, q.correct);
  };

  QA._selectOrder = function(idx, word) {
    var btn = document.getElementById('qow_' + idx);
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '.3';
    _orderSelected.push(word);

    var target = document.getElementById('qa-order-target');
    if (target) {
      target.innerHTML = _orderSelected.map(function(w, i) {
        return '<span onclick="KHQuizArena._removeOrder(' + i + ')" style="padding:8px 14px;border-radius:10px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);color:#60a5fa;font-size:14px;font-weight:700;cursor:pointer">' + _esc(w) + '</span>';
      }).join('');
    }
  };

  QA._removeOrder = function(idx) {
    if (_answered) return;
    _orderSelected.splice(idx, 1);
    // Reset all pool buttons
    var q = _questions[_index];
    q.words.forEach(function(w, i) {
      var btn = document.getElementById('qow_' + i);
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    });
    // Re-disable used ones
    var used = _orderSelected.slice();
    q.words.forEach(function(w, i) {
      var usedIdx = used.indexOf(w);
      if (usedIdx >= 0) {
        var btn = document.getElementById('qow_' + i);
        if (btn) { btn.disabled = true; btn.style.opacity = '.3'; }
        used.splice(usedIdx, 1);
      }
    });
    // Re-render target
    var target = document.getElementById('qa-order-target');
    if (target) {
      target.innerHTML = _orderSelected.length ? _orderSelected.map(function(w, i) {
        return '<span onclick="KHQuizArena._removeOrder(' + i + ')" style="padding:8px 14px;border-radius:10px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);color:#60a5fa;font-size:14px;font-weight:700;cursor:pointer">' + _esc(w) + '</span>';
      }).join('') : '<span style="font-size:12px;color:rgba(255,255,255,.25)">Tap words below</span>';
    }
  };

  QA._checkOrder = function() {
    if (_answered) return;
    var q = _questions[_index];
    if (_orderSelected.length !== q.correct.length) return;
    _answered = true;
    var userAnswer = _orderSelected.join(' ');
    var correctAnswer = q.correct.join(' ');
    var correct = userAnswer === correctAnswer;

    // Alternative order check: if all words present AND last word (verb/ending) matches → accept
    if (!correct && q.correct.length >= 3) {
      var lastWordMatch = _orderSelected[_orderSelected.length - 1] === q.correct[q.correct.length - 1];
      var allWordsPresent = q.correct.every(function(w) { return _orderSelected.indexOf(w) >= 0; });
      if (lastWordMatch && allWordsPresent) correct = true;
    }

    _recordAnswer(correct);
    _showFeedback(correct, correctAnswer);
  };

  QA._checkTyped = function() {
    if (_answered) return;
    var inp = document.getElementById('qa-typed-input');
    var val = (inp ? inp.value : '').trim();
    if (!val) return;
    _answered = true;
    var q = _questions[_index];
    var correct = val === q.correct || val.replace(/\s/g, '') === q.correct.replace(/\s/g, '');
    _recordAnswer(correct);
    if (inp) { inp.disabled = true; inp.style.borderColor = correct ? '#22c55e' : '#ef4444'; }
    _showFeedback(correct, q.correct);
  };

  QA._timeUp = function() {
    if (_answered) return;
    _answered = true;
    _recordAnswer(false);
    var q = _questions[_index];
    _showFeedback(false, q.correct || (q.type === 'order' ? q.correct.join(' ') : ''));
  };

  // ── Shared logic ──

  /** Ensure particle overlay exists on the quiz body */
  function _ensureParticles() {
    if (_particleOverlay) return _particleOverlay;
    var body = document.getElementById('qa-body');
    if (!body || !window.KHCanvas) return null;
    _particleOverlay = KHCanvas.createOverlay(body);
    return _particleOverlay;
  }

  function _recordAnswer(correct) {
    _scores[_index] = correct;
    if (correct) {
      _combo++;
      if (_combo > _maxCombo) _maxCombo = _combo;
      if (typeof playCorrectSound === 'function') playCorrectSound();

      // ── Particles: correct answer ──
      var po = _ensureParticles();
      if (po) {
        var w = po.canvas._khW || 300;
        var h = po.canvas._khH || 200;
        po.ps.burstAt(w / 2, h / 2, 'GOLD_BURST', 25);

        // Combo fire at 3+
        if (_combo >= 3) {
          po.ps.trail({ x: w / 2, y: h, duration: 0.6, rate: 4, preset: 'COMBO_FIRE' });
        }
      }

      // ── Combo badge ──
      _showComboBadge();
    } else {
      _combo = 0;
      if (typeof playWrongSound === 'function') playWrongSound();

      // ── Particles: wrong answer ──
      var po2 = _ensureParticles();
      if (po2) {
        var w2 = po2.canvas._khW || 300;
        po2.ps.burstAt(w2 / 2, 60, 'WRONG', 12);
      }

      _hideComboBadge();
    }
    if (_gauge) _gauge.pause();

    // Enable next button
    var nextBtn = document.getElementById('qa-next-btn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.textContent = _index >= _questions.length - 1 ? 'Finish' : 'Next →';
    }
    _renderProgressPath();
  }

  function _showComboBadge() {
    var el = document.getElementById('qa-combo');
    if (!el || _combo < 2) return;
    el.style.display = '';
    el.className = 'kh-combo-badge' + (_combo >= 3 ? ' fire' : '');
    el.innerHTML = '🔥 ' + _combo + 'x';
    // Re-trigger animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  function _hideComboBadge() {
    var el = document.getElementById('qa-combo');
    if (el) el.style.display = 'none';
  }

  function _showFeedback(correct, answer) {
    var fb = document.getElementById('qa-feedback');
    if (!fb) return;
    fb.style.display = '';
    if (correct) {
      fb.innerHTML = '<div style="padding:12px;border-radius:12px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:#4ade80;font-weight:700;text-align:center">✅ Correct!' + (_combo >= 3 ? ' 🔥 ' + _combo + 'x Combo!' : '') + '</div>';
    } else {
      fb.innerHTML = '<div style="padding:12px;border-radius:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;font-weight:700;text-align:center">❌ Answer: <span style="color:#fff">' + _esc(String(answer)) + '</span></div>';
    }
  }

  // ── Score screen ──
  function _showScore() {
    var correct = _scores.filter(Boolean).length;
    var total = _scores.length;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;
    var body = document.getElementById('qa-body');
    if (!body) return;

    var timerCanvas = document.getElementById('qa-timer-canvas');
    if (timerCanvas) timerCanvas.style.display = 'none';

    body.innerHTML =
      '<div style="text-align:center;padding:20px 0">'
      + '<div style="font-size:48px;margin-bottom:12px">' + (pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚') + '</div>'
      + '<div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:4px">' + correct + ' / ' + total + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.5);margin-bottom:8px">' + pct + '% correct</div>'
      + (_maxCombo >= 3 ? '<div style="font-size:13px;color:#f97316;font-weight:700;margin-bottom:8px">🔥 Max combo: ' + _maxCombo + 'x</div>' : '')
      + '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:16px">'
      + _scores.map(function(s, i) {
          return '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;'
            + (s ? 'background:#22c55e' : 'background:#ef4444') + '">' + (i + 1) + '</div>';
        }).join('')
      + '</div>'
      + '</div>';

    // Update footer
    var nextBtn = document.getElementById('qa-next-btn');
    if (nextBtn) {
      nextBtn.textContent = 'Close';
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.onclick = function() { QA.close(); };
    }

    // Celebration particles
    if (pct >= 50) {
      var po = _ensureParticles();
      if (po) {
        var w = po.canvas._khW || 300;
        var h = po.canvas._khH || 200;
        setTimeout(function() {
          po.ps.burstAt(w / 2, h * 0.3, 'CELEBRATION', 60);
          po.ps.burstAt(w * 0.2, h * 0.4, 'GOLD_BURST', 15);
          po.ps.burstAt(w * 0.8, h * 0.4, 'GOLD_BURST', 15);
        }, 200);
        if (pct >= 80) {
          setTimeout(function() {
            po.ps.burstAt(w * 0.3, h * 0.5, 'MASTERY', 20);
            po.ps.burstAt(w * 0.7, h * 0.5, 'MASTERY', 20);
          }, 600);
        }
      }
    }

    // Log results
    if (_onFinish) _onFinish(correct, total, pct);
  }

  // ── Public API ──

  /**
   * Open the quiz arena.
   * @param {object} opts
   * @param {array}  opts.questions — same format as existing _drQuestions
   * @param {string} opts.title     — 'Daily Review', 'Weekly Review', etc.
   * @param {number} opts.timer     — seconds per question, 0 = no timer
   * @param {string} opts.mode      — 'daily' | 'weekly' | 'monthly'
   * @param {function} opts.onFinish — callback(correct, total, pct)
   */
  QA.open = function(opts) {
    opts = opts || {};
    _ensureOverlay();

    _questions = opts.questions || [];
    _index = 0;
    _scores = [];
    _combo = 0;
    _maxCombo = 0;
    _answered = false;
    _mode = opts.mode || 'daily';
    _timerDuration = opts.timer || 0;
    _onFinish = opts.onFinish || null;

    // Title
    var title = document.getElementById('qa-title');
    if (title) title.textContent = opts.title || 'Review';

    // Init timer gauge
    var timerCanvas = document.getElementById('qa-timer-canvas');
    if (timerCanvas && _timerDuration > 0) {
      _gauge = new KHCanvas.Gauge(timerCanvas, {
        radius: 32, lineWidth: 6, duration: _timerDuration
      });
    } else if (timerCanvas) {
      timerCanvas.style.display = 'none';
    }

    // Show overlay
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      if (window.KHCanvas) KHCanvas.hideBottomNav();
    }

    if (_questions.length > 0) {
      _renderQuestion();
    }
  };

  QA.next = function() {
    _index++;
    if (_index >= _questions.length) {
      _showScore();
    } else {
      _renderQuestion();
    }
  };

  QA.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
    if (window.KHCanvas) KHCanvas.showBottomNav();
    }
    if (_gauge) { _gauge.destroy(); _gauge = null; }
    if (_particleOverlay) {
      _particleOverlay.ps.destroy();
      _particleOverlay.canvas.remove();
      _particleOverlay = null;
    }
    _hideComboBadge();
  };

  // ── Utility ──
  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _escAttr(s) { return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

})();
