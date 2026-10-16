/* ──────────────────────────────────────────────────────────────
 * KoreHani K-Express curriculum
 *
 * 50 stations total, 6 major "transfer" stations that gate the
 * next level of content. Preview in Growth Lab shows the 6 majors;
 * the full modal unlocks every local stop with its outcomes.
 * ────────────────────────────────────────────────────────────── */
(function(){
  var STATIONS = [
    /* ── Starter: 한글역 → 일상 회화역 ─────────────────────── */
    { id:'hangul',     name:'한글역',         en:'Gate of Hangul',    emoji:'🚩', major:true,  pct:0.00,
      can_do:['Read all Hangul letters aloud','Greetings like hello and thank you','Say the numbers 1-10','Days of the week, today, tomorrow'],
      grammar:['자음 19개 / 모음 21개','받침 기본','명사 + 이에요/예요'],
      unlocks:['Seed-level articles','Hangul typing practice','Basic greeting conversations'] },
    { id:'jamo',       name:'자음·모음',      en:'Consonants & Vowels', emoji:'🔤', pct:0.02,
      can_do:['Read all 19 consonants perfectly','21 vowels (basic + compound)'], grammar:['자모 결합 규칙'] },
    { id:'batchim',    name:'받침',            en:'Batchim',            emoji:'🔠', pct:0.04,
      can_do:['Read single and double batchim','Distinguish final-consonant sounds'], grammar:['7대 대표 종성 발음'] },
    { id:'number-k',   name:'우리말 수',       en:'Native Numbers',     emoji:'🔢', pct:0.06,
      can_do:['Count hana, dul, set… yeol','Express age and quantity'], grammar:['하나+개, 한+사람 패턴'] },
    { id:'number-c',   name:'한자어 수',       en:'Sino Numbers',       emoji:'🔟', pct:0.08,
      can_do:['Numbers il, i, sam… baek','Prices, phone numbers, dates'], grammar:['한자어 숫자 규칙'] },
    { id:'time-day',   name:'시간·요일',       en:'Time & Days',        emoji:'⏰', pct:0.10,
      can_do:['Answer "what time is it?"','Monday through Sunday','AM / PM'], grammar:['시간 + 에'] },
    { id:'color-fam',  name:'색깔·가족',       en:'Colors & Family',    emoji:'🎨', pct:0.13,
      can_do:['Basic colors like red and blue','Family terms: mom, dad, older brother, older sister'], grammar:['가족 호칭 존댓말'] },

    /* ── Beginner: 일상 회화역 → 뉴스역 ────────────────────── */
    { id:'daily',      name:'일상 회화역',     en:'Daily Talk',          emoji:'🌱', major:true, pct:0.16,
      can_do:['Introduce yourself','Order at a restaurant','Ask for directions','Buy things at a shop'],
      grammar:['-아요/-어요 존댓말','기본 조사 은/는, 이/가','-고 싶다, -아/어 주세요'],
      unlocks:['Sprout-level articles','Simple conversations','Shopping/food vocab pack'] },
    { id:'honor-1',    name:'존댓말 기초',     en:'Polite Basics',       emoji:'🙇', pct:0.19,
      can_do:['Distinguish -아요/-어요','Recognize the -습니다 style'], grammar:['-아/어/해요','-ㅂ/습니다'] },
    { id:'particle-1', name:'조사 1',          en:'Particles I',         emoji:'🎯', pct:0.21,
      can_do:['Distinguish 은/는 (topic) vs 이/가 (subject)'], grammar:['은/는/이/가 기본 규칙'] },
    { id:'particle-2', name:'조사 2',          en:'Particles II',        emoji:'🎯', pct:0.23,
      can_do:['을/를 object marker','에/에서 for place','와/과 to connect'], grammar:['을/를/에/에서/와/과'] },
    { id:'tense-now',  name:'현재 시제',       en:'Present',             emoji:'📅', pct:0.25,
      can_do:['Express present actions and states'], grammar:['-아/어요 동사 활용'] },
    { id:'tense-past', name:'과거·미래',       en:'Past & Future',       emoji:'⏳', pct:0.27,
      can_do:['Answer "what did you do yesterday?"','Talk about plans for tomorrow'], grammar:['-았/었어요','-(으)ㄹ 거예요'] },
    { id:'food-order', name:'음식 주문',       en:'Ordering Food',       emoji:'🍜', pct:0.29,
      can_do:['Choose from the menu at a restaurant','Request spicy or non-spicy'], grammar:['-아/어 주세요'] },
    { id:'directions', name:'길 묻기',         en:'Directions',          emoji:'🗺️', pct:0.31,
      can_do:['Ask where a station or stop is','Left / right / straight ahead'], grammar:['어디에 있어요?','-(으)로 가세요'] },
    { id:'shopping',   name:'쇼핑',            en:'Shopping',            emoji:'🛍️', pct:0.33,
      can_do:['Ask prices and haggle','Request size and color'], grammar:['얼마예요?','-(으)ㄹ 수 있어요'] },
    { id:'hospital',   name:'병원·약국',       en:'Health',              emoji:'🏥', pct:0.35,
      can_do:['Describe symptoms','Get medicine'], grammar:['-아/어서 (이유)','-(으)면'] },
    { id:'wish-ask',   name:'원해요·부탁',     en:'Wish & Ask',          emoji:'💭', pct:0.37,
      can_do:['-고 싶다 (wanting)','-아/어 주세요 (requesting)'], grammar:['-고 싶다','-아/어 주세요'] },

    /* ── Intermediate: 뉴스역 → 문화역 ─────────────────────── */
    { id:'news',       name:'뉴스역',          en:'News Reader',         emoji:'🌳', major:true, pct:0.42,
      can_do:['Understand short news headlines','Basic current-affairs terms','Interpret quotations','Identify politics/economy keywords'],
      grammar:['-다고 하다 (간접화법)','-(으)ㄹ 것 같다','-는/(으)ㄴ 것','-에 따르면'],
      unlocks:['Tree-level articles','Some Stories','Current-affairs vocabulary'] },
    { id:'sino-word',  name:'한자어 패턴',     en:'Sino-Korean',         emoji:'🈶', pct:0.45,
      can_do:['Guess words from Sino-Korean roots','Prefix/suffix patterns'], grammar:['한자어 복합어 구조'] },
    { id:'indirect',   name:'간접화법',        en:'Indirect Speech',     emoji:'💬', pct:0.47,
      can_do:['Quote with ~라고 했어요'], grammar:['-다고/라고/냐고/자고 하다'] },
    { id:'seems-like', name:'추측·가정',       en:'Conjecture',          emoji:'🤔', pct:0.49,
      can_do:['-(으)ㄹ 것 같다','-(으)면'], grammar:['-(으)ㄹ 것 같다','-(으)면'] },
    { id:'connect-adv',name:'접속어 심화',     en:'Advanced Connectors', emoji:'🔗', pct:0.51,
      can_do:['Therefore / thus / on the other hand','Follow logical flow'], grammar:['논리 접속사'] },
    { id:'econ-pol',   name:'경제·정치',       en:'Economy & Politics',  emoji:'💰', pct:0.53,
      can_do:['Understand articles on rates, exchange, policy'], grammar:['경제 어휘 패턴'] },
    { id:'society',    name:'사회 이슈',       en:'Social Issues',       emoji:'🏛️', pct:0.55,
      can_do:['Read social-issue articles (education/environment/labor)'], grammar:['추상명사 패턴'] },
    { id:'idiom-b',    name:'관용어 입문',     en:'Idioms I',            emoji:'🗣️', pct:0.57,
      can_do:['Body-part idioms like 손이 크다, 발이 넓다'], grammar:['관용 표현 구조'] },
    { id:'proverb-b',  name:'속담 입문',       en:'Proverbs I',          emoji:'📜', pct:0.59,
      can_do:['Proverbs such as 가는 말이 고와야 오는 말이 곱다'], grammar:['속담 해석법'] },
    { id:'interview',  name:'인터뷰·토론',     en:'Interview',           emoji:'🎤', pct:0.61,
      can_do:['Understand interview structure','Express opinions'], grammar:['-라고 생각하다','-지 않을까요'] },

    /* ── Upper-intermediate: 문화역 → 비즈니스역 ──────────── */
    { id:'culture',    name:'문화역',          en:'Culture Fluent',      emoji:'🎭', major:true, pct:0.66,
      can_do:['Understand 60% of K-dramas without subtitles','Understand colloquial movie speech','Use idioms and slang','Interpret K-pop lyrics'],
      grammar:['-더라, -던','높임말·반말 완벽 구분','-(으)ㄹ걸, -거든'],
      unlocks:['Forest-level articles','All Stories','Culture & entertainment content'] },
    { id:'kdrama',     name:'K-드라마 표현',   en:'K-Drama',             emoji:'📺', pct:0.69,
      can_do:['Drama colloquial speech','Situational reactions'], grammar:['-잖아, -거든'] },
    { id:'movie',      name:'영화 자막 없이',  en:'No-Subs Movies',      emoji:'🎬', pct:0.71,
      can_do:['Understand 60-70% of movies','Keep up with fast speech'], grammar:['축약형','말줄임'] },
    { id:'culture-exp',name:'문화 관용표현',   en:'Cultural Phrases',    emoji:'✨', pct:0.73,
      can_do:['Slang like 화이팅, 답정너, 꿀잼'], grammar:['신조어 구조'] },
    { id:'honor-adv',  name:'존경 어미 심화',  en:'Honorifics Adv.',     emoji:'🙏', pct:0.75,
      can_do:['-(으)시-, humble expressions','Master honorific speech'], grammar:['-(으)시-, 뵙다, 드시다'] },
    { id:'long-sent',  name:'긴 문장',         en:'Complex Sentences',   emoji:'📖', pct:0.77,
      can_do:['Parse 3-4 line complex sentences'], grammar:['관형형 중첩'] },
    { id:'essay',      name:'에세이',          en:'Essay Writing',       emoji:'✍️', pct:0.79,
      can_do:['Write 200-300 character essays','Body and conclusion structure'], grammar:['서론-본론-결론 패턴'] },
    { id:'debate',     name:'설득·논쟁',       en:'Persuasion',          emoji:'⚖️', pct:0.81,
      can_do:['Present claims and evidence','Rebuttal expressions'], grammar:['-(으)ㄴ/는 반면','-기 때문에'] },
    { id:'humor',      name:'유머·풍자',       en:'Humor & Satire',      emoji:'😄', pct:0.83,
      can_do:['Understand jokes and satire','Contextual humor'], grammar:['반어법','풍자 어투'] },
    { id:'kpop',       name:'K-pop 가사',      en:'K-pop Lyrics',        emoji:'🎵', pct:0.85,
      can_do:['Interpret and appreciate lyrics','Understand metaphors'], grammar:['시적 표현'] },

    /* ── Business Korean → Summit ─────────────────────────── */
    { id:'business',   name:'비즈니스역',      en:'Business Korean',     emoji:'💼', major:true, pct:0.88,
      can_do:['Write formal emails','Give opinions in meetings','Deliver official presentations','Workplace etiquette language'],
      grammar:['-(스)ㅂ니다체 완벽','공문 어투','존경-겸양 혼합 구사'],
      unlocks:['Business conversations','Official Writing lessons','Email templates'] },
    { id:'doc-formal', name:'공식 문서',       en:'Formal Docs',         emoji:'📋', pct:0.90,
      can_do:['Read reports and proposals'], grammar:['-함, -임, -(으)ㄴ 바'] },
    { id:'email',      name:'이메일 매너',     en:'Email Etiquette',     emoji:'📧', pct:0.91,
      can_do:['Write formal emails','Closing greetings'], grammar:['-드립니다','-바랍니다'] },
    { id:'present',    name:'프레젠테이션',    en:'Presentations',       emoji:'🖼️', pct:0.92,
      can_do:['Presentation structure','Explain charts and graphs'], grammar:['-에 따르면','-(으)ㄹ 것입니다'] },
    { id:'meeting',    name:'회의 표현',       en:'Meetings',            emoji:'👥', pct:0.93,
      can_do:['Exchange opinions','Politely express disagreement'], grammar:['-(으)면 어떨까요'] },
    { id:'jargon',     name:'전문 용어',       en:'Technical',           emoji:'🔬', pct:0.94,
      can_do:['Basic legal/medical/IT terms'], grammar:['전문 용어 패턴'] },
    { id:'formal-mast',name:'격식체 완벽',     en:'Formal Mastery',      emoji:'🎩', pct:0.95,
      can_do:['Speak flawlessly in formal settings'], grammar:['-(스)ㅂ니다체 전 영역'] },

    { id:'fluency',    name:'유창역',          en:'Fluency Summit',      emoji:'🗻', major:true, pct:1.00,
      can_do:['Debate abstract topics','Read literary and academic texts','Native-level nuance','TOPIK 6 pass level'],
      grammar:['모든 문법 자유 구사','문어체·구어체 전환','수사적 표현'],
      unlocks:['All Advanced content','Papers and literature','TOPIK 6 prep pack'] },
    { id:'academic',   name:'논문·학술',       en:'Academic',            emoji:'🎓', pct:0.97,
      can_do:['Read academic papers','Conference presentations'], grammar:['학술 문어체'] },
    { id:'literature', name:'문학',             en:'Literature',          emoji:'📚', pct:0.98,
      can_do:['Read short stories','Appreciate poetry'], grammar:['문학적 표현'] },
    { id:'news-debate',name:'시사 토론',       en:'Current Debate',      emoji:'🗳️', pct:0.99,
      can_do:['Debate current issues in depth'], grammar:['토론 고급 표현'] }
  ];

  // Overall progress = mean of each skill's clamped ratio to its cap.
  var SKILL_CAP = { words: 500, articles: 120, quizzes: 150, streak: 100, xp: 7500 };
  function computeOverall(stats) {
    if (!stats) return 0;
    var keys = ['words','articles','quizzes','streak','xp'];
    var sum = 0;
    keys.forEach(function(k){ sum += Math.min(1, (stats[k] || 0) / SKILL_CAP[k]); });
    return sum / keys.length;
  }

  window.KH_CURRICULUM = {
    STATIONS: STATIONS,
    SKILL_CAP: SKILL_CAP,
    computeOverall: computeOverall,
    majors: function() { return STATIONS.filter(function(s){ return s.major; }); }
  };
})();
