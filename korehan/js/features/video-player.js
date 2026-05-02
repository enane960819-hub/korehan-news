/* ============================================================
   KoreHani — HLS / Reddit video player + audio companion
   Extracted from korehan-shared.js (was lines 1966-2370).

   Lazy-loads hls.js when needed, attaches HLS playback to
   <video data-kh-hls> elements, with a multi-layer degradation
   funnel for Reddit videos:
     HLS resolve → HLS playback → silent MP4 + companion audio
     → image fallback ("Video unavailable")

   External deps (resolved at runtime via global scope):
   - khLog                 — from korehan-shared.js (debug logger)
   - window.Hls            — loaded lazily from CDN
   - /api/reddit-video-resolve  and  /api/hls-proxy  (server-side)
   ============================================================ */

// Attach hls.js (or native HLS on Safari) to any <video data-kh-hls=".m3u8">
// present in the DOM. Call after renderArticlePage injects the hero. Loads
// hls.js lazily from jsdelivr the first time it's needed so the main bundle
// stays small.
var _khHlsLoadPromise = null;
function _khLoadHlsJs() {
  if (_khHlsLoadPromise) return _khHlsLoadPromise;
  _khHlsLoadPromise = new Promise(function(resolve, reject) {
    if (typeof window.Hls !== 'undefined') { resolve(window.Hls); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
    s.onload = function(){ resolve(window.Hls); };
    s.onerror = function(e){ _khHlsLoadPromise = null; reject(e); };
    document.head.appendChild(s);
  });
  return _khHlsLoadPromise;
}
// Tag a <video> that we know has no audio with a small "Silent"
// badge so the learner doesn't spend time fiddling with volume.
// Fires for two cases: the Reddit post was originally silent
// (is_gif=true, no audio track upstream) and the case where the
// audio companion 404s because our DASH_AUDIO_128 guess was wrong
// for that post.
function _khMarkSilent(video) {
  if (!video || !video.parentNode) return;
  if (video.parentNode.querySelector('.kh-silent-badge')) return;
  var parent = video.parentNode;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  var badge = document.createElement('div');
  badge.className = 'kh-silent-badge';
  badge.textContent = 'Silent';
  badge.title = 'This clip has no audio track.';
  badge.style.cssText =
    'position:absolute;right:12px;top:12px;z-index:5;' +
    'background:rgba(8,16,31,.75);color:#fff;' +
    'padding:4px 10px;border-radius:999px;' +
    'font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;' +
    'font-family:inherit;pointer-events:none;' +
    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
    'box-shadow:0 2px 8px rgba(0,0,0,.25);';
  parent.appendChild(badge);
}

// Cache of resolver responses keyed by permalink, scoped to the page
// load. Multiple <video> elements pointing at the same post (rare, but
// possible in feeds) share one fetch.
var _khRedditResolveCache = Object.create(null);
function _khResolveReddit(permalink) {
  if (!permalink) return Promise.resolve(null);
  if (_khRedditResolveCache[permalink]) return _khRedditResolveCache[permalink];
  var p = fetch('/api/reddit-video-resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permalink: permalink }),
  }).then(function(r) {
    if (!r.ok) throw new Error('resolve http ' + r.status);
    return r.json();
  }).then(function(j) {
    if (!j || !j.ok) throw new Error('resolve not ok: ' + (j && j.message || ''));
    return j;
  }).catch(function(e) {
    // Don't cache failures — next caller may succeed if it was a blip.
    delete _khRedditResolveCache[permalink];
    khLog('[hero-video] reddit-video-resolve failed:', e && e.message || e);
    return null;
  });
  _khRedditResolveCache[permalink] = p;
  return p;
}

// Wrap a v.redd.it URL through our /api/hls-proxy for same-origin
// delivery. Non-Reddit URLs pass through unchanged.
function _khProxyRedditUrl(u) {
  if (!u) return u;
  if (/^https:\/\/(v\.redd\.it|packaged-media\.redd\.it|dash\.redd\.it)\//.test(u)) {
    return '/api/hls-proxy?url=' + encodeURIComponent(u);
  }
  return u;
}

