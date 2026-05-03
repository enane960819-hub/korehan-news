/* ============================================================
   KoreHani — Streak Milestone celebration
   Extracted from korehan-shared.js (was lines 8485-8596).

   Fires once per milestone the first time a user crosses it.
   Gated by localStorage so repeated 7-day streaks after a break
   only celebrate once. Visible on the home / mypage when the
   streak counter just changed.

   External deps (resolved at runtime via global scope):
   - none (pure DOM + localStorage; visual layer only)
   ============================================================ */

// ══ STREAK MILESTONE — cosmic burst celebration ═══════════════════════════
// Fires once per milestone the first time a user crosses it. Gated by
// localStorage so repeated 7-day streaks after a break only celebrate once.
var STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
var STREAK_MESSAGES = {
  3:   { title: '3-Day Streak!',    sub: "You're building a habit." },
  7:   { title: 'One Week Strong',  sub: 'Seven days of Korean.' },
  14:  { title: 'Two Weeks!',       sub: "You're on fire." },
  30:  { title: '30 Days Locked In', sub: "A whole month. Unstoppable." },
  50:  { title: '50 Days!',         sub: 'Halfway to a century.' },
  100: { title: 'Centurion',        sub: '100 days of Korean!' },
  200: { title: '200 Days',         sub: 'This is who you are now.' },
  365: { title: 'One Year',         sub: 'A full year of dedication.' }
};

function maybeShowStreakMilestone(newStreak, prevStreak) {
  newStreak = parseInt(newStreak, 10) || 0;
  prevStreak = parseInt(prevStreak, 10) || 0;
  if (newStreak <= 0) return;
  // Find the highest milestone we just crossed in this update
  var crossed = null;
  for (var i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
    var m = STREAK_MILESTONES[i];
    if (newStreak >= m && prevStreak < m) { crossed = m; break; }
  }
  if (!crossed) return;
  // Gate: one celebration per milestone per user-local browser
  var key = 'kh_streak_celebrated_' + crossed;
  try { if (localStorage.getItem(key) === '1') return; } catch(_) {}
  try { localStorage.setItem(key, '1'); } catch(_) {}
  setTimeout(function(){ showStreakCosmicBurst(crossed); }, 1200);
}

function showStreakCosmicBurst(streak) {
  var existing = document.getElementById('kh-streak-burst');
  if (existing) existing.remove();

  injectStreakStyles();
  var msg = STREAK_MESSAGES[streak] || { title: streak + '-Day Streak!', sub: "You're amazing." };

  var overlay = document.createElement('div');
  overlay.id = 'kh-streak-burst';
  overlay.className = 'kh-streak-burst';
  overlay.innerHTML =
      '<canvas class="ksb-canvas" id="ksb-canvas"></canvas>'
    + '<div class="ksb-content">'
    +   '<div class="ksb-flame">🔥</div>'
    +   '<div class="ksb-number">' + streak + '</div>'
    +   '<div class="ksb-title">' + msg.title + '</div>'
    +   '<div class="ksb-sub">' + msg.sub + '</div>'
    +   '<button class="ksb-btn" type="button" onclick="closeStreakBurst()">Keep the streak →</button>'
    + '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function(){ overlay.classList.add('open'); });

  var canvas = document.getElementById('ksb-canvas');
  var ps = null;
  if (canvas && window.KHCanvas && KHCanvas.ParticleSystem) {
    canvas.width  = window.innerWidth  * (window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    try {
      ps = new KHCanvas.ParticleSystem(canvas);
      // Multiple bursts from center then a broader celebration
      var cx = window.innerWidth  / 2;
      var cy = window.innerHeight * 0.38;
      ps.spawn({ x: cx, y: cy, count: 90, preset: 'CELEBRATION' });
      setTimeout(function(){ ps.spawn({ x: cx - 80, y: cy + 30, count: 45, preset: 'GOLD_BURST' }); }, 300);
      setTimeout(function(){ ps.spawn({ x: cx + 80, y: cy + 30, count: 45, preset: 'GOLD_BURST' }); }, 500);
      setTimeout(function(){ ps.spawn({ x: cx,      y: cy - 40, count: 60, preset: 'COMBO_FIRE' }); }, 800);
      overlay._ps = ps;
    } catch(e) {}
  }
  // Auto-dismiss after 7s
  overlay._closeTimer = setTimeout(closeStreakBurst, 7000);
  overlay.addEventListener('click', function(e){
    if (e.target === overlay) closeStreakBurst();
  });
}

function closeStreakBurst() {
  var overlay = document.getElementById('kh-streak-burst');
  if (!overlay) return;
  if (overlay._closeTimer) { clearTimeout(overlay._closeTimer); overlay._closeTimer = null; }
  overlay.classList.remove('open');
  setTimeout(function(){
    try { if (overlay._ps && overlay._ps.destroy) overlay._ps.destroy(); } catch(_) {}
    overlay.remove();
  }, 420);
}

function injectStreakStyles() {
  if (document.getElementById('kh-streak-burst-styles')) return;
  var css = [
    '.kh-streak-burst{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 38%,rgba(90,40,130,.75) 0%,rgba(8,5,22,.92) 70%,rgba(2,2,8,.97) 100%);opacity:0;pointer-events:none;transition:opacity .42s ease;}',
    '.kh-streak-burst.open{opacity:1;pointer-events:auto;}',
    '.kh-streak-burst .ksb-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}',
    '.kh-streak-burst .ksb-content{position:relative;z-index:2;text-align:center;padding:0 24px;max-width:92vw;}',
    '.kh-streak-burst .ksb-flame{font-size:46px;filter:drop-shadow(0 0 14px rgba(255,180,120,.75));animation:ksbFlameBob 1.6s ease-in-out infinite;}',
    '.kh-streak-burst .ksb-number{font-family:\'Playfair Display\',\'Noto Serif KR\',serif;font-size:clamp(84px,18vw,168px);font-weight:900;line-height:1;letter-spacing:-.04em;background:linear-gradient(180deg,#fff2c0 0%,#fbbf24 55%,#b45309 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 38px rgba(251,191,36,.42);margin:2px 0 4px;animation:ksbPop .62s cubic-bezier(.22,1.4,.36,1) both;}',
    '.kh-streak-burst .ksb-title{font-family:\'Playfair Display\',\'Noto Serif KR\',serif;font-size:clamp(22px,4.5vw,34px);font-weight:900;color:#fff;letter-spacing:-.01em;text-shadow:0 2px 14px rgba(120,80,200,.35);margin-bottom:8px;animation:ksbFade .62s ease .15s both;}',
    '.kh-streak-burst .ksb-sub{font-size:14px;font-weight:700;color:rgba(220,210,255,.75);letter-spacing:.02em;margin-bottom:28px;animation:ksbFade .62s ease .25s both;}',
    '.kh-streak-burst .ksb-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 26px;border:none;border-radius:999px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#3b2200;font-size:13px;font-weight:900;letter-spacing:.04em;cursor:pointer;font-family:inherit;box-shadow:0 12px 32px rgba(245,158,11,.45),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .14s,box-shadow .14s;animation:ksbFade .62s ease .35s both;}',
    '.kh-streak-burst .ksb-btn:hover{transform:translateY(-1px);box-shadow:0 18px 40px rgba(245,158,11,.55),inset 0 1px 0 rgba(255,255,255,.55);}',
    '@keyframes ksbPop{0%{transform:scale(.45);opacity:0;}60%{transform:scale(1.1);opacity:1;}100%{transform:scale(1);}}',
    '@keyframes ksbFade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}',
    '@keyframes ksbFlameBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}',
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'kh-streak-burst-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
