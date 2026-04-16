/* ============================================================
   KH Listening Quiz  v1
   Fullscreen listening quiz with Canvas waveform visualization
   Depends on: kh-canvas-engine.js (KHCanvas.DPR, AnimLoop, ParticleSystem)
   ============================================================ */

(function() {
  'use strict';

  var LQ = window.KHListening = {};

  // ── State ──
  var _questions = [];
  var _index = 0;
  var _score = 0;
  var _answered = false;
  var _particleOverlay = null;
  var _waveAnimId = 'lq-wave';
  var _isPlaying = false;
  var _speedRate = 1.0;

  var OVERLAY_ID = 'lq-overlay';

  // ── Waveform: simulated bars (no Web Audio analyser needed for TTS) ──
  var _waveBars = [];
  var _waveBarCount = 32;

  function _initWaveBars() {
    _waveBars = [];
    for (var i = 0; i < _waveBarCount; i++) {
      _waveBars.push({ height: 0, target: 0, phase: Math.random() * Math.PI * 2 });
    }
  }

  function _drawWaveform(canvas, playing) {
    if (!canvas || !window.KHCanvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = KHCanvas.DPR.ratio();
    var w = canvas._khW || 300;
    var h = canvas._khH || 80;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    var barW = (w - (_waveBarCount - 1) * 2) / _waveBarCount;
    var maxH = h * 0.8;

    for (var i = 0; i < _waveBarCount; i++) {
      var bar = _waveBars[i];
      if (playing) {
        bar.target = 0.2 + Math.random() * 0.8;
      } else {
        bar.target = 0.05;
      }
      bar.height += (bar.target - bar.height) * 0.15;

      var bh = bar.height * maxH;
      var x = i * (barW + 2);
      var y = (h - bh) / 2;

      // Gradient per bar
      var grad = ctx.createLinearGradient(x, y, x, y + bh);
      grad.addColorStop(0, playing ? '#60a5fa' : 'rgba(255,255,255,.15)');
      grad.addColorStop(1, playing ? '#2563eb' : 'rgba(255,255,255,.08)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bh, 2);
      ctx.fill();
    }
  }

  // ── Create overlay ──
  function _ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'kh-fs-overlay hidden';
    el.onclick = function(e) { if (e.target === el) LQ.close(); };
    el.innerHTML =
      '<div class="kh-fs-panel" style="max-width:480px">'
      + '<div class="kh-fs-header">'
      +   '<div style="flex:1"><div id="lq-title" style="font-size:15px;font-weight:900;color:#fff">🎧 Listening Quiz</div></div>'
      +   '<div id="lq-counter" style="font-size:12px;color:rgba(255,255,255,.45);font-weight:700"></div>'
      +   '<button class="kh-fs-close" onclick="KHListening.close()">&#10005;</button>'
      + '</div>'
      // Waveform area
      + '<div style="padding:16px 20px;background:rgba(0,0,0,.15);border-bottom:1px solid rgba(255,255,255,.06)">'
      +   '<canvas id="lq-wave-canvas" style="width:100%;height:80px;display:block;border-radius:10px"></canvas>'
      +   '<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px">'
      +     '<button onclick="KHListening.play()" id="lq-play-btn" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(96,165,250,.3);background:rgba(96,165,250,.1);color:#60a5fa;font-size:24px;cursor:pointer;transition:all .15s">🔊</button>'
      +     '<div style="display:flex;gap:4px" id="lq-speed-btns">'
      +       '<button onclick="KHListening.setSpeed(0.7)" class="lq-spd" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:none;color:rgba(255,255,255,.4);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">0.7x</button>'
      +       '<button onclick="KHListening.setSpeed(1.0)" class="lq-spd on" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(96,165,250,.3);background:rgba(96,165,250,.15);color:#60a5fa;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">1.0x</button>'
      +       '<button onclick="KHListening.setSpeed(1.3)" class="lq-spd" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:none;color:rgba(255,255,255,.4);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">1.3x</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      // Question body
      + '<div class="kh-fs-body" id="lq-body" style="position:relative"></div>'
      // Footer
      + '<div class="kh-fs-footer" style="display:flex;justify-content:flex-end">'
      +   '<button id="lq-next-btn" onclick="KHListening.next()" disabled style="padding:10px 24px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;opacity:.5">Next →</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
  }

  // ── Render question ──
  function _renderQuestion() {
    if (_index >= _questions.length) { _showScore(); return; }
    var q = _questions[_index];
    var body = document.getElementById('lq-body');
    var counter = document.getElementById('lq-counter');
    if (counter) counter.textContent = (_index + 1) + '/' + _questions.length;

    _answered = false;
    var nextBtn = document.getElementById('lq-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.style.opacity = '.5'; nextBtn.textContent = _index >= _questions.length - 1 ? 'Finish' : 'Next →'; }

    body.innerHTML =
      '<div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px">What did you hear?</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px" id="lq-choices">'
      + q.choices.map(function(c) {
          return '<button class="lq-choice-btn" onclick="KHListening._answer(this,\'' + _escAttr(c) + '\')" style="width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s">' + _esc(c) + '</button>';
        }).join('')
      + '</div>'
      + '<div id="lq-feedback" style="margin-top:14px;display:none"></div>';

    // Auto-play on new question
    setTimeout(function() { LQ.play(); }, 300);
  }

  // ── Answer handler ──
  LQ._answer = function(btn, answer) {
    if (_answered) return;
    _answered = true;
    var q = _questions[_index];
    var correct = answer === q.correct;

    if (correct) {
      _score++;
      if (typeof playCorrectSound === 'function') playCorrectSound();
    } else {
      if (typeof playWrongSound === 'function') playWrongSound();
    }

    // Highlight
    var btns = document.querySelectorAll('#lq-choices .lq-choice-btn');
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

    // Feedback
    var fb = document.getElementById('lq-feedback');
    if (fb) {
      fb.style.display = '';
      fb.innerHTML = correct
        ? '<div style="padding:10px;border-radius:10px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:#4ade80;font-weight:700;text-align:center">✅ Correct!</div>'
        : '<div style="padding:10px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#f87171;font-weight:700;text-align:center">❌ Answer: <span style="color:#fff">' + _esc(q.correct) + '</span></div>';
      if (q.explanation) {
        fb.innerHTML += '<div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:6px;text-align:center">' + _esc(q.explanation) + '</div>';
      }
    }

    // Particles
    if (correct && window.KHCanvas) {
      var body = document.getElementById('lq-body');
      if (body) {
        var po = KHCanvas.createOverlay(body);
        if (po) {
          po.ps.burstAt(po.canvas._khW / 2, po.canvas._khH * 0.3, 'GOLD_BURST', 20);
          setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 2000);
        }
      }
    }

    var nextBtn = document.getElementById('lq-next-btn');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.style.opacity = '1'; }
  };

  // ── Score screen ──
  function _showScore() {
    var total = _questions.length;
    var pct = total > 0 ? Math.round(_score / total * 100) : 0;
    var body = document.getElementById('lq-body');
    if (!body) return;

    // Stop waveform
    KHCanvas.AnimLoop.unregister(_waveAnimId);

    body.innerHTML =
      '<div style="text-align:center;padding:24px 0">'
      + '<div style="font-size:48px;margin-bottom:12px">' + (pct >= 80 ? '🎉' : pct >= 50 ? '👂' : '📚') + '</div>'
      + '<div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:4px">' + _score + ' / ' + total + '</div>'
      + '<div style="font-size:14px;color:rgba(255,255,255,.5)">' + pct + '% correct</div>'
      + '</div>';

    var nextBtn = document.getElementById('lq-next-btn');
    if (nextBtn) { nextBtn.textContent = 'Close'; nextBtn.disabled = false; nextBtn.style.opacity = '1'; nextBtn.onclick = function() { LQ.close(); }; }

    if (pct >= 50 && window.KHCanvas) {
      var po = KHCanvas.createOverlay(body);
      if (po) {
        setTimeout(function() { po.ps.burstAt(po.canvas._khW / 2, po.canvas._khH * 0.3, 'CELEBRATION', 40); }, 200);
        setTimeout(function() { po.canvas.remove(); po.ps.destroy(); }, 3000);
      }
    }
  }

  // ── TTS Play ──
  LQ.play = function() {
    if (_index >= _questions.length) return;
    var q = _questions[_index];
    var text = q.sentence || q.correct || '';
    if (!text) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      var utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'ko-KR';
      utt.rate = _speedRate;

      _isPlaying = true;
      utt.onend = function() { _isPlaying = false; };
      utt.onerror = function() { _isPlaying = false; };
      window.speechSynthesis.speak(utt);
    }
  };

  LQ.setSpeed = function(rate) {
    _speedRate = rate;
    var btns = document.querySelectorAll('#lq-speed-btns .lq-spd');
    btns.forEach(function(b) {
      var isOn = b.textContent.trim() === rate.toFixed(1) + 'x';
      b.style.borderColor = isOn ? 'rgba(96,165,250,.3)' : 'rgba(255,255,255,.1)';
      b.style.background = isOn ? 'rgba(96,165,250,.15)' : 'none';
      b.style.color = isOn ? '#60a5fa' : 'rgba(255,255,255,.4)';
    });
  };

  // ── Public API ──
  LQ.open = function(opts) {
    opts = opts || {};
    _ensureOverlay();
    _questions = opts.questions || [];
    _index = 0;
    _score = 0;
    _answered = false;
    _speedRate = 1.0;
    _initWaveBars();

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('hidden');
      requestAnimationFrame(function() { overlay.classList.add('active'); });
      KHCanvas.hideBottomNav();
    }

    // Setup waveform canvas
    var waveCanvas = document.getElementById('lq-wave-canvas');
    if (waveCanvas && window.KHCanvas) {
      var rect = waveCanvas.getBoundingClientRect();
      KHCanvas.DPR.setup(waveCanvas, rect.width || 300, 80);
      // Start waveform animation loop
      KHCanvas.AnimLoop.register(_waveAnimId, function() {
        _drawWaveform(waveCanvas, _isPlaying);
      });
    }

    if (_questions.length > 0) _renderQuestion();
  };

  LQ.next = function() {
    _index++;
    if (_index >= _questions.length) _showScore();
    else _renderQuestion();
  };

  LQ.close = function() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.classList.add('hidden'); }, 250);
    KHCanvas.showBottomNav();
    }
    window.speechSynthesis && window.speechSynthesis.cancel();
    KHCanvas.AnimLoop.unregister(_waveAnimId);
    _isPlaying = false;
  };

  // ── Utility ──
  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function _escAttr(s) { return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

})();
