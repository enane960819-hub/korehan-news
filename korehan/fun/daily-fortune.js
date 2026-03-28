window.KHFunFortune = (function(){
  var lines = [
    'A small Korean phrase you review today will appear in a real conversation soon.',
    'Your consistency beats intensity today. Ten focused minutes wins.',
    'A lucky moment comes when you speak first instead of translating too long.',
    'Today favors light practice: one article + one mini quiz + one sentence out loud.',
    'Unexpected progress appears when you revisit old saved words.'
  ];

  function seedNum() {
    var d = new Date();
    return Number(String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'));
  }

  function score(base, mod) {
    return 40 + ((base * mod) % 61);
  }

  function init(root) {
    var s = seedNum();
    var fortune = {
      overall: score(s, 3),
      love: score(s, 5),
      study: score(s, 7),
      money: score(s, 11),
      line: lines[s % lines.length],
    };

    root.innerHTML = '<div class="fun-title"><h2>🔮 Today\'s Fortune</h2><button class="btn ghost" id="fortune-refresh">Try another vibe</button></div>'
      + '<div class="fortune-grid">'
      + card('Overall luck', fortune.overall)
      + card('Love', fortune.love)
      + card('Study', fortune.study)
      + card('Money', fortune.money)
      + '</div>'
      + '<div class="fortune-msg">' + fortune.line + '</div>';

    root.querySelector('#fortune-refresh').addEventListener('click', function(){
      lines.push(lines.shift());
      init(root);
    });
  }

  function card(title, value) {
    return '<div class="fortune-card"><b>' + title + '</b><div class="fortune-score">' + value + '%</div></div>';
  }

  return { init:init };
})();
