-- Sample conversation: 회사 동료와 점심 의논 (Work — discussing lunch with colleague)
-- Category: work / Level: Intermediate

INSERT INTO conversations_data (data, cat, lvl, name, ctx, created_at)
VALUES (
  $json${
    "name": "수진 & 태우",
    "ctx": "점심시간에 회사 동료와 식당 정하기",
    "cat": "work",
    "lvl": "i",
    "catLabel": "Workplace",
    "topic": "Picking a lunch spot with a coworker",
    "avi": "🥘",
    "msgs": [
      {"s":"l","who":"수진","txt":"태우 씨, 점심 뭐 드실 거예요?","en":"Taewoo, what are you going to have for lunch?"},
      {"s":"r","who":"태우","txt":"아직 안 정했어요. 수진 씨는 뭐 드시고 싶으세요?","en":"I haven't decided yet. What would you like to eat?"},
      {"s":"l","who":"수진","txt":"저는 어제 한식 먹어서 오늘은 다른 거 먹고 싶어요.","en":"I had Korean food yesterday, so today I want something different."},
      {"s":"r","who":"태우","txt":"그럼 회사 앞 새로 생긴 파스타집 어때요? 평이 좋더라고요.","en":"Then how about that new pasta place in front of the office? I heard it has good reviews."},
      {"s":"l","who":"수진","txt":"오, 좋아요! 근데 점심시간엔 사람 많지 않을까요?","en":"Oh, sounds good! But won't it be crowded at lunchtime?"},
      {"s":"r","who":"태우","txt":"미리 예약하면 될 거예요. 제가 전화해 볼게요.","en":"It should be fine if we reserve ahead. I'll give them a call."},
      {"s":"l","who":"수진","txt":"감사해요. 그럼 12시에 1층 로비에서 만나요.","en":"Thanks. Let's meet at 12 in the first-floor lobby then."},
      {"s":"r","who":"태우","txt":"네, 그때 봬요!","en":"Sure, see you then!"}
    ],
    "vocab": [
      {"ko":"점심","rom":"jeom-sim","en":"lunch"},
      {"ko":"정하다","rom":"jeong-ha-da","en":"to decide"},
      {"ko":"한식","rom":"han-sik","en":"Korean food"},
      {"ko":"새로 생기다","rom":"sae-ro saeng-gi-da","en":"to be newly opened"},
      {"ko":"평","rom":"pyeong","en":"review, reputation"},
      {"ko":"예약하다","rom":"ye-yak-ha-da","en":"to reserve, book"},
      {"ko":"로비","rom":"ro-bi","en":"lobby"}
    ],
    "grammar": [
      {"point":"~(으)실 거예요","ex":"드실 거예요 — 'will you eat (honorific)'. Future + honorific 시 combined: <stem> + (으)시 + ㄹ 거예요."},
      {"point":"~더라고요","ex":"평이 좋더라고요 — 'I noticed the reviews are good'. Speaker reports something they witnessed/heard themselves."},
      {"point":"~지 않을까요?","ex":"사람 많지 않을까요? — 'won't there be a lot of people?'. Soft conjecture question."}
    ],
    "key_expressions": [
      {"ko":"아직 안 정했어요","en":"I haven't decided yet"},
      {"ko":"평이 좋다","en":"to have good reviews"},
      {"ko":"미리 예약하다","en":"to reserve in advance"},
      {"ko":"그때 봬요","en":"see you then (honorific)"}
    ],
    "mission": [
      "Use 드시다/드시고 싶다 (honorific eat) when asking a coworker about food",
      "Suggest a new restaurant using ~ 어때요?",
      "Confirm a meetup time and place with a coworker"
    ]
  }$json$::jsonb,
  'work', 'i', '수진 & 태우', '점심시간에 회사 동료와 식당 정하기', NOW()
);
