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
      can_do:['모든 한글 자모를 소리 내어 읽을 수 있어요','안녕하세요·감사합니다 같은 인사','1-10 숫자 말하기','요일·오늘·내일'],
      grammar:['자음 19개 / 모음 21개','받침 기본','명사 + 이에요/예요'],
      unlocks:['Seed 레벨 기사','한글 입력 연습','기본 인사 회화'] },
    { id:'jamo',       name:'자음·모음',      en:'Consonants & Vowels', emoji:'🔤', pct:0.02,
      can_do:['자음 19개 완벽 읽기','모음 21개 (기본+복합)'], grammar:['자모 결합 규칙'] },
    { id:'batchim',    name:'받침',            en:'Batchim',            emoji:'🔠', pct:0.04,
      can_do:['홑받침/겹받침 읽기','종성 발음 차이 구분'], grammar:['7대 대표 종성 발음'] },
    { id:'number-k',   name:'우리말 수',       en:'Native Numbers',     emoji:'🔢', pct:0.06,
      can_do:['하나·둘·셋…열 세기','나이·개수 표현'], grammar:['하나+개, 한+사람 패턴'] },
    { id:'number-c',   name:'한자어 수',       en:'Sino Numbers',       emoji:'🔟', pct:0.08,
      can_do:['일·이·삼…백 숫자','가격·전화번호·날짜'], grammar:['한자어 숫자 규칙'] },
    { id:'time-day',   name:'시간·요일',       en:'Time & Days',        emoji:'⏰', pct:0.10,
      can_do:['지금 몇 시예요? 대답','월요일~일요일','오전/오후'], grammar:['시간 + 에'] },
    { id:'color-fam',  name:'색깔·가족',       en:'Colors & Family',    emoji:'🎨', pct:0.13,
      can_do:['빨강·파랑 등 기본 색','엄마·아빠·형·누나 호칭'], grammar:['가족 호칭 존댓말'] },

    /* ── Beginner: 일상 회화역 → 뉴스역 ────────────────────── */
    { id:'daily',      name:'일상 회화역',     en:'Daily Talk',          emoji:'🌱', major:true, pct:0.16,
      can_do:['자기소개를 할 수 있어요','식당에서 주문','길을 물어볼 수 있어요','가게에서 물건 사기'],
      grammar:['-아요/-어요 존댓말','기본 조사 은/는, 이/가','-고 싶다, -아/어 주세요'],
      unlocks:['Sprout 레벨 기사','간단한 회화','쇼핑/음식 어휘 팩'] },
    { id:'honor-1',    name:'존댓말 기초',     en:'Polite Basics',       emoji:'🙇', pct:0.19,
      can_do:['-아요/-어요 구분','-습니다체 인식'], grammar:['-아/어/해요','-ㅂ/습니다'] },
    { id:'particle-1', name:'조사 1',          en:'Particles I',         emoji:'🎯', pct:0.21,
      can_do:['은/는 (화제) vs 이/가 (주격) 구분'], grammar:['은/는/이/가 기본 규칙'] },
    { id:'particle-2', name:'조사 2',          en:'Particles II',        emoji:'🎯', pct:0.23,
      can_do:['을/를 목적격','에/에서 장소','와/과 연결'], grammar:['을/를/에/에서/와/과'] },
    { id:'tense-now',  name:'현재 시제',       en:'Present',             emoji:'📅', pct:0.25,
      can_do:['현재 동작·상태 표현'], grammar:['-아/어요 동사 활용'] },
    { id:'tense-past', name:'과거·미래',       en:'Past & Future',       emoji:'⏳', pct:0.27,
      can_do:['어제 뭐 했어요? 답하기','내일 계획 말하기'], grammar:['-았/었어요','-(으)ㄹ 거예요'] },
    { id:'food-order', name:'음식 주문',       en:'Ordering Food',       emoji:'🍜', pct:0.29,
      can_do:['식당에서 메뉴 고르기','매운 거/안 매운 거 요청'], grammar:['-아/어 주세요'] },
    { id:'directions', name:'길 묻기',         en:'Directions',          emoji:'🗺️', pct:0.31,
      can_do:['역/정류장 위치 묻기','왼쪽/오른쪽/똑바로'], grammar:['어디에 있어요?','-(으)로 가세요'] },
    { id:'shopping',   name:'쇼핑',            en:'Shopping',            emoji:'🛍️', pct:0.33,
      can_do:['가격 묻기·깎기','사이즈·색깔 요청'], grammar:['얼마예요?','-(으)ㄹ 수 있어요'] },
    { id:'hospital',   name:'병원·약국',       en:'Health',              emoji:'🏥', pct:0.35,
      can_do:['증상 설명','약 구하기'], grammar:['-아/어서 (이유)','-(으)면'] },
    { id:'wish-ask',   name:'원해요·부탁',     en:'Wish & Ask',          emoji:'💭', pct:0.37,
      can_do:['-고 싶다 (원함)','-아/어 주세요 (부탁)'], grammar:['-고 싶다','-아/어 주세요'] },

    /* ── Intermediate: 뉴스역 → 문화역 ─────────────────────── */
    { id:'news',       name:'뉴스역',          en:'News Reader',         emoji:'🌳', major:true, pct:0.42,
      can_do:['짧은 뉴스 헤드라인 이해','기본 시사 용어','인용문 해석','정치/경제 키워드 식별'],
      grammar:['-다고 하다 (간접화법)','-(으)ㄹ 것 같다','-는/(으)ㄴ 것','-에 따르면'],
      unlocks:['Tree 레벨 기사','Stories 일부','시사 단어장'] },
    { id:'sino-word',  name:'한자어 패턴',     en:'Sino-Korean',         emoji:'🈶', pct:0.45,
      can_do:['한자어 기반 단어 추측','접두사/접미사 패턴'], grammar:['한자어 복합어 구조'] },
    { id:'indirect',   name:'간접화법',        en:'Indirect Speech',     emoji:'💬', pct:0.47,
      can_do:['~라고 했어요 인용'], grammar:['-다고/라고/냐고/자고 하다'] },
    { id:'seems-like', name:'추측·가정',       en:'Conjecture',          emoji:'🤔', pct:0.49,
      can_do:['-(으)ㄹ 것 같다','-(으)면'], grammar:['-(으)ㄹ 것 같다','-(으)면'] },
    { id:'connect-adv',name:'접속어 심화',     en:'Advanced Connectors', emoji:'🔗', pct:0.51,
      can_do:['그러므로/따라서/반면','논리 전개 이해'], grammar:['논리 접속사'] },
    { id:'econ-pol',   name:'경제·정치',       en:'Economy & Politics',  emoji:'💰', pct:0.53,
      can_do:['금리·환율·정책 기사 이해'], grammar:['경제 어휘 패턴'] },
    { id:'society',    name:'사회 이슈',       en:'Social Issues',       emoji:'🏛️', pct:0.55,
      can_do:['사회 이슈 읽기 (교육/환경/노동)'], grammar:['추상명사 패턴'] },
    { id:'idiom-b',    name:'관용어 입문',     en:'Idioms I',            emoji:'🗣️', pct:0.57,
      can_do:['손이 크다, 발이 넓다 등 신체 관용어'], grammar:['관용 표현 구조'] },
    { id:'proverb-b',  name:'속담 입문',       en:'Proverbs I',          emoji:'📜', pct:0.59,
      can_do:['가는 말이 고와야 오는 말이 곱다 등'], grammar:['속담 해석법'] },
    { id:'interview',  name:'인터뷰·토론',     en:'Interview',           emoji:'🎤', pct:0.61,
      can_do:['인터뷰 구조 이해','의견 표현'], grammar:['-라고 생각하다','-지 않을까요'] },

    /* ── Upper-intermediate: 문화역 → 비즈니스역 ──────────── */
    { id:'culture',    name:'문화역',          en:'Culture Fluent',      emoji:'🎭', major:true, pct:0.66,
      can_do:['K-드라마를 자막 없이 60% 이해','영화 구어체 이해','관용 표현·유행어 사용','K-pop 가사 해석'],
      grammar:['-더라, -던','높임말·반말 완벽 구분','-(으)ㄹ걸, -거든'],
      unlocks:['Forest 레벨 기사','모든 Stories','문화·예능 콘텐츠'] },
    { id:'kdrama',     name:'K-드라마 표현',   en:'K-Drama',             emoji:'📺', pct:0.69,
      can_do:['드라마 구어체','상황별 반응 표현'], grammar:['-잖아, -거든'] },
    { id:'movie',      name:'영화 자막 없이',  en:'No-Subs Movies',      emoji:'🎬', pct:0.71,
      can_do:['영화 60-70% 이해','빠른 구어 쫓아가기'], grammar:['축약형','말줄임'] },
    { id:'culture-exp',name:'문화 관용표현',   en:'Cultural Phrases',    emoji:'✨', pct:0.73,
      can_do:['화이팅, 답정너, 꿀잼 등 유행어'], grammar:['신조어 구조'] },
    { id:'honor-adv',  name:'존경 어미 심화',  en:'Honorifics Adv.',     emoji:'🙏', pct:0.75,
      can_do:['-(으)시-, 겸양 표현','높임말 완벽'], grammar:['-(으)시-, 뵙다, 드시다'] },
    { id:'long-sent',  name:'긴 문장',         en:'Complex Sentences',   emoji:'📖', pct:0.77,
      can_do:['3-4줄 복합문 해석'], grammar:['관형형 중첩'] },
    { id:'essay',      name:'에세이',          en:'Essay Writing',       emoji:'✍️', pct:0.79,
      can_do:['200-300자 에세이 작성','본론·결론 구조'], grammar:['서론-본론-결론 패턴'] },
    { id:'debate',     name:'설득·논쟁',       en:'Persuasion',          emoji:'⚖️', pct:0.81,
      can_do:['주장·근거 제시','반박 표현'], grammar:['-(으)ㄴ/는 반면','-기 때문에'] },
    { id:'humor',      name:'유머·풍자',       en:'Humor & Satire',      emoji:'😄', pct:0.83,
      can_do:['농담·풍자 이해','맥락적 유머'], grammar:['반어법','풍자 어투'] },
    { id:'kpop',       name:'K-pop 가사',      en:'K-pop Lyrics',        emoji:'🎵', pct:0.85,
      can_do:['가사 해석·감상','은유 이해'], grammar:['시적 표현'] },

    /* ── Business Korean → Summit ─────────────────────────── */
    { id:'business',   name:'비즈니스역',      en:'Business Korean',     emoji:'💼', major:true, pct:0.88,
      can_do:['격식 이메일 작성','회의에서 의견 제시','공식 발표 가능','직장 예절 언어'],
      grammar:['-(스)ㅂ니다체 완벽','공문 어투','존경-겸양 혼합 구사'],
      unlocks:['Business 회화','공식 Writing 레슨','이메일 템플릿'] },
    { id:'doc-formal', name:'공식 문서',       en:'Formal Docs',         emoji:'📋', pct:0.90,
      can_do:['보고서·제안서 읽기'], grammar:['-함, -임, -(으)ㄴ 바'] },
    { id:'email',      name:'이메일 매너',     en:'Email Etiquette',     emoji:'📧', pct:0.91,
      can_do:['격식 이메일 작성','닫는 인사말'], grammar:['-드립니다','-바랍니다'] },
    { id:'present',    name:'프레젠테이션',    en:'Presentations',       emoji:'🖼️', pct:0.92,
      can_do:['PT 구조','차트·그래프 설명'], grammar:['-에 따르면','-(으)ㄹ 것입니다'] },
    { id:'meeting',    name:'회의 표현',       en:'Meetings',            emoji:'👥', pct:0.93,
      can_do:['의견 교환','반대 의견 정중 표현'], grammar:['-(으)면 어떨까요'] },
    { id:'jargon',     name:'전문 용어',       en:'Technical',           emoji:'🔬', pct:0.94,
      can_do:['법률·의료·IT 기본 용어'], grammar:['전문 용어 패턴'] },
    { id:'formal-mast',name:'격식체 완벽',     en:'Formal Mastery',      emoji:'🎩', pct:0.95,
      can_do:['공식 석상 완벽 구사'], grammar:['-(스)ㅂ니다체 전 영역'] },

    { id:'fluency',    name:'유창역',          en:'Fluency Summit',      emoji:'🗻', major:true, pct:1.00,
      can_do:['추상적 주제 토론','문학·학술 독해','원어민급 뉘앙스','TOPIK 6 합격 수준'],
      grammar:['모든 문법 자유 구사','문어체·구어체 전환','수사적 표현'],
      unlocks:['Advanced 전부','논문·문학','TOPIK 6 대비 팩'] },
    { id:'academic',   name:'논문·학술',       en:'Academic',            emoji:'🎓', pct:0.97,
      can_do:['학술 논문 읽기','학회 발표'], grammar:['학술 문어체'] },
    { id:'literature', name:'문학',             en:'Literature',          emoji:'📚', pct:0.98,
      can_do:['단편 소설 읽기','시 감상'], grammar:['문학적 표현'] },
    { id:'news-debate',name:'시사 토론',       en:'Current Debate',      emoji:'🗳️', pct:0.99,
      can_do:['시사 이슈 깊이 토론'], grammar:['토론 고급 표현'] }
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
