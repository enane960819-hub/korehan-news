-- auto-apply
-- ═════════════════════════════════════════════════════════════════════
-- Korean Slangs — quality bulk expansion (2026-10-15)
-- ═════════════════════════════════════════════════════════════════════
-- The Slang feature had only the ~12 seeded entries, so learners ran out
-- fast ("slang도 한참 많이 있어야지"). This adds ~36 real, widely-used
-- Korean slang / internet terms — accurate meanings, natural KakaoTalk-style
-- chats, warn flags on the vulgar-origin ones. No filler.
--
-- Idempotent: each row inserts only WHEN NOT EXISTS a row with the same `ko`,
-- so reruns and the existing seed rows are never duplicated. sort_order
-- starts at 100 to sit after the seed set.
-- No-op if the table is absent.
-- ═════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.korean_slangs') is null then
    raise notice 'korean_slangs does not exist — skipping';
    return;
  end if;

  insert into korean_slangs (ko, en, desc_text, tag, warn, warn_text, chat, difficulty, sort_order)
  select v.ko, v.en, v.desc_text, v.tag, v.warn, v.warn_text, v.chat::jsonb, v.difficulty, v.sort_order
  from (values
    ('존버', 'hodl / hang in there', '"존나 버티다"의 줄임말. 힘들어도 끝까지 버티는 것. 주로 투자에서 손해를 참고 기다릴 때.', '투자/트렌드', true, '비속어(존나)에서 온 말 — 친구 사이에서만', '[{"me":false,"name":"지훈","msg":"코인 반토막 났어 ㅠㅠ"},{"me":true,"msg":"야 그냥 <hl>존버</hl> 해 언젠간 오르겠지"},{"me":false,"name":"지훈","msg":"존버가 답이긴 한데 너무 힘들다"},{"me":true,"msg":"ㅋㅋ 버티는 자가 이긴다"}]', 'Intermediate', 100),
    ('갑분싸', 'suddenly awkward', '"갑자기 분위기 싸해짐"의 줄임말. 누군가의 말이나 행동으로 분위기가 어색해지는 순간.', 'MZ세대', false, null, '[{"me":false,"name":"민지","msg":"아까 내가 전 남친 얘기 꺼냈더니"},{"me":true,"msg":"헐 <hl>갑분싸</hl> 됐겠다 ㅋㅋ"},{"me":false,"name":"민지","msg":"ㅇㅇ 다들 조용해짐..."},{"me":true,"msg":"아 상상된다 ㅋㅋㅋ"}]', 'Intermediate', 101),
    ('멘붕', 'mental breakdown', '"멘탈 붕괴"의 줄임말. 큰 충격이나 당황으로 정신이 무너지는 것.', '감정', false, null, '[{"me":false,"name":"수현","msg":"시험 범위를 잘못 공부했어"},{"me":true,"msg":"헉 완전 <hl>멘붕</hl>이겠다"},{"me":false,"name":"수현","msg":"지금 머리가 하얘 ㅠㅠ"},{"me":true,"msg":"괜찮아 아직 시간 있어!"}]', 'Beginner', 102),
    ('썸', 'the talking stage', '사귀기 전, 서로 호감을 가지고 밀당하는 단계. 영어 "something"에서 왔다.', '연애', false, null, '[{"me":false,"name":"다연","msg":"너 요즘 그 사람이랑 어떻게 돼가?"},{"me":true,"msg":"아직 <hl>썸</hl> 타는 중 ㅎㅎ"},{"me":false,"name":"다연","msg":"오~ 언제 사귀어?"},{"me":true,"msg":"몰라 아직 조심스러워"}]', 'Beginner', 103),
    ('밀당', 'push and pull', '"밀고 당기기"의 줄임말. 연애에서 관심을 적당히 주고 빼며 상대의 마음을 끄는 심리 전략.', '연애', false, null, '[{"me":false,"name":"현수","msg":"답장 바로 하지 말고 좀 있다 해"},{"me":true,"msg":"에이 나 <hl>밀당</hl> 그런 거 잘 못해"},{"me":false,"name":"현수","msg":"그러다 훅 간다 ㅋㅋ"},{"me":true,"msg":"그냥 솔직한 게 좋지 않나"}]', 'Intermediate', 104),
    ('노답', 'hopeless / no solution', '"답이 없다"의 줄임말. 해결책이 없거나 어떻게 해도 안 되는 상황·사람.', '일상', false, null, '[{"me":false,"name":"태오","msg":"걔 또 약속 펑크 냈어"},{"me":true,"msg":"와 진짜 <hl>노답</hl>이다"},{"me":false,"name":"태오","msg":"이번이 세 번째야"},{"me":true,"msg":"그냥 손절해 ㅋㅋ"}]', 'Beginner', 105),
    ('손절', 'cut (someone) off', '관계를 끊는 것. 주식 "손절매(손해를 보고 파는 것)"에서 온 말로, 사람 관계에도 쓴다.', '사회생활', false, null, '[{"me":false,"name":"유나","msg":"걔랑 계속 봐야 할까?"},{"me":true,"msg":"스트레스면 그냥 <hl>손절</hl>해"},{"me":false,"name":"유나","msg":"그래도 오래된 친군데..."},{"me":true,"msg":"오래됐다고 다 좋은 건 아니야"}]', 'Intermediate', 106),
    ('현타', 'reality-check moment', '"현실 자각 타임"의 줄임말. 들뜨거나 몰입해 있다가 문득 현실을 깨닫고 허무해지는 순간.', '감정', false, null, '[{"me":false,"name":"재민","msg":"새벽 4시까지 게임하다가"},{"me":true,"msg":"갑자기 <hl>현타</hl> 왔지?"},{"me":false,"name":"재민","msg":"ㅇㅇ 내가 지금 뭐하나 싶더라"},{"me":true,"msg":"ㅋㅋㅋ 너무 공감"}]', 'Intermediate', 107),
    ('소확행', 'small sure happiness', '"소소하지만 확실한 행복"의 줄임말. 일상 속 작지만 확실하게 느껴지는 행복.', 'MZ세대', false, null, '[{"me":false,"name":"서윤","msg":"퇴근하고 따뜻한 물로 샤워하는 거"},{"me":true,"msg":"완전 <hl>소확행</hl>이지"},{"me":false,"name":"서윤","msg":"거기에 맥주 한 캔이면 끝"},{"me":true,"msg":"오늘 그거 해야겠다 ㅎㅎ"}]', 'Intermediate', 108),
    ('워라밸', 'work-life balance', '"Work-life balance"의 한국식 줄임말. 일과 개인 삶의 균형.', '사회생활', false, null, '[{"me":false,"name":"준서","msg":"새 회사 어때?"},{"me":true,"msg":"<hl>워라밸</hl> 좋아서 만족해"},{"me":false,"name":"준서","msg":"야근 없어?"},{"me":true,"msg":"응 6시 땡 퇴근 ㅎㅎ"}]', 'Intermediate', 109),
    ('가성비', 'bang for the buck', '"가격 대비 성능"의 줄임말. 가격에 비해 성능이나 만족도가 좋은 것.', '소비문화', false, null, '[{"me":false,"name":"하준","msg":"이 이어폰 살까 말까"},{"me":true,"msg":"그거 <hl>가성비</hl> 좋기로 유명해"},{"me":false,"name":"하준","msg":"오 그럼 사야겠다"},{"me":true,"msg":"가격 대비 음질 미쳤어"}]', 'Beginner', 110),
    ('치맥', 'chicken and beer', '"치킨 + 맥주"의 줄임말. 한국인이 사랑하는 치킨과 맥주 조합.', '음식', false, null, '[{"me":false,"name":"민재","msg":"오늘 금요일인데"},{"me":true,"msg":"<hl>치맥</hl> 콜?"},{"me":false,"name":"민재","msg":"당연하지 ㅋㅋ 어디서?"},{"me":true,"msg":"우리 집 앞 호프집!"}]', 'Beginner', 111),
    ('혼밥', 'eating alone', '"혼자 밥 먹기"의 줄임말. 혼자 식사하는 것.', '혼족문화', false, null, '[{"me":false,"name":"예진","msg":"점심 같이 먹을래?"},{"me":true,"msg":"아 나 오늘 <hl>혼밥</hl> 하려고"},{"me":false,"name":"예진","msg":"오 혼밥 즐기는 편이야?"},{"me":true,"msg":"응 가끔은 혼자가 편해"}]', 'Beginner', 112),
    ('혼술', 'drinking alone', '"혼자 술 마시기"의 줄임말. 집이나 혼자서 술을 즐기는 것.', '혼족문화', false, null, '[{"me":false,"name":"도윤","msg":"주말에 뭐 했어?"},{"me":true,"msg":"집에서 <hl>혼술</hl> 했지 ㅎㅎ"},{"me":false,"name":"도윤","msg":"오 분위기 좋았겠다"},{"me":true,"msg":"드라마 보면서 와인 한 잔, 최고"}]', 'Beginner', 113),
    ('먹방', 'mukbang / eating show', '"먹는 방송"의 줄임말. 음식을 맛있게 먹는 모습을 보여주는 방송이나 영상. 해외에서도 "mukbang"으로 통한다.', '음식', false, null, '[{"me":false,"name":"소율","msg":"배고픈데 밥은 없고"},{"me":true,"msg":"그럴 땐 <hl>먹방</hl> 보면 돼 ㅋㅋ"},{"me":false,"name":"소율","msg":"그럼 더 배고프지 않아?"},{"me":true,"msg":"그게 묘하게 대리만족 됨"}]', 'Beginner', 114),
    ('극혐', 'extremely gross', '"극도로 혐오한다"의 줄임말. 매우 싫어하거나 역겨워하는 것.', '감정', true, '강한 표현이라 가볍게 쓰면 무례하게 들릴 수 있음', '[{"me":false,"name":"지우","msg":"민트초코 어때?"},{"me":true,"msg":"난 <hl>극혐</hl>... 치약 맛이야"},{"me":false,"name":"지우","msg":"ㅋㅋㅋ 호불호 갈리더라"},{"me":true,"msg":"민초단은 이해 불가"}]', 'Intermediate', 115),
    ('심쿵', 'heart flutter', '"심장이 쿵"의 줄임말. 설레서 심장이 두근거리는 순간.', '연애', false, null, '[{"me":false,"name":"채원","msg":"그 사람이 우산 씌워줬어"},{"me":true,"msg":"꺄 완전 <hl>심쿵</hl>이네"},{"me":false,"name":"채원","msg":"그때 심장 터지는 줄"},{"me":true,"msg":"드라마다 드라마 ㅎㅎ"}]', 'Beginner', 116),
    ('깜놀', 'startled', '"깜짝 놀람"의 줄임말. 갑자기 놀란 것.', '감정', false, null, '[{"me":false,"name":"시우","msg":"뒤에서 갑자기 불러서"},{"me":true,"msg":"ㅋㅋㅋ <hl>깜놀</hl>했지?"},{"me":false,"name":"시우","msg":"소리 지를 뻔했어"},{"me":true,"msg":"미안 미안 ㅋㅋ"}]', 'Beginner', 117),
    ('내로남불', 'double standard', '"내가 하면 로맨스, 남이 하면 불륜"의 줄임말. 자신에게는 관대하고 남에게는 엄격한 이중잣대.', '사회생활', false, null, '[{"me":false,"name":"하은","msg":"지각하면 뭐라 하면서 자기는 맨날 늦어"},{"me":true,"msg":"완전 <hl>내로남불</hl>이네"},{"me":false,"name":"하은","msg":"그러니까 ㅋㅋ"},{"me":true,"msg":"그런 사람이 제일 답없어"}]', 'Advanced', 118),
    ('꾸안꾸', 'effortless chic', '"꾸민 듯 안 꾸민 듯"의 줄임말. 신경 썼지만 자연스러워 보이는 스타일.', '패션', false, null, '[{"me":false,"name":"수아","msg":"오늘 코디 신경 쓴 거야?"},{"me":true,"msg":"응 근데 <hl>꾸안꾸</hl> 느낌 내려고 ㅎㅎ"},{"me":false,"name":"수아","msg":"성공했어 자연스럽고 예뻐"},{"me":true,"msg":"오 다행 ㅋㅋ"}]', 'Intermediate', 119),
    ('오운완', 'workout done today', '"오늘 운동 완료"의 줄임말. 오늘의 운동을 끝냈다는 인증.', '건강', false, null, '[{"me":false,"name":"건우","msg":"헬스장 다녀왔어 <hl>오운완</hl>!"},{"me":true,"msg":"오 꾸준하네 대단"},{"me":false,"name":"건우","msg":"너도 같이 하자"},{"me":true,"msg":"내일부터... 내일부터 할게 ㅋㅋ"}]', 'Intermediate', 120),
    ('점메추', 'lunch menu rec', '"점심 메뉴 추천(해줘)"의 줄임말. 점심 뭐 먹을지 추천해 달라는 뜻.', '음식', false, null, '[{"me":false,"name":"나윤","msg":"<hl>점메추</hl> 좀!"},{"me":true,"msg":"오늘 쌀쌀하니까 국밥 어때"},{"me":false,"name":"나윤","msg":"오 콜 든든하겠다"},{"me":true,"msg":"깍두기 많이 주는 집으로 ㄱㄱ"}]', 'Intermediate', 121),
    ('솔까말', 'honestly speaking', '"솔직히 까놓고 말해서"의 줄임말. 솔직히 말하면.', '일상', false, null, '[{"me":false,"name":"민규","msg":"이 영화 어땠어?"},{"me":true,"msg":"<hl>솔까말</hl> 좀 지루했어"},{"me":false,"name":"민규","msg":"ㅋㅋ 나도 중간에 졸았어"},{"me":true,"msg":"평점 왜 높은지 모르겠다"}]', 'Intermediate', 122),
    ('드립', 'ad-lib joke', '즉흥적으로 치는 농담이나 말장난. 영어 "ad-lib"에서 변형됐다. "드립 친다"처럼 쓴다.', '유머', false, null, '[{"me":false,"name":"서진","msg":"아까 네 <hl>드립</hl> 진짜 웃겼어"},{"me":true,"msg":"ㅋㅋ 순간 떠올라서 쳤지"},{"me":false,"name":"서진","msg":"센스 인정"},{"me":true,"msg":"드립은 타이밍이지"}]', 'Intermediate', 123),
    ('뇌절', 'beating a dead horse', '같은 말이나 행동을 과하게 반복해서 질리게 만드는 것. "1절만 해" 할 때의 그 절(節)에서 왔다.', '유머', false, null, '[{"me":false,"name":"유빈","msg":"걔 그 드립 열 번째 치는 중"},{"me":true,"msg":"아 그만 좀 <hl>뇌절</hl>이야"},{"me":false,"name":"유빈","msg":"처음엔 웃겼는데 이젠 노잼"},{"me":true,"msg":"1절만 하지 ㅋㅋ"}]', 'Advanced', 124),
    ('TMI', 'too much info', '"Too Much Information"의 줄임말. 굳이 알 필요 없는 지나치게 사적이거나 과한 정보.', 'MZ세대', false, null, '[{"me":false,"name":"아린","msg":"나 오늘 양말 짝짝이 신었어"},{"me":true,"msg":"ㅋㅋㅋ 갑자기 <hl>TMI</hl>"},{"me":false,"name":"아린","msg":"아 공유하고 싶었어 ㅎㅎ"},{"me":true,"msg":"귀엽다 ㅋㅋ"}]', 'Beginner', 125),
    ('금수저', 'born rich', '부유한 집안에서 태어난 사람. 영어 "born with a silver spoon"에서 변형. 반대말은 흙수저.', '사회', false, null, '[{"me":false,"name":"현지","msg":"걔 대학 때 외제차 끌고 다녔대"},{"me":true,"msg":"역시 <hl>금수저</hl>였구나"},{"me":false,"name":"현지","msg":"부럽다 진짜"},{"me":true,"msg":"우린 열심히 사는 수밖에 ㅋㅋ"}]', 'Intermediate', 126),
    ('흙수저', 'born poor', '가난한 집안에서 태어난 사람. 금수저의 반대말로, 스스로를 낮춰 부를 때도 쓴다.', '사회', false, null, '[{"me":false,"name":"정우","msg":"용돈 받아본 적이 없어"},{"me":true,"msg":"나도 완전 <hl>흙수저</hl> 출신"},{"me":false,"name":"정우","msg":"그래도 우리 잘 컸잖아 ㅎㅎ"},{"me":true,"msg":"맞아 스스로 일군 게 더 멋지지"}]', 'Intermediate', 127),
    ('광클', 'frantic clicking', '"미친 듯이 클릭"의 줄임말. 콘서트 티켓팅 등에서 아주 빠르게 클릭하는 것.', '트렌드', false, null, '[{"me":false,"name":"수빈","msg":"콘서트 티켓 잡았어?"},{"me":true,"msg":"<hl>광클</hl> 했는데 1초 만에 매진 ㅠㅠ"},{"me":false,"name":"수빈","msg":"헐 손가락이 느린가"},{"me":true,"msg":"서버가 문제야 서버가"}]', 'Intermediate', 128),
    ('세젤귀', 'cutest in the world', '"세상에서 제일 귀여워"의 줄임말. 아주 귀여운 대상에게 쓴다.', '감정', false, null, '[{"me":false,"name":"다인","msg":"우리 강아지 사진 봐봐"},{"me":true,"msg":"헐 <hl>세젤귀</hl> ㅠㅠ"},{"me":false,"name":"다인","msg":"그치 그치 ㅎㅎ"},{"me":true,"msg":"심장 녹는다 진짜"}]', 'Intermediate', 129),
    ('안물안궁', 'didn''t ask, don''t care', '"안 물어봤고 안 궁금해"의 줄임말. 관심 없다는 뜻의 다소 퉁명스러운 표현.', 'MZ세대', true, '무례하게 들릴 수 있어 친한 사이 장난으로만', '[{"me":false,"name":"재현","msg":"내 전 여친이 말이야..."},{"me":true,"msg":"ㅋㅋ <hl>안물안궁</hl>"},{"me":false,"name":"재현","msg":"아 들어봐 봐 ㅋㅋ"},{"me":true,"msg":"농담이야 말해 말해"}]', 'Advanced', 130),
    ('어쩔티비', 'whatever, I don''t care', '상대의 말을 장난스럽게 받아치는 유행어. "그래서 어쩌라고"를 TV에 빗댄 말장난.', '유머', true, '비꼬는 장난말 — 상황 봐서 친한 사이에만', '[{"me":false,"name":"하율","msg":"너 그러다 시험 망한다"},{"me":true,"msg":"<hl>어쩔티비</hl> ㅋㅋㅋ"},{"me":false,"name":"하율","msg":"진지하게 말했는데 ㅋㅋ"},{"me":true,"msg":"알았어 알았어 공부할게"}]', 'Intermediate', 131),
    ('완내스', 'totally my style', '"완전 내 스타일"의 줄임말. 취향에 딱 맞는 것.', 'MZ세대', false, null, '[{"me":false,"name":"서연","msg":"이 카페 인테리어 봐"},{"me":true,"msg":"와 <hl>완내스</hl>야"},{"me":false,"name":"서연","msg":"그치 조용하고 아늑해"},{"me":true,"msg":"단골 될 듯 ㅎㅎ"}]', 'Intermediate', 132),
    ('품절남', 'taken (man)', '매력적이지만 이미 결혼했거나 임자가 있는 남자. 여자는 품절녀.', '연애', false, null, '[{"me":false,"name":"민서","msg":"그 선배 결혼한대"},{"me":true,"msg":"헐 아깝다 완전 <hl>품절남</hl> 됐네"},{"me":false,"name":"민서","msg":"인기 많았는데 ㅋㅋ"},{"me":true,"msg":"좋은 사람 만났겠지 뭐"}]', 'Intermediate', 133),
    ('알잘딱깔센', 'handle it well yourself', '"알아서 잘 딱 깔끔하고 센스 있게"의 줄임말. 시키지 않아도 알아서 잘하라는 뜻.', 'MZ세대', false, null, '[{"me":false,"name":"태윤","msg":"이 일 어떻게 처리할까요?"},{"me":true,"msg":"그냥 <hl>알잘딱깔센</hl>으로 부탁 ㅎㅎ"},{"me":false,"name":"태윤","msg":"넵 알아서 깔끔하게 할게요"},{"me":true,"msg":"믿는다!"}]', 'Advanced', 134),
    ('열폭', 'jealousy outburst', '"열등감 폭발"의 줄임말. 열등감 때문에 과하게 깎아내리거나 화내는 것.', '감정', true, '상대를 비하하는 뉘앙스 — 조심해서 사용', '[{"me":false,"name":"지안","msg":"쟤는 왜 자꾸 네 성적 깎아내려?"},{"me":true,"msg":"그냥 <hl>열폭</hl>하는 거지 뭐"},{"me":false,"name":"지안","msg":"신경 쓰지 마"},{"me":true,"msg":"응 내 갈 길 간다"}]', 'Advanced', 135)
  ) as v(ko, en, desc_text, tag, warn, warn_text, chat, difficulty, sort_order)
  where not exists (select 1 from korean_slangs k where k.ko = v.ko);
end
$$;

notify pgrst, 'reload schema';