// Build a hidden <audio> element synced to the <video>. The video is the
// source of truth for play/pause/seek/rate/volume; audio just follows.
// This recovers audio when HLS itself failed but the separate
// DASH_AUDIO_128 track is still reachable. Returns the audio element so
// callers can clean it up if needed.
function _khAttachAudioCompanion(video, audioUrl) {
  if (!video || !audioUrl) return null;
  if (video._khAudioCompanion) return video._khAudioCompanion;
  var audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.src = _khProxyRedditUrl(audioUrl);
  audio.style.display = 'none';
  document.body.appendChild(audio);
  video._khAudioCompanion = audio;

  var SEEK_THRESHOLD = 0.25; // seconds — keep tracks tightly aligned
  function syncTime() {
    if (!isFinite(video.currentTime) || !isFinite(audio.duration)) return;
    if (Math.abs(audio.currentTime - video.currentTime) > SEEK_THRESHOLD) {
      try { audio.currentTime = video.currentTime; } catch(e) {}
    }
  }
  video.addEventListener('play',     function(){ syncTime(); audio.play().catch(function(){}); });
  video.addEventListener('pause',    function(){ audio.pause(); });
  video.addEventListener('seeking',  function(){ try { audio.currentTime = video.currentTime; } catch(e) {} });
  video.addEventListener('ratechange', function(){ try { audio.playbackRate = video.playbackRate; } catch(e) {} });
  video.addEventListener('volumechange', function(){
    try { audio.volume = video.volume; audio.muted = video.muted; } catch(e) {}
  });
  // If video buffers/stalls, pause audio to stay in lockstep.
  video.addEventListener('waiting', function(){ audio.pause(); });
  video.addEventListener('playing', function(){ if (!video.paused) audio.play().catch(function(){}); });
  // Periodic drift correction — rate clocks aren't perfectly identical.
  video.addEventListener('timeupdate', syncTime);
  // If the audio fails to load we just stay silent — video keeps playing.
  audio.addEventListener('error', function(){
    khLog('[hero-video] audio companion failed; staying silent');
  });
  return audio;
}

