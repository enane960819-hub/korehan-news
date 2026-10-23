/* ============================================================
   KoreHani — Korean Basics course (self-contained lesson player)

   A continuous 0→1 path for absolute-beginner foreign learners:
     Hangul → survival words → everyday phrases → first grammar.

   Everything runs inside ONE overlay (#basics-overlay): course map →
   learn cards → quiz → result → "Next lesson" straight into the next
   one. The old version hopped between four separate study-room tools,
   each with its own modal, and some opened underneath this overlay.

   Content is authored here — no AI calls. Progress is per-user in
   localStorage; each finished lesson is also logged to Growth Lab.

   Public: openBasicsTrack(), closeBasicsTrack()
   ============================================================ */
(function () {
  // ── Course content ──────────────────────────────────────────
  // Word item: { ko, rom, en, say? }   (say = what TTS reads, defaults to ko)
  // Grammar lesson: { grammar: { explain:[…], examples:[{ko,rom,en}], quiz:[{q,en,opts,a,why}] } }
  var STAGES = [
    {
      id: 'hangul', title: 'Hangul — read Korean', color: '#7dd3fc', icon: 'type',
      lessons: [
        { id: 'h-vow1', title: 'Basic vowels', sub: 'ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ', kind: 'letter',
          tip: 'Korean vowels never stand alone in writing — they sit next to the silent ㅇ. So ㅏ is written 아.',
          items: [
            { ko: 'ㅏ', say: '아', rom: 'a', en: '"a" as in father' },
            { ko: 'ㅓ', say: '어', rom: 'eo', en: '"u" as in up' },
            { ko: 'ㅗ', say: '오', rom: 'o', en: '"o" as in go (lips rounded)' },
            { ko: 'ㅜ', say: '우', rom: 'u', en: '"oo" as in moon' },
            { ko: 'ㅡ', say: '으', rom: 'eu', en: 'like "oo" with lips spread flat' },
            { ko: 'ㅣ', say: '이', rom: 'i', en: '"ee" as in see' }
          ] },
        { id: 'h-vow2', title: 'Y-vowels & ㅐ ㅔ', sub: 'ㅑ ㅕ ㅛ ㅠ ㅐ ㅔ', kind: 'letter',
          tip: 'An extra stroke adds a "y" sound: ㅏ a → ㅑ ya. ㅐ and ㅔ sound almost the same today.',
          items: [
            { ko: 'ㅑ', say: '야', rom: 'ya', en: '"ya" as in yard' },
            { ko: 'ㅕ', say: '여', rom: 'yeo', en: '"yu" as in young' },
            { ko: 'ㅛ', say: '요', rom: 'yo', en: '"yo" as in yoga' },
            { ko: 'ㅠ', say: '유', rom: 'yu', en: '"you"' },
            { ko: 'ㅐ', say: '애', rom: 'ae', en: '"e" as in bed' },
            { ko: 'ㅔ', say: '에', rom: 'e', en: '"e" as in bed (≈ ㅐ)' }
          ] },
        { id: 'h-con1', title: 'Consonants 1', sub: 'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ', kind: 'letter',
          tip: 'Each consonant is shown with ㅏ so you can hear it: ㄱ → 가 (ga).',
          items: [
            { ko: 'ㄱ', say: '가', rom: 'g / k', en: 'as in go' },
            { ko: 'ㄴ', say: '나', rom: 'n', en: 'as in no' },
            { ko: 'ㄷ', say: '다', rom: 'd / t', en: 'as in do' },
            { ko: 'ㄹ', say: '라', rom: 'r / l', en: 'between r and l' },
            { ko: 'ㅁ', say: '마', rom: 'm', en: 'as in mom' },
            { ko: 'ㅂ', say: '바', rom: 'b / p', en: 'as in boy' },
            { ko: 'ㅅ', say: '사', rom: 's', en: 'as in sun' }
          ] },
        { id: 'h-con2', title: 'Consonants 2', sub: 'ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ', kind: 'letter',
          tip: 'ㅇ is silent at the start of a syllable and "ng" at the end. ㅊ ㅋ ㅌ ㅍ are breathy — a puff of air.',
          items: [
            { ko: 'ㅇ', say: '아', rom: 'silent / ng', en: 'silent at the start, "ng" at the end' },
            { ko: 'ㅈ', say: '자', rom: 'j', en: 'as in jam' },
            { ko: 'ㅊ', say: '차', rom: 'ch', en: 'as in church (breathy)' },
            { ko: 'ㅋ', say: '카', rom: 'k', en: 'as in kite (breathy)' },
            { ko: 'ㅌ', say: '타', rom: 't', en: 'as in top (breathy)' },
            { ko: 'ㅍ', say: '파', rom: 'p', en: 'as in pie (breathy)' },
            { ko: 'ㅎ', say: '하', rom: 'h', en: 'as in hat' }
          ] },
        { id: 'h-syl', title: 'Building syllables', sub: 'consonant + vowel = one block', kind: 'letter',
          tip: 'Every Korean syllable is a block: consonant first, then vowel. Vowels with a long vertical line go on the right, flat ones go underneath.',
          items: [
            { ko: '가', rom: 'ga', en: 'ㄱ + ㅏ' }, { ko: '너', rom: 'neo', en: 'ㄴ + ㅓ' },
            { ko: '도', rom: 'do', en: 'ㄷ + ㅗ' }, { ko: '루', rom: 'ru', en: 'ㄹ + ㅜ' },
            { ko: '므', rom: 'meu', en: 'ㅁ + ㅡ' }, { ko: '비', rom: 'bi', en: 'ㅂ + ㅣ' },
            { ko: '소', rom: 'so', en: 'ㅅ + ㅗ' }, { ko: '하', rom: 'ha', en: 'ㅎ + ㅏ' }
          ] },
        { id: 'h-tense', title: 'Double consonants', sub: 'ㄲ ㄸ ㅃ ㅆ ㅉ', kind: 'letter',
          tip: 'Doubled letters are "tense": say them tight and sharp, with no puff of air.',
          items: [
            { ko: 'ㄲ', say: '까', rom: 'kk', en: 'tight "k" — as in skate' },
            { ko: 'ㄸ', say: '따', rom: 'tt', en: 'tight "t" — as in stop' },
            { ko: 'ㅃ', say: '빠', rom: 'pp', en: 'tight "p" — as in spy' },
            { ko: 'ㅆ', say: '싸', rom: 'ss', en: 'sharp "s" — as in sea' },
            { ko: 'ㅉ', say: '짜', rom: 'jj', en: 'tight "j"' }
          ] },
        { id: 'h-batchim', title: 'Final consonants', sub: 'your first real words', kind: 'word',
          tip: 'A consonant can sit at the bottom of a block (받침). 밥 = ㅂ + ㅏ + ㅂ.',
          items: [
            { ko: '밥', rom: 'bap', en: 'rice / meal' }, { ko: '물', rom: 'mul', en: 'water' },
            { ko: '산', rom: 'san', en: 'mountain' }, { ko: '강', rom: 'gang', en: 'river' },
            { ko: '책', rom: 'chaek', en: 'book' }, { ko: '집', rom: 'jip', en: 'house / home' },
            { ko: '옷', rom: 'ot', en: 'clothes' }, { ko: '꽃', rom: 'kkot', en: 'flower' }
          ] }
      ]
    },
    {
      id: 'words', title: 'Survival words', color: '#86efac', icon: 'book-open',
      lessons: [
        { id: 'w-greet', title: 'Greetings', sub: 'hello · thanks · sorry', kind: 'word',
          tip: 'Add 요 or use -습니다 to stay polite with people you don’t know well.',
          items: [
            { ko: '안녕하세요', rom: 'annyeonghaseyo', en: 'Hello' },
            { ko: '감사합니다', rom: 'gamsahamnida', en: 'Thank you' },
            { ko: '죄송합니다', rom: 'joesonghamnida', en: 'I’m sorry' },
            { ko: '네', rom: 'ne', en: 'Yes' },
            { ko: '아니요', rom: 'aniyo', en: 'No' },
            { ko: '괜찮아요', rom: 'gwaenchanayo', en: 'It’s okay / I’m fine' },
            { ko: '안녕히 가세요', rom: 'annyeonghi gaseyo', en: 'Goodbye (to someone leaving)' },
            { ko: '안녕히 계세요', rom: 'annyeonghi gyeseyo', en: 'Goodbye (to someone staying)' }
          ] },
        { id: 'w-num-sino', title: 'Numbers 1–10 (Sino)', sub: '일 이 삼 …', kind: 'word',
          tip: 'Sino-Korean numbers are for money, dates, phone numbers and minutes.',
          items: [
            { ko: '일', rom: 'il', en: 'one' }, { ko: '이', rom: 'i', en: 'two' }, { ko: '삼', rom: 'sam', en: 'three' },
            { ko: '사', rom: 'sa', en: 'four' }, { ko: '오', rom: 'o', en: 'five' }, { ko: '육', rom: 'yuk', en: 'six' },
            { ko: '칠', rom: 'chil', en: 'seven' }, { ko: '팔', rom: 'pal', en: 'eight' }, { ko: '구', rom: 'gu', en: 'nine' },
            { ko: '십', rom: 'sip', en: 'ten' }
          ] },
        { id: 'w-num-native', title: 'Numbers 1–10 (Native)', sub: '하나 둘 셋 …', kind: 'word',
          tip: 'Native Korean numbers are for counting things, age, and hours.',
          items: [
            { ko: '하나', rom: 'hana', en: 'one' }, { ko: '둘', rom: 'dul', en: 'two' }, { ko: '셋', rom: 'set', en: 'three' },
            { ko: '넷', rom: 'net', en: 'four' }, { ko: '다섯', rom: 'daseot', en: 'five' }, { ko: '여섯', rom: 'yeoseot', en: 'six' },
            { ko: '일곱', rom: 'ilgop', en: 'seven' }, { ko: '여덟', rom: 'yeodeol', en: 'eight' }, { ko: '아홉', rom: 'ahop', en: 'nine' },
            { ko: '열', rom: 'yeol', en: 'ten' }
          ] },
        { id: 'w-family', title: 'Family', sub: 'mom · dad · siblings', kind: 'word',
          tip: 'Words for older siblings depend on YOUR gender: a woman says 오빠/언니, a man says 형/누나.',
          items: [
            { ko: '엄마', rom: 'eomma', en: 'mom' }, { ko: '아빠', rom: 'appa', en: 'dad' },
            { ko: '오빠', rom: 'oppa', en: 'older brother (said by a woman)' }, { ko: '형', rom: 'hyeong', en: 'older brother (said by a man)' },
            { ko: '언니', rom: 'eonni', en: 'older sister (said by a woman)' }, { ko: '누나', rom: 'nuna', en: 'older sister (said by a man)' },
            { ko: '동생', rom: 'dongsaeng', en: 'younger sibling' }, { ko: '할머니', rom: 'halmeoni', en: 'grandmother' }
          ] },
        { id: 'w-food', title: 'Food & drinks', sub: 'rice · water · coffee', kind: 'word',
          items: [
            { ko: '밥', rom: 'bap', en: 'rice / meal' }, { ko: '물', rom: 'mul', en: 'water' },
            { ko: '커피', rom: 'keopi', en: 'coffee' }, { ko: '김치', rom: 'gimchi', en: 'kimchi' },
            { ko: '고기', rom: 'gogi', en: 'meat' }, { ko: '빵', rom: 'ppang', en: 'bread' },
            { ko: '우유', rom: 'uyu', en: 'milk' }, { ko: '사과', rom: 'sagwa', en: 'apple' }
          ] },
        { id: 'w-places', title: 'Places', sub: 'home · school · station', kind: 'word',
          items: [
            { ko: '집', rom: 'jip', en: 'home' }, { ko: '학교', rom: 'hakgyo', en: 'school' },
            { ko: '회사', rom: 'hoesa', en: 'company / office' }, { ko: '식당', rom: 'sikdang', en: 'restaurant' },
            { ko: '카페', rom: 'kape', en: 'café' }, { ko: '병원', rom: 'byeongwon', en: 'hospital' },
            { ko: '화장실', rom: 'hwajangsil', en: 'restroom' }, { ko: '역', rom: 'yeok', en: 'station' }
          ] },
        { id: 'w-time', title: 'Time words', sub: 'today · tomorrow · now', kind: 'word',
          items: [
            { ko: '오늘', rom: 'oneul', en: 'today' }, { ko: '내일', rom: 'naeil', en: 'tomorrow' },
            { ko: '어제', rom: 'eoje', en: 'yesterday' }, { ko: '지금', rom: 'jigeum', en: 'now' },
            { ko: '아침', rom: 'achim', en: 'morning' }, { ko: '저녁', rom: 'jeonyeok', en: 'evening' },
            { ko: '주말', rom: 'jumal', en: 'weekend' }, { ko: '시간', rom: 'sigan', en: 'time / hour' }
          ] },
        { id: 'w-days', title: 'Days of the week', sub: '월요일 … 일요일', kind: 'word',
          tip: 'Every day ends in 요일 (yoil, "day of the week").',
          items: [
            { ko: '월요일', rom: 'woryoil', en: 'Monday' }, { ko: '화요일', rom: 'hwayoil', en: 'Tuesday' },
            { ko: '수요일', rom: 'suyoil', en: 'Wednesday' }, { ko: '목요일', rom: 'mogyoil', en: 'Thursday' },
            { ko: '금요일', rom: 'geumyoil', en: 'Friday' }, { ko: '토요일', rom: 'toyoil', en: 'Saturday' },
            { ko: '일요일', rom: 'iryoil', en: 'Sunday' }
          ] },
        { id: 'w-colors', title: 'Colors', sub: 'red · blue · yellow', kind: 'word',
          items: [
            { ko: '빨간색', rom: 'ppalgansaek', en: 'red' }, { ko: '파란색', rom: 'paransaek', en: 'blue' },
            { ko: '노란색', rom: 'noransaek', en: 'yellow' }, { ko: '초록색', rom: 'choroksaek', en: 'green' },
            { ko: '검은색', rom: 'geomeunsaek', en: 'black' }, { ko: '흰색', rom: 'huinsaek', en: 'white' }
          ] }
      ]
    },
    {
      id: 'phrases', title: 'Everyday phrases', color: '#fbbf24', icon: 'message-circle',
      lessons: [
        { id: 'p-request', title: 'Asking for things', sub: '…주세요 (please)', kind: 'word',
          tip: '주세요 means "please give me". Put what you want in front: 물 주세요 = "Water, please."',
          items: [
            { ko: '주세요', rom: 'juseyo', en: 'Please give me' },
            { ko: '물 주세요', rom: 'mul juseyo', en: 'Water, please' },
            { ko: '이거 주세요', rom: 'igeo juseyo', en: 'This one, please' },
            { ko: '저기요', rom: 'jeogiyo', en: 'Excuse me (to get attention)' },
            { ko: '잠깐만요', rom: 'jamkkanmanyo', en: 'Just a moment' },
            { ko: '도와주세요', rom: 'dowajuseyo', en: 'Please help me' },
            { ko: '다시 말해 주세요', rom: 'dasi malhae juseyo', en: 'Please say that again' },
            { ko: '천천히 말해 주세요', rom: 'cheoncheonhi malhae juseyo', en: 'Please speak slowly' }
          ] },
        { id: 'p-questions', title: 'Questions', sub: 'what · where · how much', kind: 'word',
          tip: '예요? at the end turns a word into a polite question: 어디예요? = "Where is it?"',
          items: [
            { ko: '뭐예요?', rom: 'mwoyeyo?', en: 'What is it?' },
            { ko: '어디예요?', rom: 'eodiyeyo?', en: 'Where is it?' },
            { ko: '얼마예요?', rom: 'eolmayeyo?', en: 'How much is it?' },
            { ko: '누구예요?', rom: 'nuguyeyo?', en: 'Who is it?' },
            { ko: '언제예요?', rom: 'eonjeyeyo?', en: 'When is it?' },
            { ko: '왜요?', rom: 'waeyo?', en: 'Why?' },
            { ko: '이게 뭐예요?', rom: 'ige mwoyeyo?', en: 'What is this?' },
            { ko: '화장실 어디예요?', rom: 'hwajangsil eodiyeyo?', en: 'Where is the restroom?' }
          ] },
        { id: 'p-feelings', title: 'Feelings & reactions', sub: 'good · tasty · tired', kind: 'word',
          items: [
            { ko: '좋아요', rom: 'joayo', en: 'Good / I like it' },
            { ko: '싫어요', rom: 'sireoyo', en: 'I don’t like it' },
            { ko: '맛있어요', rom: 'masisseoyo', en: 'It’s delicious' },
            { ko: '배고파요', rom: 'baegopayo', en: 'I’m hungry' },
            { ko: '피곤해요', rom: 'pigonhaeyo', en: 'I’m tired' },
            { ko: '재미있어요', rom: 'jaemiisseoyo', en: 'It’s fun / interesting' },
            { ko: '몰라요', rom: 'mollayo', en: 'I don’t know' },
            { ko: '알겠어요', rom: 'algesseoyo', en: 'Got it / I understand' }
          ] },
        { id: 'p-meeting', title: 'Meeting people', sub: 'name · where from', kind: 'word',
          items: [
            { ko: '처음 뵙겠습니다', rom: 'cheoeum boepgetseumnida', en: 'Nice to meet you (formal)' },
            { ko: '반가워요', rom: 'bangawoyo', en: 'Nice to meet you' },
            { ko: '이름이 뭐예요?', rom: 'ireumi mwoyeyo?', en: 'What’s your name?' },
            { ko: '저는 학생이에요', rom: 'jeoneun haksaengieyo', en: 'I’m a student' },
            { ko: '어디에서 왔어요?', rom: 'eodieseo wasseoyo?', en: 'Where are you from?' },
            { ko: '미국에서 왔어요', rom: 'migugeseo wasseoyo', en: 'I’m from the US' },
            { ko: '잘 부탁드려요', rom: 'jal butakdeuryeoyo', en: 'I look forward to getting to know you' },
            { ko: '또 만나요', rom: 'tto mannayo', en: 'See you again' }
          ] }
      ]
    },
    {
      id: 'grammar', title: 'First grammar', color: '#c4b5fd', icon: 'git-branch',
      lessons: [
        { id: 'g-ieyo', title: 'to be: 이에요 / 예요', sub: '"It is…" / "I am…"', grammar: {
          explain: ['Noun + 이에요 / 예요 = "is / am / are".',
                    'Ends in a consonant (has a bottom letter) → 이에요. 학생 → 학생이에요',
                    'Ends in a vowel → 예요. 커피 → 커피예요'],
          examples: [
            { ko: '저는 학생이에요.', rom: 'jeoneun haksaengieyo', en: 'I am a student.' },
            { ko: '이거 커피예요.', rom: 'igeo keopiyeyo', en: 'This is coffee.' },
            { ko: '여기 학교예요.', rom: 'yeogi hakgyoyeyo', en: 'This is a school.' }],
          quiz: [
            { q: '저는 학생___.', en: 'I am a student.', opts: ['이에요', '예요'], a: 0, why: '학생 ends in a consonant (ㅇ) → 이에요' },
            { q: '이거 사과___.', en: 'This is an apple.', opts: ['이에요', '예요'], a: 1, why: '사과 ends in a vowel → 예요' },
            { q: '여기는 식당___.', en: 'This place is a restaurant.', opts: ['이에요', '예요'], a: 0, why: '식당 ends in a consonant (ㅇ) → 이에요' },
            { q: '제 이름은 민수___.', en: 'My name is Minsu.', opts: ['이에요', '예요'], a: 1, why: '민수 ends in a vowel → 예요' },
            { q: '이건 물___.', en: 'This is water.', opts: ['이에요', '예요'], a: 0, why: '물 ends in a consonant (ㄹ) → 이에요' },
            { q: '저는 의사___.', en: 'I am a doctor.', opts: ['이에요', '예요'], a: 1, why: '의사 ends in a vowel → 예요' }] } },
        { id: 'g-topic', title: 'Topic marker 은 / 는', sub: '"As for…"', grammar: {
          explain: ['은 / 는 marks the topic — what the sentence is about.',
                    'After a consonant → 은. 오늘 → 오늘은',
                    'After a vowel → 는. 저 → 저는'],
          examples: [
            { ko: '저는 학생이에요.', rom: 'jeoneun haksaengieyo', en: 'I am a student.' },
            { ko: '오늘은 월요일이에요.', rom: 'oneureun woryoirieyo', en: 'Today is Monday.' },
            { ko: '커피는 맛있어요.', rom: 'keopineun masisseoyo', en: 'Coffee is tasty.' }],
          quiz: [
            { q: '저___ 미국 사람이에요.', en: 'I am American.', opts: ['은', '는'], a: 1, why: '저 ends in a vowel → 는' },
            { q: '오늘___ 금요일이에요.', en: 'Today is Friday.', opts: ['은', '는'], a: 0, why: '오늘 ends in a consonant (ㄹ) → 은' },
            { q: '이 책___ 재미있어요.', en: 'This book is interesting.', opts: ['은', '는'], a: 0, why: '책 ends in a consonant (ㄱ) → 은' },
            { q: '우리 엄마___ 의사예요.', en: 'My mom is a doctor.', opts: ['은', '는'], a: 1, why: '엄마 ends in a vowel → 는' },
            { q: '커피___ 써요.', en: 'Coffee is bitter.', opts: ['은', '는'], a: 1, why: '커피 ends in a vowel → 는' },
            { q: '집___ 커요.', en: 'The house is big.', opts: ['은', '는'], a: 0, why: '집 ends in a consonant (ㅂ) → 은' }] } },
        { id: 'g-have', title: 'have / there is: 있어요 · 없어요', sub: '"I have…" / "There isn’t…"', grammar: {
          explain: ['있어요 = have / there is.   없어요 = don’t have / there isn’t.',
                    'The thing usually takes 이 / 가: 시간이 있어요 = "I have time."'],
          examples: [
            { ko: '시간 있어요?', rom: 'sigan isseoyo?', en: 'Do you have time?' },
            { ko: '돈이 없어요.', rom: 'doni eopseoyo', en: 'I don’t have money.' },
            { ko: '화장실이 저기 있어요.', rom: 'hwajangsiri jeogi isseoyo', en: 'The restroom is over there.' }],
          quiz: [
            { q: '저는 오빠가 ___.', en: 'I have an older brother.', opts: ['있어요', '없어요'], a: 0, why: '"have" → 있어요' },
            { q: '지금 시간이 ___.', en: 'I don’t have time now.', opts: ['있어요', '없어요'], a: 1, why: '"don’t have" → 없어요' },
            { q: '여기 물이 ___.', en: 'There is water here.', opts: ['있어요', '없어요'], a: 0, why: '"there is" → 있어요' },
            { q: '집에 우유가 ___.', en: 'There is no milk at home.', opts: ['있어요', '없어요'], a: 1, why: '"there is no" → 없어요' }] } },
        { id: 'g-present', title: 'Present tense: -아요 / -어요', sub: 'go · eat · do', grammar: {
          explain: ['Verbs end in 다 in the dictionary. Drop 다 and add -아요 / -어요 to speak politely.',
                    'Last vowel ㅏ or ㅗ → -아요: 가다 → 가요, 보다 → 봐요',
                    'Other vowels → -어요: 먹다 → 먹어요, 마시다 → 마셔요',
                    '하다 → 해요: 공부하다 → 공부해요'],
          examples: [
            { ko: '학교에 가요.', rom: 'hakgyoe gayo', en: 'I go to school.' },
            { ko: '밥을 먹어요.', rom: 'babeul meogeoyo', en: 'I eat a meal.' },
            { ko: '한국어를 공부해요.', rom: 'hangugeoreul gongbuhaeyo', en: 'I study Korean.' }],
          quiz: [
            { q: '저는 밥을 ___. (먹다)', en: 'I eat rice.', opts: ['먹어요', '먹아요', '먹해요'], a: 0, why: '먹 has ㅓ → -어요' },
            { q: '학교에 ___. (가다)', en: 'I go to school.', opts: ['가요', '가어요', '가해요'], a: 0, why: '가 has ㅏ → 가요' },
            { q: '공부 ___. (하다)', en: 'I study.', opts: ['해요', '하요', '하어요'], a: 0, why: '하다 always becomes 해요' },
            { q: '커피를 ___. (마시다)', en: 'I drink coffee.', opts: ['마셔요', '마시요', '마사요'], a: 0, why: '마시 + 어요 → 마셔요' },
            { q: '영화를 ___. (보다)', en: 'I watch a movie.', opts: ['봐요', '보어요', '보해요'], a: 0, why: '보 has ㅗ → 보아요 → 봐요' }] } },
        { id: 'g-object', title: 'Object marker 을 / 를', sub: '"I eat RICE"', grammar: {
          explain: ['을 / 를 marks the object — the thing you eat, drink, watch…',
                    'After a consonant → 을. 밥 → 밥을',
                    'After a vowel → 를. 커피 → 커피를'],
          examples: [
            { ko: '밥을 먹어요.', rom: 'babeul meogeoyo', en: 'I eat a meal.' },
            { ko: '커피를 마셔요.', rom: 'keopireul masyeoyo', en: 'I drink coffee.' },
            { ko: '한국어를 배워요.', rom: 'hangugeoreul baewoyo', en: 'I learn Korean.' }],
          quiz: [
            { q: '물___ 마셔요.', en: 'I drink water.', opts: ['을', '를'], a: 0, why: '물 ends in a consonant (ㄹ) → 을' },
            { q: '영화___ 봐요.', en: 'I watch a movie.', opts: ['을', '를'], a: 1, why: '영화 ends in a vowel → 를' },
            { q: '책___ 읽어요.', en: 'I read a book.', opts: ['을', '를'], a: 0, why: '책 ends in a consonant (ㄱ) → 을' },
            { q: '사과___ 먹어요.', en: 'I eat an apple.', opts: ['을', '를'], a: 1, why: '사과 ends in a vowel → 를' },
            { q: '빵___ 사요.', en: 'I buy bread.', opts: ['을', '를'], a: 0, why: '빵 ends in a consonant (ㅇ) → 을' }] } },
        { id: 'g-neg', title: 'Not: 안 + verb', sub: '"I don’t…"', grammar: {
          explain: ['Put 안 right before the verb to make it negative: 가요 → 안 가요.',
                    'With 하다 verbs, 안 goes before 해요: 공부해요 → 공부 안 해요.'],
          examples: [
            { ko: '오늘 학교에 안 가요.', rom: 'oneul hakgyoe an gayo', en: 'I’m not going to school today.' },
            { ko: '고기를 안 먹어요.', rom: 'gogireul an meogeoyo', en: 'I don’t eat meat.' },
            { ko: '오늘은 공부 안 해요.', rom: 'oneureun gongbu an haeyo', en: 'I’m not studying today.' }],
          quiz: [
            { q: '커피를 ___.', en: 'I don’t drink coffee.', opts: ['안 마셔요', '마셔요 안', '마셔 안요'], a: 0, why: '안 goes right before the verb' },
            { q: '학교에 ___.', en: 'I don’t go to school.', opts: ['가요 안', '안 가요', '안가요요'], a: 1, why: '안 + 가요' },
            { q: '공부 ___.', en: 'I don’t study.', opts: ['안 해요', '해요 안', '안 공부요'], a: 0, why: 'With 하다 verbs: noun + 안 해요' },
            { q: '고기를 ___.', en: 'I don’t eat meat.', opts: ['먹어요 안', '안 먹어요', '먹안어요'], a: 1, why: '안 + 먹어요' }] } },
        { id: 'g-want', title: 'want to: -고 싶어요', sub: '"I want to go"', grammar: {
          explain: ['Verb stem (drop 다) + 고 싶어요 = "I want to …".',
                    '가다 → 가고 싶어요,  먹다 → 먹고 싶어요,  보다 → 보고 싶어요',
                    'Bonus: 보고 싶어요 also means "I miss you".'],
          examples: [
            { ko: '한국에 가고 싶어요.', rom: 'hanguge gago sipeoyo', en: 'I want to go to Korea.' },
            { ko: '비빔밥을 먹고 싶어요.', rom: 'bibimbabeul meokgo sipeoyo', en: 'I want to eat bibimbap.' },
            { ko: '보고 싶어요.', rom: 'bogo sipeoyo', en: 'I miss you.' }],
          quiz: [
            { q: '비빔밥을 ___.', en: 'I want to eat bibimbap.', opts: ['먹고 싶어요', '먹어 싶어요', '먹고 있어요'], a: 0, why: 'stem 먹 + 고 싶어요' },
            { q: '한국에 ___.', en: 'I want to go to Korea.', opts: ['가요 싶어요', '가고 싶어요', '가고 없어요'], a: 1, why: 'stem 가 + 고 싶어요' },
            { q: '영화를 ___.', en: 'I want to watch a movie.', opts: ['보고 싶어요', '봐고 싶어요', '보싶어요'], a: 0, why: 'stem 보 + 고 싶어요' },
            { q: '집에서 ___.', en: 'I want to rest at home.', opts: ['쉬어 싶어요', '쉬고 싶어요', '쉬고 싶다요'], a: 1, why: 'stem 쉬 + 고 싶어요' }] } },
        { id: 'g-past', title: 'Past tense: -았어요 / -었어요', sub: 'went · ate · did', grammar: {
          explain: ['Same rule as the present, with ㅆ어요 instead of 요:',
                    '가요 → 갔어요,  먹어요 → 먹었어요,  해요 → 했어요,  봐요 → 봤어요'],
          examples: [
            { ko: '어제 학교에 갔어요.', rom: 'eoje hakgyoe gasseoyo', en: 'I went to school yesterday.' },
            { ko: '밥을 먹었어요.', rom: 'babeul meogeosseoyo', en: 'I ate.' },
            { ko: '어제 공부했어요.', rom: 'eoje gongbuhaesseoyo', en: 'I studied yesterday.' }],
          quiz: [
            { q: '어제 학교에 ___.', en: 'I went to school yesterday.', opts: ['갔어요', '가요', '가었어요'], a: 0, why: '가요 → 갔어요' },
            { q: '밥을 ___.', en: 'I ate rice.', opts: ['먹어요', '먹었어요', '먹았어요'], a: 1, why: '먹어요 → 먹었어요' },
            { q: '공부___.', en: 'I studied.', opts: ['했어요', '해요', '하았어요'], a: 0, why: '해요 → 했어요' },
            { q: '영화를 ___.', en: 'I watched a movie.', opts: ['봐요', '보었어요', '봤어요'], a: 2, why: '봐요 → 봤어요' }] } },
        { id: 'g-please', title: 'Please do: -(으)세요', sub: '"Please sit down"', grammar: {
          explain: ['Verb stem + (으)세요 = a polite request: "please …".',
                    'Stem ends in a vowel → 세요: 가다 → 가세요',
                    'Stem ends in a consonant → 으세요: 앉다 → 앉으세요'],
          examples: [
            { ko: '여기 앉으세요.', rom: 'yeogi anjeuseyo', en: 'Please sit here.' },
            { ko: '잠시만 기다리세요.', rom: 'jamsiman gidariseyo', en: 'Please wait a moment.' },
            { ko: '맛있게 드세요.', rom: 'masitge deuseyo', en: 'Enjoy your meal.' }],
          quiz: [
            { q: '여기 ___. (앉다)', en: 'Please sit here.', opts: ['앉세요', '앉으세요', '앉아세요'], a: 1, why: '앉 ends in a consonant → 으세요' },
            { q: '잠시만 ___. (기다리다)', en: 'Please wait a moment.', opts: ['기다리세요', '기다리으세요', '기다려세요'], a: 0, why: '기다리 ends in a vowel → 세요' },
            { q: '안녕히 ___. (가다)', en: 'Goodbye (please go well).', opts: ['가으세요', '가세요', '가요세요'], a: 1, why: '가 ends in a vowel → 세요' },
            { q: '이 책을 ___. (읽다)', en: 'Please read this book.', opts: ['읽세요', '읽어세요', '읽으세요'], a: 2, why: '읽 ends in a consonant → 으세요' }] } }
      ]
    }
  ];

  var LESSONS = [];
  STAGES.forEach(function (st) { st.lessons.forEach(function (l) { l.stage = st; LESSONS.push(l); }); });

  // ── Helpers ─────────────────────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function say(t) { var f = window.srSpeak || window.khSpeak; if (f && t) { try { f(t); } catch (_) {} } }
  function uid() { try { return (window.supaUser && window.supaUser.id) || 'g'; } catch (_) { return 'g'; } }
  function progKey() { return 'kh_basics_v2_' + uid(); }
  function getProg() { try { return JSON.parse(localStorage.getItem(progKey()) || '{}') || {}; } catch (_) { return {}; } }
  function setProg(p) { try { localStorage.setItem(progKey(), JSON.stringify(p)); } catch (_) {} }
  function norm(s) { return String(s || '').replace(/[\s.,!?~'"’]/g, ''); }
  function jamos(word) {
    var out = [], s = String(word || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/[가-힣]/.test(ch) && window.khDecomposeHangul) {
        var d = window.khDecomposeHangul(ch);
        if (d) { out.push(d.cho); out.push(d.jung); if (d.jong) out.push(d.jong); continue; }
      }
      if (ch.trim()) out.push(ch);
    }
    return out;
  }
  function stars(pct) { return pct >= 90 ? 3 : pct >= 70 ? 2 : 1; }
  function starHtml(n) { var h = ''; for (var i = 0; i < 3; i++) h += '<span style="color:' + (i < n ? '#fbbf24' : 'rgba(255,255,255,.18)') + '">★</span>'; return h; }
  function nextLesson() { var p = getProg(); for (var i = 0; i < LESSONS.length; i++) if (!p[LESSONS[i].id]) return LESSONS[i]; return null; }
  function icons() { if (typeof window.renderKhLucideIcons === 'function') window.renderKhLucideIcons(); else if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }

  var BTN = 'border:none;border-radius:14px;font-family:inherit;font-weight:800;cursor:pointer;';
  var PRIMARY = BTN + 'background:linear-gradient(135deg,#38bdf8,#22c55e);color:#04111f;padding:15px 18px;font-size:15px;width:100%';
  var GHOST = BTN + 'background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.12);padding:13px 16px;font-size:14px';

  // ── Overlay ─────────────────────────────────────────────────
  function overlay() {
    var ov = document.getElementById('basics-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'basics-overlay';
      // Highest layer on the page — every step of the course renders in here.
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#060b16;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;color:#fff';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function frame(inner) { return '<div style="max-width:560px;margin:0 auto;padding:18px 16px 70px">' + inner + '</div>'; }

  window.openBasicsTrack = function () {
    var ov = overlay();
    ov.style.display = 'block';
    document.body.style.overflow = 'hidden';
    renderMap();
  };
  window.closeBasicsTrack = function () {
    var ov = document.getElementById('basics-overlay');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    S = null;
  };

  // ── Course map ──────────────────────────────────────────────
  function renderMap() {
    var ov = overlay(); ov.scrollTop = 0;
    var p = getProg();
    var done = LESSONS.filter(function (l) { return p[l.id]; }).length;
    var pct = Math.round(done / LESSONS.length * 100);
    var nxt = nextLesson();
    var html = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      +   '<div style="font-size:11px;font-weight:900;color:#7dd3fc;letter-spacing:.14em;text-transform:uppercase">Korean Basics</div>'
      +   '<button type="button" onclick="closeBasicsTrack()" aria-label="Close" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:20px;cursor:pointer">×</button>'
      + '</div>'
      + '<div style="font-size:23px;font-weight:900;margin-bottom:4px">From zero to your first sentences</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.55);margin-bottom:16px">' + LESSONS.length + ' short lessons. Each one ends with a quick quiz, then flows straight into the next.</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      +   '<div style="flex:1;height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden"><div style="width:' + pct + '%;height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#22c55e)"></div></div>'
      +   '<div style="font-size:12px;font-weight:800;color:rgba(255,255,255,.75)">' + done + ' / ' + LESSONS.length + '</div>'
      + '</div>'
      + (nxt
          ? '<button type="button" onclick="KHBasics.start(\'' + nxt.id + '\')" style="' + PRIMARY + ';margin-bottom:24px;text-align:left;display:flex;align-items:center;justify-content:space-between">'
            + '<span><span style="display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.7">' + (done ? 'Continue' : 'Start here') + '</span>' + esc(nxt.title) + '</span><span style="font-size:20px">→</span></button>'
          : '<div style="margin-bottom:24px;padding:16px;border-radius:14px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#86efac;font-weight:800;text-align:center">🎉 Course complete! Keep going with today’s lessons in the Study Room.</div>');
    STAGES.forEach(function (st, si) {
      html += '<div style="display:flex;align-items:center;gap:8px;margin:' + (si ? '22px' : '0') + ' 0 10px">'
        + '<i data-lucide="' + st.icon + '" style="width:16px;height:16px;color:' + st.color + '" aria-hidden="true"></i>'
        + '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:' + st.color + '">Stage ' + (si + 1) + ' · ' + esc(st.title) + '</div></div>';
      st.lessons.forEach(function (l) {
        var r = p[l.id]; var isNext = nxt && nxt.id === l.id;
        html += '<button type="button" onclick="KHBasics.start(\'' + l.id + '\')" style="width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:8px;border-radius:14px;cursor:pointer;text-align:left;font-family:inherit;color:#fff;'
          + 'border:1px solid ' + (isNext ? st.color : r ? 'rgba(134,239,172,.28)' : 'rgba(255,255,255,.1)') + ';background:' + (r ? 'rgba(34,197,94,.07)' : 'rgba(255,255,255,.04)') + '">'
          + '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800">' + esc(l.title) + '</div><div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:2px">' + esc(l.sub || '') + '</div></div>'
          + '<div style="flex-shrink:0;font-size:15px;letter-spacing:1px">' + (r ? starHtml(r.stars || 1) : '<span style="color:rgba(255,255,255,.3);font-size:18px">›</span>') + '</div>'
          + '</button>';
      });
    });
    ov.innerHTML = frame(html);
    icons();
  }

  // ── Lesson session ──────────────────────────────────────────
  var S = null; // { lesson, phase:'learn'|'quiz'|'done', i, qs, qi, correct, missed[] }

  function header(title, frac) {
    return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">'
      + '<button type="button" onclick="KHBasics.map()" aria-label="Back to course" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:18px;cursor:pointer;flex-shrink:0">×</button>'
      + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:800;color:rgba(255,255,255,.55);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(title) + '</div>'
      + '<div style="height:6px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden"><div style="width:' + Math.round(frac * 100) + '%;height:100%;background:linear-gradient(90deg,#38bdf8,#22c55e);transition:width .3s"></div></div></div>'
      + '</div>';
  }

  function start(id) {
    var lesson = LESSONS.filter(function (l) { return l.id === id; })[0];
    if (!lesson) return;
    S = { lesson: lesson, phase: 'learn', i: 0, qs: buildQuiz(lesson), qi: 0, correct: 0, missed: [] };
    renderLearn();
  }

  // Learn phase: word/letter cards, or grammar explanation + examples
  function renderLearn() {
    var ov = overlay(); ov.scrollTop = 0;
    var l = S.lesson;
    if (l.grammar) {
      var g = l.grammar;
      ov.innerHTML = frame(header(l.title, 0.15)
        + '<div style="font-size:22px;font-weight:900;margin-bottom:12px">' + esc(l.title) + '</div>'
        + '<div style="padding:14px 16px;border-radius:14px;background:rgba(196,181,253,.08);border:1px solid rgba(196,181,253,.25);margin-bottom:16px">'
        + g.explain.map(function (t) { return '<div style="font-size:14px;line-height:1.6;margin:4px 0;color:#e9e4ff">' + esc(t) + '</div>'; }).join('') + '</div>'
        + '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:8px">Examples — tap to hear</div>'
        + g.examples.map(function (e) {
            return '<button type="button" onclick="KHBasics.say(\'' + esc(e.ko).replace(/&#39;/g, "\\'") + '\')" style="width:100%;text-align:left;display:block;padding:12px 14px;margin-bottom:8px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;font-family:inherit;cursor:pointer">'
              + '<div style="font-size:18px;font-weight:800;font-family:\'Noto Sans KR\',sans-serif">🔊 ' + esc(e.ko) + '</div>'
              + '<div style="font-size:12px;color:#7dd3fc;margin-top:3px">' + esc(e.rom) + '</div>'
              + '<div style="font-size:13px;color:rgba(255,255,255,.65);margin-top:2px">' + esc(e.en) + '</div></button>';
          }).join('')
        + '<button type="button" onclick="KHBasics.toQuiz()" style="' + PRIMARY + ';margin-top:10px">Start the quiz →</button>');
      return;
    }
    var it = l.items[S.i];
    var big = l.kind === 'letter' && it.ko.length === 1 ? 88 : (it.ko.length > 6 ? 30 : 46);
    ov.innerHTML = frame(header(l.title, (S.i + 1) / (l.items.length + S.qs.length) )
      + (S.i === 0 && l.tip ? '<div style="padding:12px 14px;border-radius:12px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);font-size:13px;line-height:1.55;color:#cdeefe;margin-bottom:14px">💡 ' + esc(l.tip) + '</div>' : '')
      + '<div style="text-align:center;padding:26px 16px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);margin-bottom:16px">'
      +   '<div style="font-size:' + big + 'px;font-weight:900;line-height:1.15;font-family:\'Noto Sans KR\',sans-serif;word-break:keep-all">' + esc(it.ko) + '</div>'
      +   (it.say && it.say !== it.ko ? '<div style="font-size:15px;color:rgba(255,255,255,.55);margin-top:6px">as in <b style="color:#fff;font-family:\'Noto Sans KR\',sans-serif">' + esc(it.say) + '</b></div>' : '')
      +   '<div style="font-size:17px;color:#7dd3fc;font-weight:800;margin-top:10px">' + esc(it.rom) + '</div>'
      +   '<div style="font-size:15px;color:rgba(255,255,255,.75);margin-top:4px">' + esc(it.en) + '</div>'
      +   '<button type="button" onclick="KHBasics.sayCur()" style="' + GHOST + ';margin-top:16px">🔊 Listen again</button>'
      + '</div>'
      + '<div style="display:flex;gap:10px">'
      +   (S.i > 0 ? '<button type="button" onclick="KHBasics.prev()" style="' + GHOST + ';flex:0 0 auto">←</button>' : '')
      +   '<button type="button" onclick="KHBasics.next()" style="' + PRIMARY + '">' + (S.i < l.items.length - 1 ? 'Next  (' + (S.i + 1) + ' / ' + l.items.length + ')' : 'Start the quiz →') + '</button>'
      + '</div>');
    setTimeout(function () { say(it.say || it.ko); }, 200);
  }

  // Quiz builder — word/letter lessons get mixed question types
  function buildQuiz(l) {
    if (l.grammar) return shuffle(l.grammar.quiz).map(function (q) { return { type: 'fill', q: q }; });
    var items = l.items;
    var pool = items.length >= 4 ? items : items.concat(l.stage.lessons.reduce(function (a, x) { return a.concat(x.items || []); }, []));
    function distract(it, field) {
      var seen = {}; seen[it[field]] = 1;
      var opts = [it[field]];
      shuffle(pool).forEach(function (o) { if (opts.length < 4 && o[field] && !seen[o[field]]) { seen[o[field]] = 1; opts.push(o[field]); } });
      return shuffle(opts);
    }
    var spellable = items.filter(function (it) { return /^[가-힣]{1,3}$/.test(it.ko); });
    var spellSet = {}; shuffle(spellable).slice(0, l.kind === 'word' ? 2 : 0).forEach(function (it) { spellSet[it.ko] = 1; });
    return shuffle(items).map(function (it, i) {
      if (spellSet[it.ko]) return { type: 'spell', it: it };
      if (l.kind === 'letter') {
        return i % 2 ? { type: 'listen', it: it, field: 'ko', opts: distract(it, 'ko') }
                     : { type: 'sound', it: it, field: 'rom', opts: distract(it, 'rom') };
      }
      var t = i % 3;
      if (t === 0) return { type: 'meaning', it: it, field: 'en', opts: distract(it, 'en') };
      if (t === 1) return { type: 'listen', it: it, field: 'ko', opts: distract(it, 'ko') };
      return { type: 'reverse', it: it, field: 'ko', opts: distract(it, 'ko') };
    });
  }

  function renderQuiz() {
    var ov = overlay(); ov.scrollTop = 0;
    var l = S.lesson, q = S.qs[S.qi];
    var learnN = l.grammar ? 1 : l.items.length;
    var frac = (learnN + S.qi) / (learnN + S.qs.length);
    var h = header(l.title + ' · Quiz ' + (S.qi + 1) + ' / ' + S.qs.length, frac);
    var prompt = '', opts = [], optKo = false;
    if (q.type === 'fill') {
      prompt = '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:10px">Fill in the blank</div>'
        + '<div style="font-size:24px;font-weight:900;font-family:\'Noto Sans KR\',sans-serif;line-height:1.4">' + esc(q.q.q).replace('___', '<span style="color:#fbbf24">___</span>') + '</div>'
        + '<div style="font-size:14px;color:rgba(255,255,255,.6);margin-top:8px">' + esc(q.q.en) + '</div>';
      opts = q.q.opts; optKo = true;
    } else if (q.type === 'sound' || q.type === 'meaning') {
      prompt = '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:10px">' + (q.type === 'sound' ? 'How does it sound?' : 'What does it mean?') + '</div>'
        + '<div style="font-size:' + (q.it.ko.length === 1 ? 76 : 40) + 'px;font-weight:900;font-family:\'Noto Sans KR\',sans-serif">' + esc(q.it.ko) + '</div>'
        + '<button type="button" onclick="KHBasics.say(\'' + esc(q.it.say || q.it.ko).replace(/&#39;/g, "\\'") + '\')" style="' + GHOST + ';margin-top:10px;padding:8px 14px;font-size:13px">🔊</button>';
      opts = q.opts;
    } else if (q.type === 'listen') {
      prompt = '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:14px">Listen and choose</div>'
        + '<button type="button" onclick="KHBasics.say(\'' + esc(q.it.say || q.it.ko).replace(/&#39;/g, "\\'") + '\')" style="width:96px;height:96px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;font-size:38px;cursor:pointer">🔊</button>';
      opts = q.opts; optKo = true;
      setTimeout(function () { say(q.it.say || q.it.ko); }, 250);
    } else if (q.type === 'reverse') {
      prompt = '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:10px">Which one means…</div>'
        + '<div style="font-size:26px;font-weight:900">' + esc(q.it.en) + '</div>';
      opts = q.opts; optKo = true;
    } else if (q.type === 'spell') {
      ov.innerHTML = frame(h
        + '<div style="text-align:center;margin-bottom:14px"><div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:10px">Spell it</div>'
        + '<div style="font-size:24px;font-weight:900">' + esc(q.it.en) + '</div>'
        + '<button type="button" onclick="KHBasics.say(\'' + esc(q.it.ko).replace(/&#39;/g, "\\'") + '\')" style="' + GHOST + ';margin-top:10px;padding:8px 14px;font-size:13px">🔊 Hear it</button></div>'
        + '<input id="bsc-spell" type="text" readonly autocomplete="off" style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:2px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:24px;text-align:center;font-family:\'Noto Sans KR\',sans-serif">'
        + '<div id="bsc-fb" style="min-height:24px;margin:10px 0;text-align:center;font-weight:800"></div>'
        + '<button type="button" id="bsc-check" onclick="KHBasics.checkSpell()" style="' + PRIMARY + '">Check</button>');
      var inp = document.getElementById('bsc-spell');
      if (window.khAttachJamoKeyboard) { try { window.khAttachJamoKeyboard(inp, { keys: shuffle(jamos(q.it.ko)) }); } catch (_) {} }
      setTimeout(function () { say(q.it.ko); }, 250);
      return;
    }
    ov.innerHTML = frame(h
      + '<div style="text-align:center;margin-bottom:22px">' + prompt + '</div>'
      + '<div id="bsc-opts" style="display:grid;gap:10px">'
      + opts.map(function (o, k) {
          return '<button type="button" data-k="' + k + '" onclick="KHBasics.answer(' + k + ')" style="padding:15px 16px;border-radius:14px;border:1.5px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;font-size:' + (optKo ? 19 : 15) + 'px;font-weight:800;font-family:' + (optKo ? '\'Noto Sans KR\',sans-serif' : 'inherit') + ';cursor:pointer;text-align:left">' + esc(o) + '</button>';
        }).join('')
      + '</div><div id="bsc-why" style="margin-top:14px;font-size:14px;line-height:1.5;text-align:center"></div>');
  }

  function finishQuestion(ok, revealHtml) {
    if (ok) S.correct++;
    else {
      var q = S.qs[S.qi];
      S.missed.push(q.type === 'fill' ? { ko: q.q.q.replace('___', q.q.opts[q.q.a]), en: q.q.en } : { ko: q.it.ko, en: q.it.en, rom: q.it.rom });
    }
    var why = document.getElementById('bsc-why') || document.getElementById('bsc-fb');
    if (why && revealHtml) why.innerHTML = revealHtml;
    setTimeout(function () {
      S.qi++;
      if (S.qi >= S.qs.length) renderResult(); else renderQuiz();
    }, ok ? 850 : 1900);
  }

  function answer(k) {
    var q = S.qs[S.qi];
    var box = document.getElementById('bsc-opts'); if (!box || box.dataset.locked) return;
    box.dataset.locked = '1';
    var right = q.type === 'fill' ? q.q.a : q.opts.indexOf(q.it[q.field]);
    var btns = box.querySelectorAll('button');
    btns.forEach(function (b, i) {
      if (i === right) { b.style.background = 'rgba(34,197,94,.2)'; b.style.borderColor = '#22c55e'; }
      else if (i === k) { b.style.background = 'rgba(239,68,68,.18)'; b.style.borderColor = '#ef4444'; }
      b.style.cursor = 'default';
    });
    var ok = k === right;
    var reveal = ok ? '<span style="color:#86efac">Correct!</span>' : '<span style="color:#fca5a5">Not quite.</span>';
    if (q.type === 'fill') reveal += '<div style="color:rgba(255,255,255,.7);margin-top:4px">' + esc(q.q.why) + '</div>';
    else if (!ok) reveal += '<div style="color:rgba(255,255,255,.7);margin-top:4px"><b style="font-family:\'Noto Sans KR\',sans-serif">' + esc(q.it.ko) + '</b> = ' + esc(q.it.en) + '</div>';
    if (q.type !== 'listen') say(q.type === 'fill' ? q.q.q.replace('___', q.q.opts[q.q.a]) : (q.it.say || q.it.ko));
    finishQuestion(ok, reveal);
  }

  function checkSpell() {
    var q = S.qs[S.qi];
    var inp = document.getElementById('bsc-spell'); var btn = document.getElementById('bsc-check');
    if (!inp || !btn || btn.disabled) return;
    if (!inp.value.trim()) return;
    btn.disabled = true; btn.style.opacity = '.5';
    var ok = norm(inp.value) === norm(q.it.ko);
    inp.style.borderColor = ok ? '#22c55e' : '#ef4444';
    say(q.it.ko);
    finishQuestion(ok, ok ? '<span style="color:#86efac">Correct!</span>' : '<span style="color:#fca5a5">Answer: <b style="font-family:\'Noto Sans KR\',sans-serif">' + esc(q.it.ko) + '</b></span>');
  }

  function renderResult() {
    var ov = overlay(); ov.scrollTop = 0;
    var l = S.lesson, total = S.qs.length;
    var pct = total ? Math.round(S.correct / total * 100) : 100;
    var st = stars(pct);
    var p = getProg(); var prev = p[l.id];
    p[l.id] = { stars: Math.max(st, prev ? prev.stars || 0 : 0), best: Math.max(pct, prev ? prev.best || 0 : 0), at: Date.now() };
    setProg(p);
    try { if (typeof window.logActivity === 'function') window.logActivity('basics_lesson', { content_type: 'basics', content_id: l.id, content_title: l.title, score: S.correct, max_score: total }); } catch (_) {}
    var nxt = nextLesson();
    var idx = LESSONS.indexOf(l); var following = LESSONS[idx + 1] || null;
    var go = following || nxt;
    ov.innerHTML = frame(header(l.title, 1)
      + '<div style="text-align:center;padding:10px 0 18px">'
      +   '<div style="font-size:46px;letter-spacing:4px">' + starHtml(st) + '</div>'
      +   '<div style="font-size:26px;font-weight:900;margin-top:6px">' + (pct >= 90 ? 'Excellent!' : pct >= 70 ? 'Nice work!' : 'Good start!') + '</div>'
      +   '<div style="font-size:15px;color:rgba(255,255,255,.65);margin-top:4px">' + S.correct + ' / ' + total + ' correct</div>'
      + '</div>'
      + (S.missed.length ? '<div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:6px 0 8px">Review these</div>'
          + S.missed.map(function (m) {
              return '<button type="button" onclick="KHBasics.say(\'' + esc(m.ko).replace(/&#39;/g, "\\'") + '\')" style="width:100%;text-align:left;padding:11px 14px;margin-bottom:7px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;font-family:inherit;cursor:pointer">'
                + '<span style="font-size:17px;font-weight:800;font-family:\'Noto Sans KR\',sans-serif">🔊 ' + esc(m.ko) + '</span>'
                + '<span style="font-size:13px;color:rgba(255,255,255,.6);margin-left:8px">' + esc(m.en) + '</span></button>';
            }).join('') : '')
      + '<div style="display:grid;gap:10px;margin-top:18px">'
      + (go ? '<button type="button" onclick="KHBasics.start(\'' + go.id + '\')" style="' + PRIMARY + '">Next lesson: ' + esc(go.title) + ' →</button>'
            : '<div style="padding:14px;border-radius:14px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#86efac;font-weight:800;text-align:center">🎉 You finished Korean Basics!</div>')
      + '<div style="display:flex;gap:10px"><button type="button" onclick="KHBasics.start(\'' + l.id + '\')" style="' + GHOST + ';flex:1">Retry</button>'
      + '<button type="button" onclick="KHBasics.map()" style="' + GHOST + ';flex:1">Course map</button></div>'
      + '</div>');
  }

  window.KHBasics = {
    start: start,
    map: function () { S = null; renderMap(); },
    say: say,
    sayCur: function () { if (S && S.lesson.items) { var it = S.lesson.items[S.i]; say(it.say || it.ko); } },
    next: function () { if (!S) return; if (S.i < S.lesson.items.length - 1) { S.i++; renderLearn(); } else this.toQuiz(); },
    prev: function () { if (S && S.i > 0) { S.i--; renderLearn(); } },
    toQuiz: function () { if (!S) return; S.phase = 'quiz'; S.qi = 0; renderQuiz(); },
    answer: answer,
    checkSpell: checkSpell,
    _lessons: LESSONS
  };
})();
