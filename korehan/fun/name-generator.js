window.KHFunNameGenerator = (function(){
  var QUESTIONS = [
    { id:'scene', q:'Pick your K-drama scene.', options:[
      { label:'☕ Calm café in rain', tags:['calm','gentle','romantic'] },
      { label:'🌃 Neon city at midnight', tags:['bold','active','independent'] },
      { label:'🌸 Cherry blossom confession', tags:['dreamy','romantic','gentle'] },
    ]},
    { id:'role', q:'Your drama role is…', options:[
      { label:'🎬 Main character', tags:['leader','bright','confident'] },
      { label:'⚡ Chaotic best friend', tags:['playful','social','creative'] },
      { label:'🕶️ Mysterious stranger', tags:['independent','calm','rebellious'] },
      { label:'💎 Rich villain', tags:['ambitious','strong','bold'] },
    ]},
    { id:'tone', q:'Which sounds like you most?', options:[
      { label:'🌤️ Soft & warm', tags:['gentle','calm','social'] },
      { label:'🗡️ Sharp & confident', tags:['strong','confident','leader'] },
      { label:'🎲 Playful & unpredictable', tags:['playful','creative','rebellious'] },
    ]},
    { id:'energy', q:'Choose your core energy.', options:[
      { label:'Elegant', tags:['elegant','balanced','gentle'] },
      { label:'Cute', tags:['cute','bright','social'] },
      { label:'Strong', tags:['strong','ambitious','leader'] },
      { label:'Dreamy', tags:['dreamy','romantic','creative'] },
      { label:'Rebellious', tags:['rebellious','independent','bold'] },
    ]}
  ];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = (h ^ str.charCodeAt(i)) * 16777619;
    return Math.abs(h >>> 0);
  }

  function computeMatch(profile, answers) {
    var names = (window.KH_KOREAN_NAME_DATASET || []).slice();
    var wantedGender = profile.gender || 'unisex';
    var answerTags = [];
    answers.forEach(function(a){ answerTags = answerTags.concat(a.tags || []); });

    var birthMonth = Number((profile.birthDate || '').split('-')[1] || 0);
    if ([3,4,5].includes(birthMonth)) answerTags.push('bright');
    if ([6,7,8].includes(birthMonth)) answerTags.push('active');
    if ([9,10,11].includes(birthMonth)) answerTags.push('calm');
    if ([12,1,2].includes(birthMonth)) answerTags.push('smart');

    var seed = hash((profile.firstName || '') + '|' + (profile.lastName || '') + '|' + (profile.birthDate || '') + '|' + wantedGender + '|' + answerTags.join(','));

    var ranked = names.map(function(n){
      var score = 0;
      if (n.gender === wantedGender) score += 18;
      else if (n.gender === 'unisex') score += 10;

      (n.tags || []).forEach(function(tag){
        if (answerTags.indexOf(tag) >= 0) score += 9;
      });

      score += Number(n.popularity || 50) * 0.12;
      score += (seed % 17) * 0.03;
      return { name:n, score:score };
    }).sort(function(a,b){ return b.score - a.score; });

    return ranked[0] ? { picked: ranked[0].name, tags: answerTags } : null;
  }

  function init(root) {
    var state = { step:1, profile:{}, answers:[] };

    function renderStep1() {
      root.innerHTML = '<h2 style="margin:0 0 8px;font-size:22px">Step 1 · Build your profile</h2>'
        + '<p style="margin:0 0 14px;color:#64748b;font-size:13px">Type your name first. More fields unlock automatically.</p>'
        + '<div style="display:grid;gap:12px;max-width:560px">'
        + '<div class="ng-row">'
        + field('First name','text','ng-first','e.g. Emma')
        + field('Last name','text','ng-last','e.g. Watson')
        + '</div>'
        + '<div id="ng-birth-wrap" class="ng-reveal">' + field('Birth date','date','ng-birth','') + '</div>'
        + '<div id="ng-gender-wrap" class="ng-reveal"><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:6px">Gender</label>'
        + '<div class="ng-choice-row">'
        + '<button type="button" class="ng-chip" data-gender="female">Female</button>'
        + '<button type="button" class="ng-chip" data-gender="male">Male</button>'
        + '<button type="button" class="ng-chip" data-gender="unisex">Neutral</button>'
        + '</div></div>'
        + '<button id="ng-next-1" class="ng-primary-btn" disabled>Next</button>'
        + '</div>';

      var firstEl = root.querySelector('#ng-first');
      var lastEl = root.querySelector('#ng-last');
      var birthEl = root.querySelector('#ng-birth');
      var birthWrap = root.querySelector('#ng-birth-wrap');
      var genderWrap = root.querySelector('#ng-gender-wrap');
      var nextBtn = root.querySelector('#ng-next-1');
      var pickedGender = '';

      function refreshStep1() {
        var first = (firstEl.value || '').trim();
        var last = (lastEl.value || '').trim();
        var birth = (birthEl.value || '').trim();

        if (first && last) birthWrap.classList.add('on');
        else {
          birthWrap.classList.remove('on');
          genderWrap.classList.remove('on');
          pickedGender = '';
          root.querySelectorAll('.ng-chip').forEach(function(c){ c.classList.remove('on'); });
        }

        if (birthWrap.classList.contains('on') && birth) genderWrap.classList.add('on');
        else {
          genderWrap.classList.remove('on');
          pickedGender = '';
          root.querySelectorAll('.ng-chip').forEach(function(c){ c.classList.remove('on'); });
        }

        nextBtn.disabled = !(first && last && birth && pickedGender);
      }

      firstEl.addEventListener('input', refreshStep1);
      lastEl.addEventListener('input', refreshStep1);
      birthEl.addEventListener('input', refreshStep1);
      root.querySelectorAll('.ng-chip').forEach(function(chip){
        chip.addEventListener('click', function(){
          root.querySelectorAll('.ng-chip').forEach(function(c){ c.classList.remove('on'); });
          chip.classList.add('on');
          pickedGender = chip.getAttribute('data-gender') || '';
          refreshStep1();
        });
      });

      nextBtn.addEventListener('click', function(){
        var firstName = (firstEl.value || '').trim();
        var lastName = (lastEl.value || '').trim();
        var birthDate = (birthEl.value || '').trim();
        if (!firstName || !lastName || !birthDate || !pickedGender) { return; }
        state.profile = { firstName: firstName, lastName: lastName, birthDate: birthDate, gender: pickedGender };
        state.step = 2;
        render();
      });
    }

    function renderStep2() {
      var html = '<h2 style="margin:0 0 8px;font-size:22px">Step 2 · Vibe quiz</h2>'
        + '<p style="margin:0 0 14px;color:#64748b;font-size:13px">Choose what feels most like your aura.</p>';
      QUESTIONS.forEach(function(q, qi){
        html += '<div style="margin-bottom:16px"><div style="font-size:14px;font-weight:700;margin-bottom:8px">' + q.q + '</div>'
          + '<div class="ng-quiz-grid">'
          + q.options.map(function(opt, oi){
            return '<button type="button" class="ng-quiz-option" data-q="' + qi + '" data-o="' + oi + '">' + opt.label + '</button>';
          }).join('')
          + '</div></div>';
      });
      html += '<button id="ng-next-2" class="ng-primary-btn" disabled>Generate my Korean name</button>';
      root.innerHTML = html;

      var picks = {};
      var nextBtn = root.querySelector('#ng-next-2');

      root.querySelectorAll('.ng-quiz-option').forEach(function(btn){
        btn.addEventListener('click', function(){
          var q = Number(btn.getAttribute('data-q'));
          var o = Number(btn.getAttribute('data-o'));
          picks[q] = o;
          root.querySelectorAll('.ng-quiz-option[data-q=\"' + q + '\"]').forEach(function(el){ el.classList.remove('on'); });
          btn.classList.add('on');
          nextBtn.disabled = Object.keys(picks).length !== QUESTIONS.length;
        });
      });

      root.querySelector('#ng-next-2').addEventListener('click', function(){
        var selected = [];
        for (var i = 0; i < QUESTIONS.length; i++) {
          if (typeof picks[i] !== 'number') { return; }
          selected.push(QUESTIONS[i].options[picks[i]]);
        }
        state.answers = selected;
        state.step = 3;
        renderReveal();
      });
    }

    function renderReveal() {
      var match = computeMatch(state.profile, state.answers);
      if (!match || !match.picked) { root.innerHTML = '<p>No dataset available.</p>'; return; }
      var picked = match.picked;
      var leadTags = Array.from(new Set(match.tags)).slice(0, 3);
      root.innerHTML = '<h2 style="margin:0 0 8px;font-size:22px">Step 3 · Name reveal</h2>'
        + '<div class="ng-reveal-stage" id="ng-reveal-stage">Analyzing your drama aura…</div>'
        + '<div class="ng-hint-row" id="ng-hint-row" style="display:none"></div>'
        + '<div class="ng-final-card" id="ng-final-card" style="display:none">'
        + '<div class="ng-final-label">Your Korean name</div>'
        + '<div class="ng-final-hangul">' + picked.hangul + '</div>'
        + '<div class="ng-final-rom">' + picked.romanization + '</div>'
        + '<div class="ng-final-desc">Meaning: ' + picked.meaning + '. This match fits your selected vibe and profile energy.</div>'
        + '</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">'
        + '<button id="ng-restart" class="ng-secondary-btn">Try another run</button>'
        + '<a href="korehan-fun.html" class="ng-secondary-link">Back to FUN Home</a>'
        + '</div>';

      var stage = root.querySelector('#ng-reveal-stage');
      var hintRow = root.querySelector('#ng-hint-row');
      var card = root.querySelector('#ng-final-card');
      setTimeout(function(){ stage.textContent = 'Matching from Korean name archive…'; }, 650);
      setTimeout(function(){
        stage.textContent = 'Found your vibe key';
        hintRow.style.display = '';
        hintRow.innerHTML = leadTags.map(function(t){ return '<span class=\"ng-hint-chip\">' + t + '</span>'; }).join('');
      }, 1500);
      setTimeout(function(){
        stage.textContent = 'Reveal complete ✨';
        card.style.display = '';
        card.classList.add('on');
      }, 2300);

      root.querySelector('#ng-restart').addEventListener('click', function(){ state = { step:1, profile:{}, answers:[] }; render(); });
    }

    function render() {
      if (state.step === 1) renderStep1();
      else if (state.step === 2) renderStep2();
      else renderReveal();
    }

    render();
  }

  function field(label, type, id, placeholder) {
    return '<div><label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:6px">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" placeholder="' + placeholder + '" class="ng-input"></div>';
  }

  return { init:init };
})();
