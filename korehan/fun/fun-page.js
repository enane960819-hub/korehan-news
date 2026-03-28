window.KHFunPage = (function(){
  function mountPage(config) {
    var titleEl = document.getElementById('fun-page-title');
    var subEl = document.getElementById('fun-page-sub');
    if (titleEl) titleEl.textContent = config.title || 'FUN';
    if (subEl) subEl.textContent = config.subtitle || '';

    var root = document.getElementById('fun-page-root');
    if (root && typeof config.mount === 'function') config.mount(root);
  }
  return { mountPage: mountPage };
})();