function _khAttachHls(root) {
  var scope = root || document;
  var videos = scope.querySelectorAll('video[data-kh-hls]');
  if (!videos.length) return;
  videos.forEach(function(v) {
    if (v.dataset.khHlsAttached === '1') return;
    v.dataset.khHlsAttached = '1';
    var staleSrc = v.getAttribute('data-kh-hls');
    var fallback = v.getAttribute('data-kh-fallback') || '';
    var permalink = v.getAttribute('data-kh-permalink') || '';
    var imageFallback = v.getAttribute('data-kh-image-fallback') || '';
    if (!staleSrc && !fallback && !permalink) return;

    // Resolved-URL holders. Populated by _khResolveReddit when permalink
    // is known; otherwise fall back to the stale persisted URLs.
    var freshHls = '';
    var freshAudio = '';
    var freshFallback = fallback;
    var retryAttempted = false;

    // ── Loading overlay ──────────────────────────────────────────
    // Shown immediately while we resolve URLs / probe the first frame.
    // Removed when the video starts playing OR when we end up swapping
    // to the image fallback. Without this, the user stared at a black
    // <video> element with a play button that did nothing — many
    // assumed the video was broken before it even tried.
    var loadingOverlay = null;
    function ensureLoadingOverlay() {
      if (loadingOverlay || !v.parentNode) return;
      var parent = v.parentNode;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'kh-video-loading';
      loadingOverlay.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:#fff;font-size:12px;font-weight:700"><span style="width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:khVidSpin .9s linear infinite"></span>Loading video…</div>';
      loadingOverlay.style.cssText = 'position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:rgba(8,16,31,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);transition:opacity .25s';
      parent.appendChild(loadingOverlay);
      if (!document.getElementById('kh-video-spin-style')) {
        var s = document.createElement('style');
        s.id = 'kh-video-spin-style';
        s.textContent = '@keyframes khVidSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
        document.head.appendChild(s);
      }
    }
    function clearLoadingOverlay() {
      if (!loadingOverlay) return;
      loadingOverlay.style.opacity = '0';
      var el = loadingOverlay;
      loadingOverlay = null;
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }
    ensureLoadingOverlay();
    v.addEventListener('loadeddata', clearLoadingOverlay, { once: true });
    v.addEventListener('canplay',    clearLoadingOverlay, { once: true });
    v.addEventListener('playing',    clearLoadingOverlay, { once: true });

    // Last-resort escape hatch: when nothing else is playable, swap the
    // <video> element for the article's thumbnail image. We used to
    // swap in a redditmedia.com iframe here, but that brought Reddit's
    // full post chrome (subreddit banner, Join button, author line,
    // Reddit logo) and on deleted posts renders "Removed by moderator"
    // — worse than no video at all. A quiet image feels like a
    // normal image-only article and blends into the reader.
    function swapToImageFallback() {
      if (!imageFallback || !v.parentNode) return false;
      // Clear any spinner so the unavailable badge is the only chrome
      // visible on the still image.
      clearLoadingOverlay();
      var parent = v.parentNode;
      var img = document.createElement('img');
      img.src = imageFallback;
      img.alt = '';
      img.onerror = function(){ this.style.display = 'none'; };
      parent.replaceChild(img, v);
      // Add a small "video unavailable" overlay so learners whose
      // network blocks v.redd.it (or who hit a removed Reddit post)
      // understand the hero image is a stand-in, not the full
      // article media. Positioned on the parent which is already a
      // 16:9 slot with overflow:hidden.
      if (parent && getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      if (parent && !parent.querySelector('.kh-video-fallback-badge')) {
        var badge = document.createElement('div');
        badge.className = 'kh-video-fallback-badge';
        badge.textContent = 'Video unavailable';
        badge.style.cssText =
          'position:absolute;left:12px;bottom:12px;z-index:5;' +
          'background:rgba(8,16,31,.75);color:#fff;' +
          'padding:5px 10px;border-radius:999px;' +
          'font-size:11px;font-weight:700;letter-spacing:.02em;' +
          'font-family:inherit;pointer-events:none;' +
          'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
          'box-shadow:0 2px 8px rgba(0,0,0,.25);';
        parent.appendChild(badge);
      }
      return true;
    }

    // Final degrade path: video survives via silent MP4, audio is
    // attempted via the resolver's separate audio track if available.
    // This is the *last* layer of the playback funnel: HLS resolve →
    // HLS playback → degrade(silent MP4 + companion audio).
    //
    // First failure now triggers ONE full retry through the resolver
    // before degrading. Reddit's fragment CDN occasionally 503s the
    // first hit and the URL is genuinely fresh on retry — without this
    // the user saw "Video unavailable" briefly and then on a manual
    // refresh the same video played fine.
    function degrade(reason) {
      if (v.dataset.khHlsDegraded === '1') return;
      if (!retryAttempted && permalink) {
        retryAttempted = true;
        khLog('[hero-video] first attempt failed, re-resolving:', reason || 'unknown');
        try { if (window._khHlsInstances && window._khHlsInstances.get(v)) { window._khHlsInstances.get(v).destroy(); window._khHlsInstances.delete(v); } } catch(e) {}
        v.removeAttribute('src');
        ensureLoadingOverlay();
        // Re-resolve and try again. If the retry also fails, the
        // second degrade() call falls through to the silent-MP4 /
        // image-fallback path below.
        _khResolveReddit(permalink).then(function(r) {
          if (r) {
            freshHls      = r.hls_url      || freshHls;
            freshAudio    = r.audio_url    || freshAudio;
            freshFallback = r.video_url    || freshFallback;
          }
          startWithFreshUrls();
        }).catch(function(){ degrade(reason + ':retry-failed'); });
        return;
      }
      v.dataset.khHlsDegraded = '1';
      try { if (window._khHlsInstances && window._khHlsInstances.get(v)) { window._khHlsInstances.get(v).destroy(); window._khHlsInstances.delete(v); } } catch(e) {}
      v.removeAttribute('src');
      var fbSrc = freshFallback || fallback;
      if (fbSrc) {
        // Arm the same error-based iframe swap so a dead MP4 fallback
        // (signed URL expired) still degrades gracefully instead of
        // showing the broken-video icon.
        armMp4ErrorSwap();
        v.src = _khProxyRedditUrl(fbSrc);
        v.load();
        // Layer audio back on so the "degraded" path keeps audio alive.
        // Without this, every HLS failure = silent video, defeating the
        // whole point of the resolver.
        if (freshAudio) {
          var companion = _khAttachAudioCompanion(v, freshAudio);
          // If the audio companion itself 404s (the DASH_AUDIO_128
          // guess was wrong for this post), surface a small "Silent"
          // pill so learners know why the video has no sound.
          if (companion) companion.addEventListener('error', function(){ _khMarkSilent(v); }, { once: true });
        } else {
          // Post genuinely has no audio track (Reddit is_gif=true) —
          // mark the slot immediately so the learner doesn't wait for
          // sound that's never coming.
          _khMarkSilent(v);
        }
        khLog('[hero-video] HLS failed, using silent MP4 + audio companion:', reason || 'unknown');
        return;
      }
      // No MP4 fallback either — last-resort image swap.
      if (swapToImageFallback()) {
        khLog('[hero-video] HLS + resolver failed, swapped to thumbnail image:', reason || 'unknown');
        return;
      }
      khLog('[hero-video] HLS failed with no recoverable source:', reason || 'unknown');
    }

    function attachWithSrc(src) {
      // Safari / iOS — native HLS support, no library needed.
      if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
        v.addEventListener('error', function onErr(){ v.removeEventListener('error', onErr); degrade('native-hls-error'); }, { once: true });
        v.src = src;
        return;
      }
      _khLoadHlsJs().then(function(Hls) {
        if (!Hls || !Hls.isSupported || !Hls.isSupported()) { degrade('hls-not-supported'); return; }
        // Generous retry budget — Reddit segments occasionally 503 on
        // first hit and succeed on retry. Defaults bail out too early.
        var hls = new Hls({
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 500,
          manifestLoadingMaxRetryTimeout: 8000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 500,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 500,
          fragLoadingMaxRetryTimeout: 8000,
        });
        if (!window._khHlsInstances) window._khHlsInstances = new WeakMap();
        window._khHlsInstances.set(v, hls);
        hls.on(Hls.Events.ERROR, function(_, data){
          if (data && data.fatal) degrade('hls-fatal:' + (data.type || '') + '/' + (data.details || ''));
        });
        hls.loadSource(src);
        hls.attachMedia(v);
      }).catch(function(e) {
        degrade('hls-load-failed:' + (e && e.message || ''));
      });
    }

    // Attach a one-shot <video> error listener that swaps to the iframe
    // fallback ONLY when the MP4 fails to even start loading — signed
    // URL expired, CDN 403, etc. A transient error that fires while
    // the video is already playing is not a reason to swap: mobile
    // networks routinely drop packets and recover. Without the
    // readyState guard we were swapping on every blip, so viewers on
    // articles that had been working fine suddenly saw the iframe
    // (or a broken embed) instead of their video.
    //
    // readyState >= 2 means HAVE_CURRENT_DATA — the browser has at
    // least one frame decoded, so the MP4 source IS reachable; the
    // error is mid-playback and the browser's own buffering handles it.
    // We also remove our error hook once loadeddata / canplay fires
    // to prevent any later error from accidentally swapping.
    function armMp4ErrorSwap() {
      function disarm() {
        v.removeEventListener('error', onErr);
        v.removeEventListener('loadeddata', disarm);
        v.removeEventListener('canplay', disarm);
      }
      function onErr() {
        disarm();
        if (v.readyState >= 2) return; // already playing — don't swap
        if (!swapToImageFallback()) {
          khLog('[hero-video] MP4 fallback failed and no iframe fallback available');
        }
      }
      v.addEventListener('error', onErr);
      v.addEventListener('loadeddata', disarm, { once: true });
      v.addEventListener('canplay', disarm, { once: true });
    }

    function startWithFreshUrls() {
      var hls = freshHls || staleSrc;
      var fbSrc = freshFallback || fallback;
      if (!hls && fbSrc) {
        // No HLS at all → straight to silent MP4 + companion audio.
        armMp4ErrorSwap();
        v.src = _khProxyRedditUrl(fbSrc); v.load();
        if (freshAudio) _khAttachAudioCompanion(v, freshAudio);
        return;
      }
      if (!hls && !fbSrc) {
        // Resolver returned nothing and we had no persisted URLs either
        // (typical for legacy reddit-embed rows). Fall back to the
        // original iframe embed so the video is at least visible.
        if (!swapToImageFallback()) {
          khLog('[hero-video] no playable source and no iframe fallback');
        }
        return;
      }
      attachWithSrc(_khProxyRedditUrl(hls));
    }

    // Try to refresh URLs via the resolver before initialising the
    // player. Falls back to stale persisted URLs on resolver failure
    // (offline, function down, etc.) — same behaviour as before this
    // patch for those cases.
    if (permalink) {
      _khResolveReddit(permalink).then(function(r) {
        if (r) {
          freshHls      = r.hls_url      || '';
          freshAudio    = r.audio_url    || '';
          freshFallback = r.video_url    || fallback;
        }
        startWithFreshUrls();
      });
    } else {
      startWithFreshUrls();
    }
  });
}

// Best-effort fallback URL for existing rows saved as 'reddit-hls' before
// video_fallback_url was added. v.redd.it URLs share the same /{ID}/ path,
// and the most commonly-present rendition is DASH_720.mp4?source=fallback.
// If the derived URL doesn't exist, the <video> tag just stays empty —
// same outcome as the HLS failure we're trying to recover from.
function _khDeriveRedditMp4(hlsUrl) {
  if (!hlsUrl || typeof hlsUrl !== 'string') return '';
  var m = hlsUrl.match(/^(https?:\/\/v\.redd\.it\/[^/?#]+)\//);
  if (!m) return '';
  return m[1] + '/DASH_720.mp4?source=fallback';
}
