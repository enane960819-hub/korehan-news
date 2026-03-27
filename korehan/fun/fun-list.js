(function(){
  function renderList() {
    var list = window.KH_FUN_GAMES || [];
    var el = document.getElementById('fun-game-grid');
    if (!el) return;
    el.innerHTML = list.map(function(game){
      return '<a class="fun-game-card" href="' + game.href + '">'
        + '<div class="fun-game-cover" style="background:' + game.accent + '"><span>' + game.icon + '</span></div>'
        + '<div class="fun-game-body">'
        + '<div class="fun-game-sub">' + game.subtitle + '</div>'
        + '<div class="fun-game-title">' + game.title + '</div>'
        + '<div class="fun-game-desc">' + game.description + '</div>'
        + '</div>'
        + '</a>';
    }).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderList);
  else renderList();
})();
