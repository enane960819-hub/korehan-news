-- Sample conversation: 어머니와 통화 (Family — phone call with mother)
-- Category: family / Level: Beginner

INSERT INTO conversations_data (data, cat, lvl, name, ctx, created_at)
VALUES (
  $json${
    "name": "지민 & 어머니",
    "ctx": "타지에 사는 지민이가 어머니께 전화로 안부를 전함",
    "cat": "family",
    "lvl": "b",
    "catLabel": "Family",
    "topic": "Checking in with mom on the phone",
    "avi": "📞",
    "msgs": [
      {"s":"r","who":"어머니","txt":"여보세요, 지민이니?","en":"Hello, is that Jimin?"},
      {"s":"l","who":"지민","txt":"네, 엄마. 잘 지내세요?","en":"Yes, Mom. Are you doing well?"},
      {"s":"r","who":"어머니","txt":"엄마는 잘 있어. 너는 밥 잘 먹고 다니니?","en":"Mom's doing fine. Are you eating properly?"},
      {"s":"l","who":"지민","txt":"네, 잘 먹어요. 회사 밥도 맛있어요.","en":"Yes, I'm eating well. The company food is good too."},
      {"s":"r","who":"어머니","txt":"다행이다. 이번 주말에 집에 올 수 있어?","en":"That's a relief. Can you come home this weekend?"},
      {"s":"l","who":"지민","txt":"네, 토요일 아침에 갈게요.","en":"Yes, I'll come Saturday morning."},
      {"s":"r","who":"어머니","txt":"좋아. 네가 좋아하는 김치찌개 만들어 놓을게.","en":"Good. I'll have your favorite kimchi stew ready."},
      {"s":"l","who":"지민","txt":"고마워요, 엄마. 그럼 토요일에 봬요!","en":"Thanks, Mom. See you Saturday then!"}
    ],
    "vocab": [
      {"ko":"여보세요","rom":"yeo-bo-se-yo","en":"hello (on phone)"},
      {"ko":"지내다","rom":"ji-nae-da","en":"to get along, spend time"},
      {"ko":"다행","rom":"da-haeng","en":"a relief, fortunate"},
      {"ko":"주말","rom":"ju-mal","en":"weekend"},
      {"ko":"김치찌개","rom":"gim-chi-jji-gae","en":"kimchi stew"},
      {"ko":"만들어 놓다","rom":"man-deu-reo no-ta","en":"to have made (in advance)"}
    ],
    "grammar": [
      {"point":"~니?","ex":"지민이니? — 'is that Jimin?'. Informal question ending used by elders/parents."},
      {"point":"~ㄹ게요","ex":"갈게요 — 'I will go (promise)'. Speaker's promise/intention."},
      {"point":"~아/어 놓다","ex":"만들어 놓다 — 'to have made (and leave ready)'. Marks an action prepared in advance for later use."}
    ],
    "key_expressions": [
      {"ko":"잘 지내세요?","en":"are you doing well? (honorific)"},
      {"ko":"밥 잘 먹고 다니니?","en":"are you eating properly?"},
      {"ko":"집에 올 수 있어?","en":"can you come home?"},
      {"ko":"그럼 ~에 봬요","en":"see you ~ then (honorific)"}
    ],
    "mission": [
      "Greet a parent on the phone with 여보세요 + 잘 지내세요?",
      "Reassure a worried parent about your daily routine",
      "Agree on a weekend visit using ~ㄹ게요"
    ]
  }$json$::jsonb,
  'family', 'b', '지민 & 어머니', '타지에 사는 지민이가 어머니께 전화로 안부를 전함', NOW()
);
