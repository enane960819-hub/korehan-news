// sync marker
(function() {
  function buildPairs(prefixes, nouns, enPrefixes, enNouns, limit, extra) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < prefixes.length; i++) {
      for (var j = 0; j < nouns.length; j++) {
        var ko = prefixes[i] + ' ' + nouns[j];
        if (seen[ko]) continue;
        seen[ko] = true;
        out.push(Object.assign({
          word_ko: ko,
          word_rom: '',
          word_en: enPrefixes[i] + ' ' + enNouns[j]
        }, extra || {}));
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  var levelConfigs = {
    Beginner: {
      prefixes:['아침','학교','가족','동네','주말','친구','집','저녁','공원','시장','버스','회사','도서관','카페','여행','운동','취미','전화','사진','시간','날씨','수업','음식','계절','음악'],
      nouns:['인사','준비','생활','약속','계획','가방','지도','메모','선물','습관','표현','대화','질문','답변','연습','목표','일정','자리','소식','기억'],
      enPrefixes:['morning','school','family','neighborhood','weekend','friend','home','evening','park','market','bus','office','library','cafe','travel','exercise','hobby','phone','photo','time','weather','class','food','season','music'],
      enNouns:['greeting','prep','routine','promise','plan','bag','map','memo','gift','habit','expression','conversation','question','answer','practice','goal','schedule','seat','news','memory']
    },
    Intermediate: {
      prefixes:['경제','사회','정책','교육','환경','기술','문화','지역','산업','금융','교통','복지','건강','시장','기업','무역','연구','협력','전략','변화','혁신','서비스','디지털','국제','도시'],
      nouns:['분석','흐름','이슈','전망','조정','논의','현장','기록','보고','대응','계획','확대','감소','회복','개선','기준','관심','지원','선택','과제'],
      enPrefixes:['economic','social','policy','education','environment','technology','culture','regional','industrial','financial','transport','welfare','health','market','business','trade','research','cooperation','strategy','change','innovation','service','digital','global','urban'],
      enNouns:['analysis','trend','issue','outlook','adjustment','discussion','field','record','report','response','plan','expansion','decline','recovery','improvement','standard','interest','support','choice','task']
    },
    Advanced: {
      prefixes:['거시','미시','재정','외교','안보','법률','담론','지정학','산업구조','노동시장','에너지','기후','플랫폼','반도체','바이오','콘텐츠','데이터','공급망','투자심리','통화정책','구조개혁','국제질서','사회인식','기술전환','도시계획'],
      nouns:['재편','격차','압력','완화','불확실성','재조정','리스크','수요','공급','파급효과','협상','합의','갈등','효율성','지표','전략','재구성','정합성','파이프라인','전환'],
      enPrefixes:['macro','micro','fiscal','diplomatic','security','legal','discourse','geopolitical','industrial-structure','labor-market','energy','climate','platform','semiconductor','bio','content','data','supply-chain','investment-sentiment','monetary-policy','structural-reform','international-order','social-awareness','technology-transition','urban-planning'],
      enNouns:['reshuffle','gap','pressure','easing','uncertainty','realignment','risk','demand','supply','ripple','negotiation','consensus','conflict','efficiency','indicator','strategy','rebuild','alignment','pipeline','transition']
    }
  };

  var interestConfigs = {
    kpop: {
      prefixes:['무대','팬','아이돌','앨범','컴백','보컬','댄스','콘셉트','투어','차트','연습실','응원봉','안무','유닛','라이브','팬미팅','무대의상','타이틀곡','하이라이트','퍼포먼스'],
      nouns:['영상','연습','반응','후기','일정','발표','기록','스타일','연출','소식'],
      enPrefixes:['stage','fan','idol','album','comeback','vocal','dance','concept','tour','chart','practice-room','lightstick','choreo','unit','live','fan-meeting','stage-outfit','title-track','highlight','performance'],
      enNouns:['clip','practice','reaction','review','schedule','announcement','record','style','direction','news']
    },
    travel: {
      prefixes:['공항','호텔','여권','지도','해변','도시','기차','버스','여행자','숙소','체크인','시장','골목','사진','박물관','축제','야경','경로','환전','가이드'],
      nouns:['예약','정보','일정','후기','코스','준비','추천','체험','계획','기록'],
      enPrefixes:['airport','hotel','passport','map','beach','city','train','bus','traveler','lodging','check-in','market','alley','photo','museum','festival','night-view','route','exchange','guide'],
      enNouns:['booking','info','schedule','review','course','prep','recommendation','experience','plan','record']
    },
    food: {
      prefixes:['한식','분식','카페','디저트','레시피','식당','주문','반찬','국물','면요리','고기','채소','해산물','향신료','간식','아침식사','점심식사','저녁식사','배달','주방'],
      nouns:['맛집','조합','향','식감','준비','추천','비법','메뉴','후기','재료'],
      enPrefixes:['korean-food','snack-food','cafe','dessert','recipe','restaurant','order','side-dish','broth','noodle','meat','vegetable','seafood','spice','snack','breakfast','lunch','dinner','delivery','kitchen'],
      enNouns:['spot','combo','flavor','texture','prep','recommendation','secret','menu','review','ingredient']
    },
    business: {
      prefixes:['회의','계약','매출','브랜드','광고','고객','시장','사업','전략','보고서','투자','채용','면접','재무','영업','파트너','발표','기획','성과','조직'],
      nouns:['관리','지표','계획','협상','검토','확장','개선','분석','리뷰','목표'],
      enPrefixes:['meeting','contract','sales','brand','advertising','customer','market','business','strategy','report','investment','hiring','interview','finance','sales-team','partner','presentation','planning','performance','organization'],
      enNouns:['management','metric','plan','negotiation','review','expansion','improvement','analysis','review','goal']
    },
    daily: {
      prefixes:['아침','저녁','출근','퇴근','장보기','집안일','세탁','청소','공부','운동','산책','약속','전화','메시지','가족','친구','주말','휴식','시간','잠'],
      nouns:['루틴','준비','기분','계획','메모','습관','체크','목표','대화','정리'],
      enPrefixes:['morning','evening','commute','leave-work','shopping','housework','laundry','cleaning','study','exercise','walk','appointment','phone','message','family','friend','weekend','rest','time','sleep'],
      enNouns:['routine','prep','mood','plan','memo','habit','check','goal','conversation','organizing']
    },
    news: {
      prefixes:['속보','정치','경제','사회','국제','문화','스포츠','과학','기후','교육','보도','현장','인터뷰','분석','논평','사건','발표','통계','여론','정책'],
      nouns:['요약','브리핑','핵심','이슈','해설','전망','흐름','반응','쟁점','업데이트'],
      enPrefixes:['breaking','politics','economy','society','world','culture','sports','science','climate','education','report','field','interview','analysis','commentary','incident','announcement','stats','public-opinion','policy'],
      enNouns:['summary','briefing','key-point','issue','explainer','outlook','trend','reaction','point','update']
    },
    sports: {
      prefixes:['축구','야구','농구','배구','선수','감독','훈련','경기장','대표팀','우승','패스','수비','공격','득점','기록','시즌','관중','체력','전술','하이라이트'],
      nouns:['전략','장면','분석','회복','일정','기록','승부','예상','포인트','리포트'],
      enPrefixes:['soccer','baseball','basketball','volleyball','player','coach','training','stadium','national-team','championship','pass','defense','attack','score','record','season','crowd','fitness','tactics','highlight'],
      enNouns:['strategy','moment','analysis','recovery','schedule','record','matchup','prediction','point','report']
    },
    tech: {
      prefixes:['앱','플랫폼','인공지능','데이터','보안','클라우드','코딩','스타트업','서비스','기기','네트워크','자동화','업데이트','로봇','센서','반도체','디자인','개발자','사용자','소프트웨어'],
      nouns:['출시','기능','실험','전환','개선','리뷰','가이드','확장','문서','테스트'],
      enPrefixes:['app','platform','AI','data','security','cloud','coding','startup','service','device','network','automation','update','robot','sensor','semiconductor','design','developer','user','software'],
      enNouns:['launch','feature','experiment','shift','improvement','review','guide','expansion','document','test']
    },
    drama: {
      prefixes:['드라마','주인공','대사','감정선','장면','에피소드','OST','배우','작가','감독','로맨스','스릴러','사극','예고편','촬영장','결말','리뷰','팬반응','캐릭터','시청률'],
      nouns:['분석','명장면','후기','전개','비밀','연출','기대','요약','포인트','이야기'],
      enPrefixes:['drama','lead','line','emotion-arc','scene','episode','OST','actor','writer','director','romance','thriller','historical','trailer','set','ending','review','fan-reaction','character','ratings'],
      enNouns:['analysis','iconic-scene','review','plot','secret','direction','anticipation','summary','point','story']
    },
    beauty: {
      prefixes:['스킨케어','메이크업','립','쿠션','세럼','토너','보습','클렌징','향수','헤어','네일','톤업','피부','루틴','마스크팩','자외선차단','컬러','브러시','베이스','트렌드'],
      nouns:['조합','발색','관리','비법','사용법','추천','리뷰','준비','포인트','가이드'],
      enPrefixes:['skincare','makeup','lip','cushion','serum','toner','moisture','cleansing','perfume','hair','nail','tone-up','skin','routine','mask-pack','sunscreen','color','brush','base','trend'],
      enNouns:['combo','swatch','care','secret','how-to','recommendation','review','prep','point','guide']
    }
  };

  var levels = {};
  Object.keys(levelConfigs).forEach(function(level) {
    var cfg = levelConfigs[level];
    levels[level] = buildPairs(cfg.prefixes, cfg.nouns, cfg.enPrefixes, cfg.enNouns, 500, { level: level });
  });

  var interests = {};
  Object.keys(interestConfigs).forEach(function(tag) {
    var cfg = interestConfigs[tag];
    interests[tag] = buildPairs(cfg.prefixes, cfg.nouns, cfg.enPrefixes, cfg.enNouns, 200, { interest_tag: tag });
  });

  window.LEARNING_HUB_VOCAB_DATA = {
    levels: levels,
    interests: interests
  };
})();
