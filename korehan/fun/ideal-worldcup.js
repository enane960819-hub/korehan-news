window.KHFunWorldCup = (function(){
  var CANDIDATES = [
    { title:'Cafe date in Hongdae', desc:'Talk about music and daily life in Korean.' },
    { title:'Han River night walk', desc:'Simple Korean phrases + chill vibe.' },
    { title:'Bookstore browsing', desc:'Learn Korean words from covers and blurbs.' },
    { title:'Street food challenge', desc:'Order snacks only in Korean.' },
    { title:'Noraebang session', desc:'Sing + read Korean lyrics naturally.' },
    { title:'Museum + photo walk', desc:'Describe artworks with new vocab.' },
    { title:'Board game cafe', desc:'Fast conversation and reaction phrases.' },
    { title:'Sunrise hike', desc:'Motivation energy + daily routine talk.' },
  ];

  function shuffled() {
    var arr = CANDIDATES.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function init(root) {
    var state = { round: 8, pool: shuffled() };

    function nextRound(choice) {
      var next = state.next || [];
      next.push(choice);
      if (next.length >= state.round / 2) {
        state.pool = next;
        state.round = state.pool.length;
        state.next = [];
      } else {
        state.next = next;
      }
      render();
    }

    function renderWinner(item) {
      root.innerHTML = '<div class="fun-title"><h2>🏆 Ideal Type World Cup</h2><button class="btn ghost" id="fun-wc-restart">Restart</button></div>'
        + '<div class="name-result"><div class="name-ko">Winner: ' + item.title + '</div><div class="name-meaning">' + item.desc + '</div></div>';
      root.querySelector('#fun-wc-restart').addEventListener('click', function(){ state = { round:8, pool:shuffled() }; render(); });
    }

    function render() {
      if (state.pool.length === 1) { renderWinner(state.pool[0]); return; }
      var idx = state.next ? state.next.length * 2 : 0;
      var a = state.pool[idx], b = state.pool[idx + 1];
      root.innerHTML = '<div class="fun-title"><h2>🏆 Ideal Type World Cup</h2><span class="muted">Reusable bracket structure</span></div>'
        + '<div class="wc-progress">Round of ' + state.round + '</div>'
        + '<div class="wc-stage">'
        + '<button class="wc-option" id="wc-a"><h4>' + a.title + '</h4><p>' + a.desc + '</p></button>'
        + '<div class="wc-vs">VS</div>'
        + '<button class="wc-option" id="wc-b"><h4>' + b.title + '</h4><p>' + b.desc + '</p></button>'
        + '</div>';
      root.querySelector('#wc-a').addEventListener('click', function(){ nextRound(a); });
      root.querySelector('#wc-b').addEventListener('click', function(){ nextRound(b); });
    }

    render();
  }

  return { init:init };
})();
