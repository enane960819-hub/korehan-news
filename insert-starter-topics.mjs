import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://samghztrdvtxmrmawneu.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPA_KEY) {
  console.error('SUPABASE_SERVICE_KEY 또는 SUPABASE_KEY 환경변수가 필요합니다');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

// 60 Starter-level writing topics
// Starter = 한글을 막 배운 단계. 아주 짧고 쉬운 문장 2-4개 수준
const topics = [
  // 자기소개 (Introduction) - 12개
  { category: 'introduction', topic_ko: '내 이름', topic_en: 'My Name', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 나이', topic_en: 'My Age', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내가 사는 곳', topic_en: 'Where I Live', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 가족', topic_en: 'My Family', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 직업', topic_en: 'My Job', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 취미 하나', topic_en: 'One Hobby of Mine', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내가 좋아하는 색깔', topic_en: 'My Favorite Color', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 친구', topic_en: 'My Friend', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '나는 학생입니까?', topic_en: 'Am I a Student?', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 전화번호', topic_en: 'My Phone Number', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내 생일', topic_en: 'My Birthday', level: 'Starter', active: true },
  { category: 'introduction', topic_ko: '내가 한국어를 배우는 이유', topic_en: 'Why I Learn Korean', level: 'Starter', active: true },

  // 일상 (Daily Life) - 14개
  { category: 'daily', topic_ko: '오늘 아침', topic_en: 'This Morning', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '아침에 일어나는 시간', topic_en: 'The Time I Wake Up', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '매일 하는 일', topic_en: 'What I Do Every Day', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '지금 몇 시예요?', topic_en: 'What Time Is It Now?', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '오늘 날씨', topic_en: "Today's Weather", level: 'Starter', active: true },
  { category: 'daily', topic_ko: '지금 어디에 있어요?', topic_en: 'Where Are You Right Now?', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '잠자리에 드는 시간', topic_en: 'My Bedtime', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '주말에 뭐 해요?', topic_en: 'What Do You Do on Weekends?', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '내 방 묘사', topic_en: 'Describing My Room', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '오늘 입은 옷', topic_en: 'What I Am Wearing Today', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '학교나 회사까지 가는 방법', topic_en: 'How I Get to School or Work', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '집에서 좋아하는 공간', topic_en: 'My Favorite Spot at Home', level: 'Starter', active: true },
  { category: 'daily', topic_ko: '오늘 기분', topic_en: "Today's Mood", level: 'Starter', active: true },
  { category: 'daily', topic_ko: '어제 한 일 한 가지', topic_en: 'One Thing I Did Yesterday', level: 'Starter', active: true },

  // 음식 (Food) - 12개
  { category: 'food', topic_ko: '내가 좋아하는 음식', topic_en: 'My Favorite Food', level: 'Starter', active: true },
  { category: 'food', topic_ko: '오늘 점심', topic_en: "Today's Lunch", level: 'Starter', active: true },
  { category: 'food', topic_ko: '아침밥 먹어요?', topic_en: 'Do You Eat Breakfast?', level: 'Starter', active: true },
  { category: 'food', topic_ko: '싫어하는 음식', topic_en: 'Food I Dislike', level: 'Starter', active: true },
  { category: 'food', topic_ko: '자주 가는 식당', topic_en: 'A Restaurant I Often Go To', level: 'Starter', active: true },
  { category: 'food', topic_ko: '좋아하는 음료', topic_en: 'My Favorite Drink', level: 'Starter', active: true },
  { category: 'food', topic_ko: '한국 음식 중 먹어 본 것', topic_en: 'Korean Food I Have Tried', level: 'Starter', active: true },
  { category: 'food', topic_ko: '과일 이름 세 가지', topic_en: 'Three Fruit Names', level: 'Starter', active: true },
  { category: 'food', topic_ko: '달아요? 매워요?', topic_en: 'Is It Sweet? Is It Spicy?', level: 'Starter', active: true },
  { category: 'food', topic_ko: '냉장고에 있는 것', topic_en: "What's in My Fridge", level: 'Starter', active: true },
  { category: 'food', topic_ko: '디저트를 좋아해요?', topic_en: 'Do You Like Dessert?', level: 'Starter', active: true },
  { category: 'food', topic_ko: '배고파요? 배불러요?', topic_en: 'Are You Hungry or Full?', level: 'Starter', active: true },

  // 가족 (Family) - 8개
  { category: 'family', topic_ko: '우리 가족 인원수', topic_en: 'How Many People Are in My Family', level: 'Starter', active: true },
  { category: 'family', topic_ko: '엄마에 대해', topic_en: 'About My Mom', level: 'Starter', active: true },
  { category: 'family', topic_ko: '아빠에 대해', topic_en: 'About My Dad', level: 'Starter', active: true },
  { category: 'family', topic_ko: '형제자매가 있어요?', topic_en: 'Do You Have Siblings?', level: 'Starter', active: true },
  { category: 'family', topic_ko: '반려동물이 있어요?', topic_en: 'Do You Have a Pet?', level: 'Starter', active: true },
  { category: 'family', topic_ko: '가족과 사는 곳', topic_en: 'Where I Live with My Family', level: 'Starter', active: true },
  { category: 'family', topic_ko: '가족과 함께 하는 것', topic_en: 'What I Do with My Family', level: 'Starter', active: true },
  { category: 'family', topic_ko: '할머니나 할아버지', topic_en: 'My Grandma or Grandpa', level: 'Starter', active: true },

  // 취미/관심사 (Hobbies) - 8개
  { category: 'hobby', topic_ko: '내가 좋아하는 것 한 가지', topic_en: 'One Thing I Like', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '음악을 좋아해요?', topic_en: 'Do You Like Music?', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '운동해요?', topic_en: 'Do You Exercise?', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '자주 보는 TV 프로그램', topic_en: 'A TV Show I Often Watch', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '좋아하는 계절', topic_en: 'My Favorite Season', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '책 읽는 것을 좋아해요?', topic_en: 'Do You Like Reading Books?', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '게임을 해요?', topic_en: 'Do You Play Games?', level: 'Starter', active: true },
  { category: 'hobby', topic_ko: '사진 찍는 것을 좋아해요?', topic_en: 'Do You Like Taking Photos?', level: 'Starter', active: true },

  // 한국어 학습 (Learning Korean) - 6개
  { category: 'study', topic_ko: '오늘 배운 한국어 단어', topic_en: 'Korean Words I Learned Today', level: 'Starter', active: true },
  { category: 'study', topic_ko: '어려운 한국어 발음', topic_en: 'A Difficult Korean Sound', level: 'Starter', active: true },
  { category: 'study', topic_ko: '좋아하는 한국어 단어', topic_en: 'My Favorite Korean Word', level: 'Starter', active: true },
  { category: 'study', topic_ko: '한국어로 숫자 세기', topic_en: 'Counting Numbers in Korean', level: 'Starter', active: true },
  { category: 'study', topic_ko: '한국어 공부 방법', topic_en: 'How I Study Korean', level: 'Starter', active: true },
  { category: 'study', topic_ko: '한국에 대해 아는 것', topic_en: 'Things I Know About Korea', level: 'Starter', active: true },
];

console.log(`총 ${topics.length}개 Starter 토픽 삽입 중...`);

const { data, error } = await supabase
  .from('writing_topics')
  .insert(topics)
  .select('id, topic_en, category');

if (error) {
  console.error('삽입 실패:', error.message);
  process.exit(1);
}

console.log(`\n✅ ${data.length}개 삽입 완료!\n`);
const byCategory = {};
data.forEach(r => {
  byCategory[r.category] = (byCategory[r.category] || 0) + 1;
});
Object.entries(byCategory).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}개`);
});
