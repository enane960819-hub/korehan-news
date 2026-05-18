-- Sample conversation: 친구와 카페에서 오랜만에 만남
-- Category: friends / Level: Intermediate
-- Generated offline; saves into conversations_data exactly like the admin's
-- "Save All to DB" button. sentence_analysis is left for the admin's
-- auto-bake step (or frontend lazy-bake on first read).

INSERT INTO conversations_data (data, cat, lvl, name, ctx, created_at)
VALUES (
  $json${
    "name": "민준 & 지유",
    "ctx": "오랜만에 카페에서 만난 친구들",
    "cat": "friends",
    "lvl": "i",
    "catLabel": "Friends",
    "topic": "Catching up at a cafe",
    "avi": "☕",
    "msgs": [
      {"s":"l","who":"민준","txt":"지유야! 진짜 오랜만이다.","en":"Jiyu! It's really been a while."},
      {"s":"r","who":"지유","txt":"그러게. 한 삼 개월 만인 것 같은데?","en":"I know. Feels like it's been about three months."},
      {"s":"l","who":"민준","txt":"맞아. 너 요즘 일은 어때?","en":"Yeah. How's work going these days?"},
      {"s":"r","who":"지유","txt":"바쁘긴 한데 재미있어. 새 프로젝트 맡았거든.","en":"It's busy but fun. I got assigned a new project."},
      {"s":"l","who":"민준","txt":"오, 잘됐네! 어떤 프로젝트인데?","en":"Oh, nice! What kind of project?"},
      {"s":"r","who":"지유","txt":"앱 디자인이야. 처음이라 좀 떨려.","en":"App design. It's my first time so I'm a bit nervous."},
      {"s":"l","who":"민준","txt":"너 잘하잖아. 응원할게!","en":"You're good at this. I'm rooting for you!"},
      {"s":"r","who":"지유","txt":"고마워. 우리 자주 보자.","en":"Thanks. Let's hang out more often."}
    ],
    "vocab": [
      {"ko":"오랜만","rom":"o-raen-man","en":"after a long time"},
      {"ko":"맡다","rom":"mat-da","en":"to take on (a task / role)"},
      {"ko":"떨리다","rom":"tteol-li-da","en":"to feel nervous, trembly"},
      {"ko":"응원하다","rom":"eung-won-ha-da","en":"to cheer on, root for"},
      {"ko":"바쁘다","rom":"ba-ppeu-da","en":"to be busy"},
      {"ko":"잘되다","rom":"jal-doe-da","en":"to turn out well"}
    ],
    "grammar": [
      {"point":"~인 것 같다","ex":"삼 개월 만인 것 같은데 — \"seems like it's been three months, right?\". <noun> + 인 것 같다 = \"seems to be N\"."},
      {"point":"~거든","ex":"맡았거든 — \"(because) I got assigned (it)\". Sentence-final ~거든 gives background or reason."},
      {"point":"~잖아","ex":"너 잘하잖아 — \"you're good at it, you know\". Asserts something the listener already knows."}
    ],
    "key_expressions": [
      {"ko":"진짜 오랜만이다","en":"it's really been a while"},
      {"ko":"잘됐네","en":"that's great / good for you"},
      {"ko":"자주 보자","en":"let's see each other often"}
    ],
    "mission": [
      "Greet a friend you haven't seen in a while using 오랜만",
      "Talk about a new project you've taken on at work or school",
      "End the chat warmly with 자주 보자 or 응원할게"
    ]
  }$json$::jsonb,
  'friends',
  'i',
  '민준 & 지유',
  '오랜만에 카페에서 만난 친구들',
  NOW()
);
