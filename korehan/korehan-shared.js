/* ============================================================
   KoreHan News — Shared JS (Module Loader)
   Split into individual modules in js/ directory.
   This file loads them all in order for backward compatibility.
   ============================================================ */
(function() {
  // Neon flash prevention — must run before any rendering
  try {
    var neon = localStorage.getItem('korehan_neon_theme');
    if (neon === '1') {
      if (document.body) document.body.classList.add('kh-neon-on');
      else {
        document.documentElement.classList.add('kh-neon-on');
        document.addEventListener('DOMContentLoaded', function() {
          document.documentElement.classList.remove('kh-neon-on');
          if (document.body) document.body.classList.add('kh-neon-on');
        }, { once: true });
      }
    }
  } catch(e) {}

  // Load modules synchronously in dependency order
  var modules = [
    'kh-core',
    'kh-cache',
    'kh-auth',
    'kh-ui',
    'kh-phrases',
    'kh-vocab',
    'kh-articles',
    'kh-article-page',
    'kh-badges',
    'kh-daily',
    'kh-init'
  ];
  var base = '';
  if (document.currentScript && document.currentScript.src) {
    base = document.currentScript.src.replace(/[^/]*$/, '');
  }
  var v = '20260403';
  modules.forEach(function(m) {
    document.write('<script src="' + base + 'js/' + m + '.js?v=' + v + '"><\/script>');
  });
})();
