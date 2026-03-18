import { execSync } from 'child_process';

const SB_URL = 'https://samghztrdvtxmrmawneu.supabase.co/rest/v1/conversations_data';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs';

function insertRow(row) {
  const body = JSON.stringify(row).replace(/'/g, `'\\''`);
  const cmd = `curl -s -w "\\n%{http_code}" -X POST '${SB_URL}' -H 'apikey: ${SB_KEY}' -H 'Authorization: Bearer ${SB_KEY}' -H 'Content-Type: application/json' -H 'Prefer: return=minimal' -d '${body}'`;
  const result = execSync(cmd).toString().trim();
  const status = parseInt(result.split('\n').pop());
  return status >= 200 && status < 300;
}

const CONVS = [
  // ═══════════════════════════════════════════════════════
  //  BEGINNER (b) — 5개
  // ═══════════════════════════════════════════════════════
  {
    name: '처음 만났어요',
    ctx: 'Two new students meet on the first day of class',
    cat: 'everyday', lvl: 'b', avi: '👋',
    topic: 'Introductions',
    msgs: [
      { s:'l', who:'지수', txt:'안녕하세요! 저는 지수예요.' },
      { s:'r', who:'민준', txt:'안녕하세요! 저는 민준이에요. 반가워요!' },
      { s:'l', who:'지수', txt:'민준 씨, 어느 나라 사람이에요?' },
      { s:'r', who:'민준', txt:'저는 한국 사람이에요. 지수 씨는요?' },
      { s:'l', who:'지수', txt:'저는 일본에서 왔어요. 한국어를 공부하고 있어요.' },
      { s:'r', who:'민준', txt:'정말요? 한국어 잘하시네요!' },
      { s:'l', who:'지수', txt:'아니에요. 아직 많이 부족해요.' },
      { s:'r', who:'민준', txt:'나이가 어떻게 되세요?' },
      { s:'l', who:'지수', txt:'스물두 살이에요. 민준 씨는요?' },
      { s:'r', who:'민준', txt:'저도 스물두 살이에요! 동갑이네요.' },
      { s:'l', who:'지수', txt:'와, 진짜요? 그럼 말 놔도 돼요?' },
      { s:'r', who:'민준', txt:'물론이죠! 앞으로 잘 부탁해!' },
    ],
    vocab: [
      { ko:'반갑다', rom:'bangapda', en:'Nice to meet you' },
      { ko:'어느 나라', rom:'eoneu nara', en:'which country' },
      { ko:'~에서 왔어요', rom:'-eseo wasseoyo', en:'I came from ~' },
      { ko:'부족하다', rom:'bujokada', en:'to be lacking / not enough' },
      { ko:'동갑', rom:'donggap', en:'same age' },
      { ko:'말을 놓다', rom:'mareul nota', en:'to speak informally' },
    ],
    grammar: [
      { point:'~이에요/예요', example:'저는 지수예요', meaning:'[noun] + am/is/are (polite)' },
      { point:'아직 많이 ~', example:'아직 많이 부족해요', meaning:'"still" + degree — expressing humility' },
    ],
    mission: [{ task:'Introduce yourself using 저는 [name]이에요/예요' }],
  },

  {
    name: '카페에서 주문해요',
    ctx: 'Ordering at a café for the first time',
    cat: 'everyday', lvl: 'b', avi: '☕',
    topic: 'Food & Drink',
    msgs: [
      { s:'l', who:'직원', txt:'어서 오세요! 주문하시겠어요?' },
      { s:'r', who:'하나', txt:'네, 아메리카노 한 잔 주세요.' },
      { s:'l', who:'직원', txt:'아이스로 드릴까요, 따뜻하게 드릴까요?' },
      { s:'r', who:'하나', txt:'아이스로 주세요.' },
      { s:'l', who:'직원', txt:'사이즈는 어떻게 하시겠어요? 스몰, 미디엄, 라지 있어요.' },
      { s:'r', who:'하나', txt:'미디엄으로 주세요. 얼마예요?' },
      { s:'l', who:'직원', txt:'사천오백 원이에요.' },
      { s:'r', who:'하나', txt:'카드 돼요?' },
      { s:'l', who:'직원', txt:'네, 카드 됩니다. 여기에 꽂아주세요.' },
      { s:'r', who:'하나', txt:'감사합니다. 얼마나 걸려요?' },
      { s:'l', who:'직원', txt:'약 3분 정도요. 진동벨 드릴게요.' },
      { s:'r', who:'하나', txt:'네, 감사합니다!' },
    ],
    vocab: [
      { ko:'주문하다', rom:'jumunhada', en:'to order' },
      { ko:'아이스', rom:'aiseu', en:'iced / cold' },
      { ko:'따뜻하다', rom:'ttatteutada', en:'warm / hot' },
      { ko:'얼마예요', rom:'eolmayeyo', en:'How much is it?' },
      { ko:'진동벨', rom:'jindongbel', en:'pager / buzzer' },
      { ko:'약 ~분 정도', rom:'yak ~bun jeongdo', en:'about ~ minutes' },
    ],
    grammar: [
      { point:'~(으)로 주세요', example:'아이스로 주세요', meaning:'Please give me ~ (with choice/direction)' },
      { point:'~ㄹ게요', example:'드릴게요', meaning:'I will ~ (speaker\'s intention/promise)' },
    ],
    mission: [{ task:'Order a drink specifying temperature and size using ~로 주세요' }],
  },

  {
    name: '주말 계획 세우기',
    ctx: 'Two classmates making weekend plans',
    cat: 'friends', lvl: 'b', avi: '🗓️',
    topic: 'Weekend Plans',
    msgs: [
      { s:'l', who:'소연', txt:'이번 주말에 뭐 해?' },
      { s:'r', who:'태양', txt:'아직 모르겠어. 너는?' },
      { s:'l', who:'소연', txt:'나는 쇼핑하러 명동에 갈 거야. 같이 갈래?' },
      { s:'r', who:'태양', txt:'명동? 좋아! 몇 시에 만날까?' },
      { s:'l', who:'소연', txt:'오후 두 시 어때?' },
      { s:'r', who:'태양', txt:'조금 이른 것 같은데. 세 시는 어때?' },
      { s:'l', who:'소연', txt:'그래, 세 시에 만나자. 어디서 만날까?' },
      { s:'r', who:'태양', txt:'명동역 1번 출구 앞에서 만나자.' },
      { s:'l', who:'소연', txt:'알겠어! 그럼 쇼핑 끝나고 밥도 먹자.' },
      { s:'r', who:'태양', txt:'좋아! 뭐 먹고 싶어?' },
      { s:'l', who:'소연', txt:'떡볶이 먹고 싶다. 명동에 맛있는 데 있거든.' },
      { s:'r', who:'태양', txt:'완전 좋아! 그럼 토요일에 봐~' },
    ],
    vocab: [
      { ko:'계획', rom:'gyehoek', en:'plan' },
      { ko:'쇼핑하다', rom:'syopinghada', en:'to go shopping' },
      { ko:'이르다', rom:'ireuda', en:'to be early' },
      { ko:'출구', rom:'chulgu', en:'exit (subway)' },
      { ko:'떡볶이', rom:'tteokbokki', en:'spicy rice cakes' },
      { ko:'~거든', rom:'-geodeun', en:'Because ~ / You see ~ (giving reason/info)' },
    ],
    grammar: [
      { point:'~(으)ㄹ 거야', example:'갈 거야', meaning:'I\'m going to ~ (future plan, informal)' },
      { point:'~자', example:'만나자 / 먹자', meaning:'Let\'s ~ (suggestion, informal)' },
    ],
    mission: [{ task:'Suggest a meeting time and place using ~에서 만나자' }],
  },

  {
    name: '편의점에서',
    ctx: 'Buying snacks at a convenience store',
    cat: 'everyday', lvl: 'b', avi: '🏪',
    topic: 'Shopping',
    msgs: [
      { s:'l', who:'직원', txt:'어서 오세요~' },
      { s:'r', who:'준호', txt:'삼각김밥 어디에 있어요?' },
      { s:'l', who:'직원', txt:'저기 냉장고 옆에 있어요.' },
      { s:'r', who:'준호', txt:'아, 감사합니다.' },
      { s:'r', who:'준호', txt:'그리고 라면도 있어요?' },
      { s:'l', who:'직원', txt:'네, 2번 라인 끝에 있어요.' },
      { s:'r', who:'준호', txt:'여기서 끓여 먹을 수 있어요?' },
      { s:'l', who:'직원', txt:'네, 안쪽에 전자레인지랑 뜨거운 물 있어요.' },
      { s:'r', who:'준호', txt:'좋아요. 이거랑 이거 주세요.' },
      { s:'l', who:'직원', txt:'봉투 필요하세요?' },
      { s:'r', who:'준호', txt:'아니요, 괜찮아요. 얼마예요?' },
      { s:'l', who:'직원', txt:'삼천이백 원이에요. 포인트 카드 있으세요?' },
      { s:'r', who:'준호', txt:'아니요. 카드로 낼게요.' },
    ],
    vocab: [
      { ko:'삼각김밥', rom:'samgak-gimbap', en:'triangle rice ball' },
      { ko:'냉장고', rom:'naengjanggo', en:'refrigerator' },
      { ko:'전자레인지', rom:'jeonjareInji', en:'microwave' },
      { ko:'봉투', rom:'bongtu', en:'(plastic) bag' },
      { ko:'포인트 카드', rom:'pointeu kadeu', en:'loyalty/points card' },
      { ko:'끓이다', rom:'kkeulhida', en:'to boil / cook (in hot water)' },
    ],
    grammar: [
      { point:'~(으)ㄹ 수 있어요', example:'끓여 먹을 수 있어요?', meaning:'Can ~ ? / Is it possible to ~ ?' },
      { point:'~(으)로 낼게요', example:'카드로 낼게요', meaning:'I\'ll pay by ~ (method)' },
    ],
    mission: [{ task:'Ask where something is using 어디에 있어요?' }],
  },

  {
    name: '취미가 뭐예요?',
    ctx: 'Getting to know a coworker\'s hobbies',
    cat: 'work', lvl: 'b', avi: '🎨',
    topic: 'Hobbies',
    msgs: [
      { s:'l', who:'윤아', txt:'박 씨, 취미가 뭐예요?' },
      { s:'r', who:'박준', txt:'저는 운동을 좋아해요. 윤아 씨는요?' },
      { s:'l', who:'윤아', txt:'저는 그림 그리는 걸 좋아해요.' },
      { s:'r', who:'박준', txt:'와, 멋있다! 어떤 그림을 그려요?' },
      { s:'l', who:'윤아', txt:'주로 풍경화를 그려요. 취미로 배우고 있어요.' },
      { s:'r', who:'박준', txt:'저도 새로운 취미를 찾고 싶어요.' },
      { s:'l', who:'윤아', txt:'그림 배워 보는 건 어때요? 재미있어요!' },
      { s:'r', who:'박준', txt:'저는 그림을 잘 못 그리는데요...' },
      { s:'l', who:'윤아', txt:'괜찮아요. 처음엔 다 못 그리잖아요.' },
      { s:'r', who:'박준', txt:'그렇네요. 어디서 배워요?' },
      { s:'l', who:'윤아', txt:'홍대 근처에 작은 공방이 있어요. 같이 가볼까요?' },
      { s:'r', who:'박준', txt:'좋아요! 언제 가요?' },
    ],
    vocab: [
      { ko:'취미', rom:'chwimi', en:'hobby' },
      { ko:'풍경화', rom:'punggyeonghwa', en:'landscape painting' },
      { ko:'주로', rom:'juro', en:'mainly / mostly' },
      { ko:'공방', rom:'gongbang', en:'craft studio / workshop' },
      { ko:'~는 건 어때요', rom:'-neun geon eottaeyo', en:'How about doing ~ ?' },
      { ko:'처음엔', rom:'cheoeumaen', en:'at first / in the beginning' },
    ],
    grammar: [
      { point:'~는 걸 좋아해요', example:'그림 그리는 걸 좋아해요', meaning:'I like ~ing' },
      { point:'~아/어 보다', example:'배워 보는 건 어때요', meaning:'to try doing ~' },
    ],
    mission: [{ task:'Suggest trying something using ~아/어 보는 건 어때요?' }],
  },

  // ═══════════════════════════════════════════════════════
  //  INTERMEDIATE (i) — 5개
  // ═══════════════════════════════════════════════════════
  {
    name: '부산 여행 계획',
    ctx: 'Two friends planning a trip to Busan',
    cat: 'friends', lvl: 'i', avi: '🚄',
    topic: 'Travel',
    msgs: [
      { s:'l', who:'채린', txt:'다음 달에 부산 여행 어떻게 생각해?' },
      { s:'r', who:'석진', txt:'대박! 나 부산 꼭 가보고 싶었는데. 언제?' },
      { s:'l', who:'채린', txt:'3박 4일 정도 생각하고 있어. 4월 초가 어때?' },
      { s:'r', who:'석진', txt:'4월 초면 벚꽃도 피겠다! 완전 좋지.' },
      { s:'l', who:'채린', txt:'KTX 타고 가면 두 시간 반이면 돼.' },
      { s:'r', who:'석진', txt:'그래? 생각보다 빠르네. 숙소는 어디로 해?' },
      { s:'l', who:'채린', txt:'해운대 근처로 잡으려고. 해수욕장도 걸어서 갈 수 있게.' },
      { s:'r', who:'석진', txt:'좋은 생각이다. 숙소 비용은 얼마나 할까?' },
      { s:'l', who:'채린', txt:'1박에 6만 원에서 8만 원 사이면 괜찮을 것 같아.' },
      { s:'r', who:'석진', txt:'그 정도면 합리적이네. 먹거리는 어때? 밀면이랑 돼지국밥 먹어야지!' },
      { s:'l', who:'채린', txt:'당연하지! 씨앗호떡이랑 어묵도 빠지면 안 되지.' },
      { s:'r', who:'석진', txt:'생각만 해도 배고프다. 빨리 예약하자!' },
    ],
    vocab: [
      { ko:'3박 4일', rom:'sambaek sail', en:'3 nights, 4 days' },
      { ko:'벚꽃', rom:'beotkkot', en:'cherry blossom' },
      { ko:'숙소', rom:'sukso', en:'accommodation' },
      { ko:'합리적', rom:'hamnijeok', en:'reasonable / rational' },
      { ko:'밀면', rom:'milmyeon', en:'Busan cold wheat noodles' },
      { ko:'씨앗호떡', rom:'ssiat hoteok', en:'Busan seed hotteok (sweet pancake)' },
    ],
    grammar: [
      { point:'~(으)면 되다', example:'두 시간 반이면 돼', meaning:'~ is enough / all you need is ~' },
      { point:'~(으)려고', example:'잡으려고', meaning:'intending to ~ / planning to ~' },
    ],
    mission: [{ task:'Talk about a travel plan using ~(으)려고 해 (I\'m planning to ~)' }],
  },

  {
    name: '영화 이야기',
    ctx: 'Discussing a recently watched film',
    cat: 'friends', lvl: 'i', avi: '🎬',
    topic: 'Movies & Culture',
    msgs: [
      { s:'l', who:'다은', txt:'어제 봤는데, 파묘 진짜 무서웠어.' },
      { s:'r', who:'현우', txt:'나도 봤어! 어떤 장면이 제일 무서웠어?' },
      { s:'l', who:'다은', txt:'중반부에 무덤 파는 장면. 소름 돋아서 눈 못 뜨겠더라.' },
      { s:'r', who:'현우', txt:'맞아, 그 장면 진짜 압박감 장난 아니었잖아.' },
      { s:'l', who:'다은', txt:'그런데 스토리는 어땠어? 나는 결말이 좀 아쉬웠어.' },
      { s:'r', who:'현우', txt:'나는 결말 나름 괜찮았던 것 같던데. 어떤 부분이 아쉬웠어?' },
      { s:'l', who:'다은', txt:'중간에 복선이 너무 많았는데 제대로 안 풀린 게 있어서.' },
      { s:'r', who:'현우', txt:'아, 그 부분? 나는 그냥 열린 결말로 해석했어.' },
      { s:'l', who:'다은', txt:'그렇게 볼 수도 있겠다. 최민식 연기는 진짜 최고였잖아.' },
      { s:'r', who:'현우', txt:'그렇지! 눈빛만으로 다 표현하더라. 역시 클래스가 달라.' },
      { s:'l', who:'다은', txt:'다음에 같이 보러 가자. 너 공포 영화 좋아해?' },
      { s:'r', who:'현우', txt:'좋아하긴 하는데 혼자는 좀 무서워서. 같이 가면 좋지!' },
    ],
    vocab: [
      { ko:'소름 돋다', rom:'soreum dodda', en:'to get goosebumps / be creeped out' },
      { ko:'압박감', rom:'apbakgam', en:'sense of pressure / tension' },
      { ko:'결말', rom:'gyeolmal', en:'ending (of a story)' },
      { ko:'복선', rom:'bokseon', en:'foreshadowing' },
      { ko:'열린 결말', rom:'yeollin gyeolmal', en:'open ending' },
      { ko:'클래스가 다르다', rom:'keullaeseuga dareuda', en:'on a different level / in a class of their own' },
    ],
    grammar: [
      { point:'~더라', example:'소름 돋아서 눈 못 뜨겠더라', meaning:'I found / experienced that ~ (reported past experience)' },
      { point:'~(ㄴ/은)데', example:'괜찮았던 것 같던데', meaning:'But ~ / though ~ (contrast/lead-in)' },
    ],
    mission: [{ task:'Give your opinion on a movie ending using 결말이 ~ 것 같아' }],
  },

  {
    name: '택배 문제 해결',
    ctx: 'Customer calling delivery company about a missing package',
    cat: 'everyday', lvl: 'i', avi: '📦',
    topic: 'Problem Solving',
    msgs: [
      { s:'l', who:'상담원', txt:'안녕하세요, 빠른배송 고객센터입니다. 무엇을 도와드릴까요?' },
      { s:'r', who:'고객', txt:'안녕하세요. 택배가 아직 안 와서 문의드리려고요.' },
      { s:'l', who:'상담원', txt:'불편을 드려서 죄송합니다. 운송장 번호 알려주시겠어요?' },
      { s:'r', who:'고객', txt:'네, 잠깐만요. 1234-5678-9012 입니다.' },
      { s:'l', who:'상담원', txt:'확인해 보겠습니다. 잠시만요... 고객님, 어제 오후에 배송 시도를 했는데 부재중이셨어요.' },
      { s:'r', who:'고객', txt:'아, 그때 외출 중이었거든요. 언제 다시 배송되나요?' },
      { s:'l', who:'상담원', txt:'오늘 중으로 재배송 신청 가능하세요. 아니면 편의점 픽업도 되세요.' },
      { s:'r', who:'고객', txt:'편의점 픽업은 어떻게 해요?' },
      { s:'l', who:'상담원', txt:'주소지 근처 편의점으로 보내드리면 3일 이내에 찾아가시면 됩니다.' },
      { s:'r', who:'고객', txt:'그게 더 편리할 것 같아요. 그걸로 신청해 주세요.' },
      { s:'l', who:'상담원', txt:'네, 신청해드렸어요. 문자로 안내 드릴게요.' },
      { s:'r', who:'고객', txt:'감사합니다. 수고하세요!' },
    ],
    vocab: [
      { ko:'운송장 번호', rom:'unsongiang beonho', en:'tracking number' },
      { ko:'부재중', rom:'bujaeJung', en:'absent / not home' },
      { ko:'재배송', rom:'jaebaesung', en:'re-delivery' },
      { ko:'픽업', rom:'pigeop', en:'pickup' },
      { ko:'주소지', rom:'juseoji', en:'registered address' },
      { ko:'~이내에', rom:'-inaee', en:'within ~ (time frame)' },
    ],
    grammar: [
      { point:'~(으)려고요', example:'문의드리려고요', meaning:'I was going to ~ / I\'m calling because I want to ~' },
      { point:'~(으)면 됩니다', example:'찾아가시면 됩니다', meaning:'You just need to ~ / All you have to do is ~' },
    ],
    mission: [{ task:'Practice a polite complaint call using 불편을 드려서 죄송합니다' }],
  },

  {
    name: '오랜만에 만난 친구',
    ctx: 'Two old friends catching up after 2 years apart',
    cat: 'friends', lvl: 'i', avi: '🤝',
    topic: 'Catching Up',
    msgs: [
      { s:'l', who:'유진', txt:'야, 진짜 오랜만이다! 2년 만인가?' },
      { s:'r', who:'세호', txt:'맞아, 정말 오래됐지. 너 하나도 안 변했다!' },
      { s:'l', who:'유진', txt:'무슨 소리야, 살쪘잖아. 근데 너는 좀 달라 보여.' },
      { s:'r', who:'세호', txt:'헬스 시작했거든. 한 1년 됐나?' },
      { s:'l', who:'유진', txt:'대박, 그래서 그렇구나. 요즘 어떻게 지냈어?' },
      { s:'r', who:'세호', txt:'회사 옮겼어. 지난달에. 분위기가 훨씬 좋아.' },
      { s:'l', who:'유진', txt:'진짜? 어디로? 연봉도 올랐어?' },
      { s:'r', who:'세호', txt:'조금. 근데 복지가 더 좋아서 만족해. 너는?' },
      { s:'l', who:'유진', txt:'나는 아직 같은 회사. 요즘 야근이 너무 많아서 힘들어.' },
      { s:'r', who:'세호', txt:'힘들겠다. 이직 생각 없어?' },
      { s:'l', who:'유진', txt:'고민 중이야. 포트폴리오 준비하고 있어.' },
      { s:'r', who:'세호', txt:'잘 될 거야. 오늘은 맘 편히 마시자!' },
    ],
    vocab: [
      { ko:'오랜만이다', rom:'oraenmanida', en:'It\'s been a long time' },
      { ko:'헬스', rom:'helseu', en:'gym / weightlifting' },
      { ko:'분위기', rom:'bunwigi', en:'atmosphere / vibe' },
      { ko:'연봉', rom:'yeonbong', en:'annual salary' },
      { ko:'복지', rom:'bokji', en:'welfare / benefits (work perks)' },
      { ko:'이직', rom:'ijik', en:'job change / changing companies' },
    ],
    grammar: [
      { point:'~(았/었)거든', example:'헬스 시작했거든', meaning:'Because ~ / You see ~ (explaining background)' },
      { point:'~(으)ㄴ/는 것 같아', example:'달라 보여', meaning:'seem to ~ / look like ~ (-보이다 = to appear)' },
    ],
    mission: [{ task:'Use 요즘 어떻게 지냈어? to catch up with someone and share your own news' }],
  },

  {
    name: '회식 자리',
    ctx: 'Team dinner after work — navigating workplace social dynamics',
    cat: 'work', lvl: 'i', avi: '🍻',
    topic: 'Workplace Social',
    msgs: [
      { s:'l', who:'팀장', txt:'오늘 다들 수고했어요. 자, 건배!' },
      { s:'r', who:'민서', txt:'건배! 팀장님, 오늘 발표 정말 잘 하셨어요.' },
      { s:'l', who:'팀장', txt:'에이, 민서 씨가 자료 준비를 잘 해줬잖아요.' },
      { s:'r', who:'민서', txt:'같이 잘 한 거죠, 뭐. 다음 프로젝트도 기대됩니다.' },
      { s:'l', who:'팀장', txt:'그렇죠. 다음 건도 민서 씨한테 맡기고 싶어요.' },
      { s:'r', who:'민서', txt:'감사합니다. 열심히 하겠습니다. 근데 팀장님, 주량이 어떻게 되세요?' },
      { s:'l', who:'팀장', txt:'하하, 저는 소주 한 병 반 정도요. 민서 씨는요?' },
      { s:'r', who:'민서', txt:'저는 좀 못 마시는 편이에요. 한 잔 정도?' },
      { s:'l', who:'팀장', txt:'그럼 맥주로 바꿀까요? 편하게 마셔요.' },
      { s:'r', who:'민서', txt:'감사합니다. 팀장님이랑 일하면서 많이 배우고 있어요.' },
      { s:'l', who:'팀장', txt:'저도 민서 씨 덕분에 편하게 일하고 있어요.' },
      { s:'r', who:'민서', txt:'이런 말씀 해주시니까 너무 감사해요. 오늘 즐겁게 마시겠습니다!' },
    ],
    vocab: [
      { ko:'건배', rom:'geonbae', en:'Cheers! (toast)' },
      { ko:'주량', rom:'juryang', en:'alcohol tolerance / drinking capacity' },
      { ko:'소주', rom:'soju', en:'soju (Korean distilled spirit)' },
      { ko:'~한테 맡기다', rom:'-hante matgida', en:'to entrust ~ to someone' },
      { ko:'~는 편이다', rom:'-neun pyeonida', en:'tend to ~ / be the type who ~' },
      { ko:'~덕분에', rom:'-deokbune', en:'thanks to ~ / because of ~ (positive)' },
    ],
    grammar: [
      { point:'~고 싶어요', example:'맡기고 싶어요', meaning:'I want to ~' },
      { point:'~면서', example:'일하면서', meaning:'while ~ing / as ~' },
    ],
    mission: [{ task:'Give a compliment to a colleague using ~덕분에 and respond humbly' }],
  },

  // ═══════════════════════════════════════════════════════
  //  ADVANCED (a) — 5개
  // ═══════════════════════════════════════════════════════
  {
    name: '뉴스 이슈 토론',
    ctx: 'Two friends debating a controversial news topic about work-life balance',
    cat: 'everyday', lvl: 'a', avi: '📰',
    topic: 'News & Society',
    msgs: [
      { s:'l', who:'혜수', txt:'오늘 기사 봤어? 주 4일제 도입 얘기 또 나왔더라고.' },
      { s:'r', who:'재원', txt:'응. 근데 현실적으로 가능하긴 한 걸까 싶더라.' },
      { s:'l', who:'혜수', txt:'왜? 유럽 여러 나라에서 이미 시도하고 있잖아. 생산성도 오히려 올랐다는 연구도 있고.' },
      { s:'r', who:'재원', txt:'물론 그런 결과도 있는데, 업종마다 사정이 다르잖아. 제조업이나 서비스업은 어떻게 하라고.' },
      { s:'l', who:'혜수', txt:'그건 맞는 말이야. 일률적으로 적용하는 건 무리겠지. 근데 사무직부터 시범적으로 도입할 수는 있지 않을까?' },
      { s:'r', who:'재원', txt:'그렇게 되면 형평성 문제가 생길 텐데. 나는 못 쉬는데 저 사람은 쉰다, 이런 불만이 나오겠지.' },
      { s:'l', who:'혜수', txt:'결국 사회 전체의 패러다임이 바뀌어야 한다는 거잖아. 그게 쉬운 일이 아니긴 하지.' },
      { s:'r', who:'재원', txt:'맞아. 제도보다 문화가 먼저 바뀌어야 해. 상사 눈치 보면서 야근하는 문화.' },
      { s:'l', who:'혜수', txt:'그 부분은 진짜 동감이야. 제도만 만들어도 실질적으로 못 쉬는 사람들이 생기잖아.' },
      { s:'r', who:'재원', txt:'그래서 난 제도 도입보다 조직문화 변화가 선행되어야 한다고 봐.' },
      { s:'l', who:'혜수', txt:'너 말도 이해는 해. 근데 제도가 문화를 바꾸는 경우도 많잖아. 닭이 먼저냐 달걀이 먼저냐 문제 같은데.' },
      { s:'r', who:'재원', txt:'결국 둘 다 필요하다는 거지 뭐. 어쨌든 지금보다는 나아져야 한다는 데는 동의해.' },
    ],
    vocab: [
      { ko:'주 4일제', rom:'ju sail-je', en:'four-day work week' },
      { ko:'생산성', rom:'saengsanseong', en:'productivity' },
      { ko:'업종', rom:'eopjong', en:'industry type / sector' },
      { ko:'형평성', rom:'hyeongpyeongseong', en:'equity / fairness' },
      { ko:'패러다임', rom:'paereodaim', en:'paradigm' },
      { ko:'선행되다', rom:'seonhaengdoeda', en:'to precede / come first' },
    ],
    grammar: [
      { point:'~ㄹ 텐데', example:'생길 텐데', meaning:'it will probably ~ / I expect ~ (concern)' },
      { point:'~보다는 ~가 먼저다', example:'제도보다 문화가 먼저 바뀌어야', meaning:'~ should come before ~ (priority)' },
    ],
    mission: [{ task:'Argue both sides of an issue using ~는 맞는데 and ~하지 않을까' }],
  },

  {
    name: '병원 예약과 상담',
    ctx: 'Calling to book an appointment and consulting with a doctor',
    cat: 'everyday', lvl: 'a', avi: '🏥',
    topic: 'Health',
    msgs: [
      { s:'l', who:'간호사', txt:'안녕하세요, 서울내과의원입니다.' },
      { s:'r', who:'환자', txt:'안녕하세요. 진료 예약을 하고 싶어서요. 내과 맞죠?' },
      { s:'l', who:'간호사', txt:'네, 맞습니다. 어떤 증상으로 오시려고요?' },
      { s:'r', who:'환자', txt:'며칠째 소화가 잘 안 되고, 속이 더부룩하고 가끔 메스꺼워요.' },
      { s:'l', who:'간호사', txt:'언제부터 그러셨어요?' },
      { s:'r', who:'환자', txt:'한 5일 정도 됐어요. 처음엔 그냥 넘겼는데 좀 지속되네요.' },
      { s:'l', who:'간호사', txt:'가장 빠른 게 내일 오전 10시인데 괜찮으세요?' },
      { s:'r', who:'환자', txt:'네, 좋습니다. 준비할 게 있나요? 금식 같은 거요.' },
      { s:'l', who:'간호사', txt:'상황에 따라 내시경 검사가 필요할 수 있어서, 4시간 전부터 금식하고 오시는 게 좋을 것 같아요.' },
      { s:'r', who:'환자', txt:'알겠습니다. 건강보험은 적용되나요?' },
      { s:'l', who:'간호사', txt:'기본 진료는 적용되고요, 검사 종류에 따라 본인부담금이 달라질 수 있어요.' },
      { s:'r', who:'환자', txt:'이해했습니다. 내일 10시에 찾아뵙겠습니다. 감사합니다.' },
    ],
    vocab: [
      { ko:'진료', rom:'jillyo', en:'medical examination / consultation' },
      { ko:'더부룩하다', rom:'deobureukada', en:'to feel bloated / full and uncomfortable' },
      { ko:'메스껍다', rom:'meseukkeopda', en:'to feel nauseous' },
      { ko:'내시경', rom:'naesigyeong', en:'endoscopy' },
      { ko:'금식', rom:'geumsik', en:'fasting' },
      { ko:'본인부담금', rom:'bonin-budamgeum', en:'patient co-payment / out-of-pocket cost' },
    ],
    grammar: [
      { point:'~(으)ㄹ 수 있어서', example:'검사가 필요할 수 있어서', meaning:'because ~ might be needed (cautious)' },
      { point:'~에 따라', example:'검사 종류에 따라', meaning:'depending on ~' },
    ],
    mission: [{ task:'Describe physical symptoms accurately using 더부룩하다, 메스껍다 in context' }],
  },

  {
    name: '연애 고민 상담',
    ctx: 'Best friends discussing relationship worries in depth',
    cat: 'friends', lvl: 'a', avi: '💬',
    topic: 'Relationships',
    msgs: [
      { s:'l', who:'나영', txt:'나 요즘 남자친구 때문에 너무 힘들어.' },
      { s:'r', who:'지아', txt:'왜? 무슨 일이야?' },
      { s:'l', who:'나영', txt:'연락이 점점 뜸해지고 있어. 예전엔 하루에 몇 번씩 하더니 요즘은 하루에 한 번도 안 할 때가 있어.' },
      { s:'r', who:'지아', txt:'직접 물어봤어? 요즘 바쁜 거 아닐까?' },
      { s:'l', who:'나영', txt:'물어봤더니 바쁘다고 하는데, 바빠도 5분은 있잖아. 나는 예민한 건지 모르겠어.' },
      { s:'r', who:'지아', txt:'예민한 게 아니야. 상대방한테서 충분한 관심을 받고 싶은 건 당연한 거지.' },
      { s:'l', who:'나영', txt:'근데 막상 얘기를 꺼내면 내가 너무 집착하는 것처럼 보일까봐 무서워.' },
      { s:'r', who:'지아', txt:'솔직하게 표현 안 하면 상대는 절대 모를 수도 있어. 감정을 쌓아두면 나중에 더 크게 터지거든.' },
      { s:'l', who:'나영', txt:'맞는 말이긴 해. 근데 어떻게 말해야 상처 안 주고 전달할 수 있을까?' },
      { s:'r', who:'지아', txt:'비난하지 말고 내 감정 위주로 얘기해. "넌 왜 연락 안 해"가 아니라 "나는 연락이 줄어들면 불안해진다"처럼.' },
      { s:'l', who:'나영', txt:'I-message 같은 거네. 그렇게 하면 방어적이 되지 않겠다.' },
      { s:'r', who:'지아', txt:'맞아. 그리고 결과보다 대화 자체에 의미를 두는 거야. 이해받으면 그게 제일 큰 수확이야.' },
    ],
    vocab: [
      { ko:'뜸하다', rom:'deumhada', en:'infrequent / sparse (contact)' },
      { ko:'예민하다', rom:'yeminada', en:'to be sensitive / touchy' },
      { ko:'집착하다', rom:'jipchakada', en:'to be obsessive / clingy' },
      { ko:'쌓아두다', rom:'ssaaduda', en:'to bottle up / accumulate' },
      { ko:'비난하다', rom:'binanahada', en:'to criticize / blame' },
      { ko:'수확', rom:'suhwak', en:'harvest / gain / reward' },
    ],
    grammar: [
      { point:'~ㄹ까봐', example:'보일까봐 무서워', meaning:'afraid that ~ might ~ / worried that ~' },
      { point:'~(이)라고 하면', example:'"연락 안 해"가 아니라 "불안해진다"처럼', meaning:'instead of saying ~ say ~ (contrasting expressions)' },
    ],
    mission: [{ task:'Practice an I-message: express a feeling without blaming using 나는 ~ 하면 ~해' }],
  },

  {
    name: '스타트업 투자 미팅',
    ctx: 'Founder pitching to an angel investor in a formal business setting',
    cat: 'work', lvl: 'a', avi: '💼',
    topic: 'Business',
    msgs: [
      { s:'l', who:'투자자', txt:'안녕하세요. 오늘 발표 기대하고 있었습니다. 간단히 소개 부탁드려요.' },
      { s:'r', who:'창업자', txt:'안녕하세요. 저는 AI 기반 개인 맞춤형 교육 플랫폼을 개발하는 에듀에이아이의 대표 김민재입니다.' },
      { s:'l', who:'투자자', txt:'어떤 문제를 해결하려고 하시는 건가요?' },
      { s:'r', who:'창업자', txt:'현행 교육 시장은 획일적인 커리큘럼에 묶여 있어요. 학습 속도와 스타일이 다른 학생들이 같은 방식으로 배워야 한다는 게 핵심 문제입니다.' },
      { s:'l', who:'투자자', txt:'기존 에듀테크 기업들과의 차별점은 무엇인가요?' },
      { s:'r', who:'창업자', txt:'저희는 학습 데이터를 실시간으로 분석해서 다음 학습 콘텐츠를 동적으로 생성합니다. 단순한 큐레이션이 아닌 생성형 AI를 활용한 개인화예요.' },
      { s:'l', who:'투자자', txt:'현재 MAU와 리텐션 수치를 말씀해 주실 수 있나요?' },
      { s:'r', who:'창업자', txt:'현재 MAU 8천 명이고 월간 리텐션이 68%입니다. 업계 평균 대비 약 2배 수준이에요.' },
      { s:'l', who:'투자자', txt:'수익화 모델은 어떻게 되나요?' },
      { s:'r', who:'창업자', txt:'B2C 구독 모델과 함께 B2B 기관 라이선스를 병행하고 있습니다. 현재 3개 교육기관과 파일럿 계약 중이에요.' },
      { s:'l', who:'투자자', txt:'이번 라운드에서 목표하는 금액과 사용처가 궁금합니다.' },
      { s:'r', who:'창업자', txt:'30억을 목표로 하고 있고요, 60%는 엔지니어링 팀 확장, 30%는 마케팅, 10%는 운영 비용으로 계획하고 있습니다.' },
      { s:'l', who:'투자자', txt:'인상적인 수치네요. 다음 주에 심화 미팅을 잡아보죠.' },
    ],
    vocab: [
      { ko:'맞춤형', rom:'matchumhyeong', en:'customized / tailored' },
      { ko:'획일적', rom:'hoegilijeok', en:'uniform / one-size-fits-all' },
      { ko:'차별점', rom:'chabyeoljeom', en:'differentiating point / competitive edge' },
      { ko:'리텐션', rom:'ritensyeon', en:'retention (rate)' },
      { ko:'수익화', rom:'suikhwa', en:'monetization' },
      { ko:'파일럿 계약', rom:'paillo gyeyak', en:'pilot contract / trial agreement' },
    ],
    grammar: [
      { point:'~에 묶여 있다', example:'커리큘럼에 묶여 있어요', meaning:'to be tied to / constrained by ~' },
      { point:'~ 대비', example:'업계 평균 대비', meaning:'compared to ~ / relative to ~' },
    ],
    mission: [{ task:'Pitch a product idea in 3 sentences: problem → solution → metric' }],
  },

  {
    name: '철학적 인생 대화',
    ctx: 'Late-night deep conversation between two close friends about life choices',
    cat: 'friends', lvl: 'a', avi: '🌙',
    topic: 'Philosophy & Life',
    msgs: [
      { s:'l', who:'도윤', txt:'요즘 갑자기 내가 왜 이렇게 살고 있나 싶은 생각이 들어.' },
      { s:'r', who:'수아', txt:'무슨 바람이 불었어? 뭔가 계기가 있었어?' },
      { s:'l', who:'도윤', txt:'회사 선배가 갑자기 퇴사하고 세계여행 떠났거든. 부러우면서도 내가 그럴 수 있을까 싶고.' },
      { s:'r', who:'수아', txt:'그 부러움이 진짜 여행이 하고 싶은 건지, 아니면 지금 하는 일에서 벗어나고 싶은 건지 어떻게 구분해?' },
      { s:'l', who:'도윤', txt:'솔직히 잘 모르겠어. 둘 다인 것 같기도 하고. 나는 안정을 택했는데, 가끔 그 선택이 맞는 건지 의심스러울 때가 있어.' },
      { s:'r', who:'수아', txt:'나는 선택에 옳고 그름이 있다고 생각하지 않아. 선택 후에 어떻게 의미를 만들어 가느냐가 더 중요한 것 같아.' },
      { s:'l', who:'도윤', txt:'그게 말은 쉬운데 실천하기가 어렵잖아. 현재에 만족한다는 게 포기처럼 느껴질 때도 있고.' },
      { s:'r', who:'수아', txt:'만족과 포기는 달라. 만족은 현재를 받아들이면서도 성장하는 거고, 포기는 그냥 멈추는 거지.' },
      { s:'l', who:'도윤', txt:'그 경계가 흐릿하게 느껴지는 게 문제야. 나는 정말 성장하고 있는 건지, 아니면 그냥 익숙해진 건지.' },
      { s:'r', who:'수아', txt:'그 질문 자체가 성장의 증거 아닐까? 아무 생각 없이 흘러가는 사람은 그런 고민 안 하잖아.' },
      { s:'l', who:'도윤', txt:'그렇게 보면 위로가 되기도 해. 근데 나는 더 구체적인 방향이 필요한 것 같아.' },
      { s:'r', who:'수아', txt:'그럼 일단 작은 거 하나부터 해봐. 방향은 걷다 보면 보이는 거야. 한 번에 다 알 수는 없어.' },
    ],
    vocab: [
      { ko:'퇴사하다', rom:'toesahada', en:'to quit one\'s job' },
      { ko:'벗어나다', rom:'beoseonada', en:'to escape from / break free' },
      { ko:'의심스럽다', rom:'uisimseureobda', en:'to be doubtful / questionable' },
      { ko:'실천하다', rom:'silcheonhada', en:'to put into practice / act on' },
      { ko:'경계', rom:'gyeonggye', en:'boundary / line between' },
      { ko:'흘러가다', rom:'heulleogada', en:'to flow by / drift along (time/life)' },
    ],
    grammar: [
      { point:'~ㄴ/는 건지 (모르겠다)', example:'맞는 건지 의심스러울 때가 있어', meaning:'I wonder if ~ / not sure whether ~' },
      { point:'~(으)면서도', example:'받아들이면서도 성장하는', meaning:'while ~ing, also ~ (holding two states)' },
    ],
    mission: [{ task:'Reflect on a life choice using 나는 ~을 택했는데, 가끔 ~ 싶을 때가 있어' }],
  },
];

function run() {
  let ok = 0, fail = 0;
  for (const conv of CONVS) {
    const row = {
      name: conv.name,
      ctx:  conv.ctx,
      cat:  conv.cat,
      lvl:  conv.lvl,
      data: conv,
    };
    const success = insertRow(row);
    if (success) {
      console.log('✅', conv.name);
      ok++;
    } else {
      console.error('❌', conv.name);
      fail++;
    }
  }
  console.log(`\n완료: ${ok}개 성공, ${fail}개 실패`);
}

run();
