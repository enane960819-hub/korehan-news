-- auto-apply
-- Slang fixes found while moving the slang card to "3 a day with examples":
-- wrong meanings (핑프 is "finger princess", not "pink fool"; 그잡채 is
-- "그 자체"), wrong origin notes (JMT, 띵작, 국룰, 갓성비), and entries that
-- aren't slang (MBTI, 뜬금없이) or are a contested term (웅앵웅) are hidden.
-- Matched by ko; idempotent.
update public.korean_slangs set
  en = 'someone who asks instead of looking it up',
  desc_text = '"핑거 프린세스/프린스"의 줄임말. 손가락만 움직이면 검색할 수 있는데 찾아보지 않고 계속 물어보는 사람.',
  tag = '인터넷', warn = true, warn_text = 'Teasing — can sound rude',
  chat = '[{"me": false, "name": "소희", "msg": "이 근처 맛집 어디야? 몇 시까지 해? 주차는 돼?"}, {"me": true, "msg": "<hl>핑프</hl>야? 지도 앱에 다 나와 ㅋㅋ"}, {"me": false, "name": "소희", "msg": "아 찾아보기 귀찮단 말이야"}, {"me": true, "msg": "알겠어 링크 보내줄게"}]'::jsonb
where ko = '핑프';

update public.korean_slangs set
  en = 'the very embodiment of',
  desc_text = '"그 자체"를 재미있게 바꾼 말. 어떤 특징을 완벽하게 보여줄 때 쓴다.',
  chat = '[{"me": false, "name": "준수", "msg": "이 카페 봐, 인테리어 완전 예쁘지?"}, {"me": true, "msg": "와 감성 <hl>그잡채</hl>다"}, {"me": false, "name": "준수", "msg": "사진 찍으러 또 오자"}, {"me": true, "msg": "좋아 ㅋㅋ"}]'::jsonb
where ko = '그잡채';

update public.korean_slangs set
  desc_text = '"존맛탱"의 첫소리 ㅈ·ㅁ·ㅌ을 영어 알파벳으로 쓴 것. 아주 맛있다는 뜻.',
  warn = true, warn_text = 'Very casual'
where ko = 'JMT';

update public.korean_slangs set
  desc_text = '"명작(masterpiece)"의 "명"을 모양이 비슷한 "띵"으로 바꿔 쓴 말. 아주 잘 만든 작품.'
where ko = '띵작';

update public.korean_slangs set
  desc_text = '"국민 룰"의 줄임말. 다들 당연하게 지키는 규칙이나 공식 같은 것.'
where ko = '국룰';

update public.korean_slangs set
  desc_text = '"갓(God)"과 "가성비(가격 대비 성능)"를 합친 말. 가격에 비해 품질이 아주 좋을 때 쓴다.'
where ko = '갓성비';

update public.korean_slangs set en = 'forced hype'
where ko = '억텐';

update public.korean_slangs set is_active = false
where ko in ('웅앵웅', 'MBTI', '뜬금없이');
