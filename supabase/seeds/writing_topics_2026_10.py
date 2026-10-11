# New Study Room daily topics (2026-10) + duplicate cleanup.
# Generates supabase/migrations/20261011_writing_topics_refresh.sql.
# Written against the live list (db report 2026-10-11): no topic repeats
# an existing one in meaning; adult learners (no children's-classroom
# topics). Format per line: topic_ko | topic_en | category
STARTER = """
자주 타는 교통수단 | The transport I use most | daily
요즘 사고 싶은 것 | Something I want to buy these days | shopping
내 휴대폰 | My phone | tech
지갑 안에 있는 것 | What's in my wallet | daily
오늘 산 것 | What I bought today | shopping
좋아하는 가게 | My favorite shop | shopping
자주 가는 곳 | A place I often go | daily
우리 동네 카페 | A café in my neighborhood | daily
좋아하는 공원 | My favorite park | nature
지금 몇 시예요? | What time is it now? | daily
오늘은 무슨 요일이에요? | What day is it today? | daily
이번 달 계획 | My plan for this month | daily
내일 할 일 | What I'll do tomorrow | daily
어제 먹은 저녁 | What I ate for dinner yesterday | food
좋아하는 한국 음식 하나 | One Korean food I like | food
자주 마시는 차 | Tea I often drink | food
물을 많이 마셔요? | Do you drink a lot of water? | health
좋아하는 라면 | My favorite ramen | food
아침에 먹는 빵 | Bread I eat in the morning | food
매운 음식 | Spicy food | food
단 음식 | Sweet food | food
요리해요? | Do you cook? | food
배달 음식 | Delivery food | food
편의점 음식 | Convenience store food | food
우유를 좋아해요? | Do you like milk? | food
내가 자주 입는 옷 | Clothes I often wear | daily
좋아하는 신발 | My favorite shoes | daily
모자를 써요? | Do you wear hats? | daily
안경을 써요? | Do you wear glasses? | daily
내 머리 모양 | My hairstyle | daily
좋아하는 옷 색깔 | My favorite clothing color | daily
겨울 옷 | Winter clothes | daily
여름 옷 | Summer clothes | daily
비 오는 날 | A rainy day | nature
눈 오는 날 | A snowy day | nature
바람 부는 날 | A windy day | nature
봄 | Spring | nature
여름 | Summer | nature
가을 | Autumn | nature
겨울 | Winter | nature
바다와 산 | The sea and mountains | nature
좋아하는 나무 | A tree I like | nature
하늘 색깔 | The color of the sky | nature
내 손 | My hands | health
머리가 아파요 | I have a headache | health
감기 | A cold | health
병원 | Hospital | health
약국 | Pharmacy | health
잠을 잘 자요? | Do you sleep well? | health
피곤해요? | Are you tired? | feelings
기뻐요 | I'm happy | feelings
슬퍼요 | I'm sad | feelings
심심해요 | I'm bored | feelings
바빠요 | I'm busy | feelings
좋아하는 영화 | My favorite movie | hobby
좋아하는 가수 | My favorite singer | hobby
산책해요? | Do you take walks? | hobby
수영할 수 있어요? | Can you swim? | hobby
자전거 타기 | Riding a bike | hobby
노래방 | Karaoke | hobby
주말 아침 | A weekend morning | daily
일요일 저녁 | Sunday evening | daily
퇴근 후에 하는 일 | What I do after work | work
수업 후에 하는 일 | What I do after class | school
내 회사 | My company | work
내 학교 | My school | school
좋아하는 과목 | My favorite subject | school
시험 | Exams | school
숙제 | Homework | school
한국어 수업 | Korean class | school
한국어 책 | My Korean book | school
한글 | Hangul | culture
좋아하는 한국 노래 | My favorite Korean song | culture
한국 드라마 | Korean dramas | culture
한국에 가고 싶어요? | Do you want to go to Korea? | travel
서울 | Seoul | travel
여행 가방 | My travel bag | travel
비행기 | Airplanes | travel
호텔 | Hotels | travel
기차 | Trains | travel
버스 | Buses | travel
지하철 | The subway | travel
택시 | Taxis | travel
길 묻기 | Asking for directions | travel
가게에서 주문하기 | Ordering at a shop | shopping
카페에서 주문하기 | Ordering at a café | shopping
얼마예요? | How much is it? | shopping
카드로 계산해요 | I'll pay by card | shopping
시장 | The market | shopping
마트 | The supermarket | shopping
선물 | Gifts | daily
좋아하는 날 | My favorite day | daily
휴가 | Vacation | travel
여름휴가 | Summer vacation | travel
명절 | Holidays | culture
크리스마스 | Christmas | culture
새해 | New Year | culture
내 나라 음식 | Food from my country | culture
내 나라 날씨 | The weather in my country | culture
내 나라 명절 | A holiday in my country | culture
우리 도시 | My city | daily
우리 집 근처 | Near my house | daily
아파트 | Apartments | daily
내 방 창문 | My room's window | daily
청소 | Cleaning | daily
빨래 | Laundry | daily
설거지 | Washing dishes | daily
장보기 | Grocery shopping | shopping
아침 샤워 | A morning shower | daily
늦게 자요? | Do you go to bed late? | daily
좋아하는 시간 | My favorite time of day | daily
시계 | Clocks | daily
카메라 | Cameras | tech
컴퓨터 | Computers | tech
인터넷 | The internet | tech
좋아하는 앱 | My favorite app | tech
문자 메시지 | Text messages | tech
전화 | Phone calls | tech
친구에게 연락하기 | Contacting a friend | daily
친구와 만나는 곳 | Where I meet friends | daily
친구 생일 | A friend's birthday | daily
같이 사는 사람 | People I live with | family
우리 가족 음식 | My family's food | family
가족 사진 | A family photo | family
고양이와 강아지 | Cats and dogs | nature
좋아하는 새 | A bird I like | nature
동물원 | The zoo | nature
꽃집 | The flower shop | shopping
빵집 | The bakery | food
식당 메뉴 | A restaurant menu | food
점심 메뉴 | Lunch menu | food
저녁 메뉴 | Dinner menu | food
과일 가게 | The fruit shop | shopping
나는 어떤 사람? | What kind of person am I? | feelings
오늘 한 좋은 일 | Something good I did today | feelings
오늘 웃은 일 | Something that made me laugh today | feelings
고마운 사람 | Someone I'm thankful to | feelings
보고 싶은 사람 | Someone I miss | feelings
""".strip()

BEGINNER = """
최근에 산 물건 중 제일 만족한 것 | The best thing I bought recently | shopping
처음 혼자 요리한 날 | The first time I cooked alone | food
내 나라의 생일 문화 | Birthday culture in my country | culture
요즘 자주 듣는 노래 | A song I listen to a lot these days | hobby
버스와 지하철 중 뭘 더 자주 타요? | Bus or subway — which do you take more? | daily
출근길이나 등굣길에 하는 일 | What I do on my commute | daily
집안일 중에 제일 싫은 것 | The house chore I hate most | daily
가장 오래 쓴 물건 | The thing I've used the longest | daily
요즘 자주 쓰는 한국어 표현 | A Korean expression I use a lot | culture
한국어로 처음 말해 본 날 | The first day I spoke Korean | culture
한국 사람에게 들은 칭찬 | A compliment I got from a Korean | culture
기억에 남는 선물 | A memorable gift | daily
친구에게 받고 싶은 선물 | A gift I'd like from a friend | daily
돈을 모으는 방법 | How I save money | daily
한 달에 제일 많이 쓰는 돈 | What I spend the most on each month | daily
쇼핑할 때 중요한 것 | What matters when I shop | shopping
온라인으로 자주 사는 것 | What I often buy online | shopping
옷을 살 때 어디에서 사요? | Where do you buy clothes? | shopping
좋아하는 브랜드가 있어요? | Do you have a favorite brand? | shopping
최근에 잃어버린 물건 | Something I lost recently | daily
비 오는 날 하고 싶은 일 | What I want to do on a rainy day | nature
제일 더웠던 날 | The hottest day I remember | nature
여름에 꼭 하는 일 | Something I always do in summer | nature
겨울에 먹고 싶은 음식 | Food I want to eat in winter | food
가을에 가고 싶은 곳 | A place I want to visit in autumn | travel
봄이 되면 하고 싶은 일 | What I want to do when spring comes | nature
작년에 제일 잘한 일 | The best thing I did last year | feelings
요즘 배우고 싶은 것 | Something I want to learn these days | hobby
배우고 싶은 악기 | An instrument I want to learn | hobby
어렸을 때 무서웠던 것 | Something I was afraid of as a child | feelings
요즘 걱정되는 것 | Something I'm worried about these days | feelings
기분이 좋아지는 음식 | Food that cheers me up | food
아침을 꼭 먹어야 할까요? | Should we always eat breakfast? | health
건강을 위해 하는 일 | What I do for my health | health
걸어서 가는 곳 | Places I walk to | daily
집에서 제일 편한 곳 | The most comfortable place at home | daily
살고 싶은 집 | The house I'd like to live in | daily
이웃과 인사해요? | Do you greet your neighbors? | daily
우리 동네 자랑 | Showing off my neighborhood | daily
동네에 새로 생긴 가게 | A new shop in my neighborhood | daily
자주 시켜 먹는 음식 | Food I often order | food
외식할 때 자주 가는 곳 | Where I usually eat out | food
처음 먹어 본 한국 음식 | The first Korean food I tried | food
한국 음식 중 어려운 음식 | A Korean food that's hard for me | food
만들 수 있는 요리 | A dish I can make | food
요리할 때 실수한 일 | A cooking mistake | food
친구와 자주 하는 일 | What I often do with friends | hobby
친구를 사귀는 방법 | How I make friends | daily
오랜만에 만난 친구 | A friend I met after a long time | daily
친구와 싸운 적이 있어요? | Have you ever argued with a friend? | feelings
가족과 여행한 기억 | A trip with my family | family
가족에게 하고 싶은 말 | Something I want to say to my family | family
가족 중에 나와 닮은 사람 | Who in my family I resemble | family
명절에 가족과 하는 일 | What I do with family on holidays | family
어렸을 때 살던 집 | The house I lived in as a child | family
어렸을 때 좋아한 음식 | Food I liked as a child | food
학생 때 기억 | A memory from school days | school
좋아했던 선생님 | A teacher I liked | school
시험 전날 하는 일 | What I do the day before an exam | school
공부가 잘 되는 장소 | Where I study best | school
한국어 숙제 | Korean homework | school
한국어 단어를 외우는 방법 | How I memorize Korean words | school
한국어 듣기 공부 | Studying Korean listening | school
틀리기 쉬운 한국어 | Korean that's easy to get wrong | school
한국어로 하고 싶은 일 | What I want to do in Korean | culture
첫 출근 날 | My first day at work | work
일하면서 힘든 점 | What's hard about my work | work
점심시간에 동료와 하는 일 | What I do with coworkers at lunch | work
되고 싶은 직업과 이유 | The job I want and why | work
아르바이트하고 싶은 곳 | Where I'd like a part-time job | work
쉬는 날 하는 일 | What I do on my day off | daily
혼자 있는 시간 | My alone time | feelings
요즘 빠진 것 | Something I'm into these days | hobby
요즘 보는 드라마 | A drama I'm watching now | hobby
영화관과 집 중 어디서 영화를 봐요? | Cinema or home — where do you watch movies? | hobby
좋아하는 게임 | A game I like | hobby
사진을 찍으면 어디에 올려요? | Where do you post your photos? | tech
휴대폰으로 제일 많이 하는 것 | What I do most on my phone | tech
없으면 불편한 물건 | Something I can't do without | daily
여행 갈 때 꼭 챙기는 것 | What I always pack for a trip | travel
여행 중에 생긴 문제 | A problem I had while traveling | travel
기차 여행 | A train trip | travel
캠핑해 본 적 있어요? | Have you ever gone camping? | travel
바다 여행과 산 여행 | Beach trips vs mountain trips | travel
가 보고 싶은 한국 도시 | A Korean city I want to visit | travel
한국에서 해 보고 싶은 일 | Something I want to try in Korea | travel
한국의 공원 | Parks in Korea | culture
한국의 길거리 음식 | Korean street food | food
한국의 카페 메뉴 | Korean café menus | food
한국 사람들의 인사 | How Koreans greet | culture
한국어 존댓말 | Korean polite speech | culture
한국 노래로 한국어 공부하기 | Learning Korean with K-songs | culture
내 나라와 한국의 다른 점 | Differences between my country and Korea | culture
내 나라의 유명한 음식 | A famous food from my country | culture
내 나라의 관광지 | A tourist spot in my country | culture
내 나라 사람들의 습관 | Habits of people in my country | culture
내가 사는 도시의 날씨 | The weather in my city | nature
요즘 날씨와 내 기분 | The weather lately and my mood | feelings
행복했던 하루 | A happy day | feelings
실수해서 창피했던 일 | An embarrassing mistake | feelings
울었던 영화 | A movie that made me cry | hobby
많이 웃었던 일 | Something that made me laugh a lot | feelings
고마웠던 일 | Something I was grateful for | feelings
칭찬받은 일 | A time I was praised | feelings
나의 장점 | My strengths | feelings
고치고 싶은 습관 | A habit I want to change | daily
좋은 습관 하나 | One good habit | daily
일찍 자는 방법 | How to fall asleep early | health
물건을 정리하는 방법 | How I organize my things | daily
가방 속 필수품 | Essentials in my bag | daily
비싸도 사는 것 | Something I buy even if it's expensive | shopping
중고로 산 물건 | Something I bought second-hand | shopping
선물 포장 | Gift wrapping | daily
편지를 써 본 적 있어요? | Have you ever written a letter? | daily
손으로 만든 물건 | Something handmade | hobby
식물을 키워요? | Do you grow plants? | nature
좋아하는 꽃과 이유 | My favorite flower and why | nature
동물원과 수족관 | Zoos and aquariums | nature
반려동물을 키우면 좋은 점 | Good things about having a pet | nature
동물을 좋아하는 이유 | Why I like animals | nature
도서관에 자주 가요? | Do you often go to the library? | school
요즘 읽는 책 | A book I'm reading now | hobby
그림이나 사진 중 뭐가 좋아요? | Paintings or photos — which do you like? | hobby
박물관에 가 본 적 있어요? | Have you been to a museum? | culture
콘서트에 가 본 적 있어요? | Have you been to a concert? | hobby
축제에 가 본 적 있어요? | Have you been to a festival? | culture
야구나 축구 경기를 봐요? | Do you watch baseball or soccer? | hobby
같이 운동하고 싶은 사람 | Someone I want to exercise with | health
자전거로 가고 싶은 곳 | Where I'd like to go by bike | hobby
걷기 좋은 길 | A nice road for walking | nature
주말에 일찍 일어나면 하는 일 | What I do when I wake early on weekends | daily
내 하루 중 제일 바쁜 시간 | The busiest time of my day | daily
퇴근 후 저녁 시간 | My evenings after work | daily
잠이 안 올 때 하는 일 | What I do when I can't sleep | health
감기에 좋은 음식 | Food that's good for a cold | health
병원에 가기 싫을 때 | When I don't want to go to the hospital | health
이번 달 목표 | My goal for this month | daily
내년에 하고 싶은 일 | Something I want to do next year | daily
""".strip()

INTERMEDIATE = """
중고 거래에서 생긴 일 | Something that happened in a second-hand deal | shopping
알고리즘 추천은 편리할까, 위험할까? | Algorithm recommendations: convenient or risky? | tech
배달 앱 없이 일주일 살기 | Living a week without delivery apps | daily
혼자 사는 것의 장점과 단점 | Pros and cons of living alone | daily
도시에서 살기 vs 시골에서 살기 | City life vs country life | society
나만의 시간 관리 방법 | My way of managing time | daily
마감이 있을 때 일하는 방식 | How I work under a deadline | work
처음 해외에 갔을 때 느낀 점 | What I felt on my first trip abroad | travel
여행지에서 만난 사람 | Someone I met while traveling | travel
계획 없이 떠난 여행 | A trip without a plan | travel
관광지와 현지인 동네 중 어디가 좋아요? | Tourist spots or local neighborhoods? | travel
여행 사진과 여행 기억 | Travel photos vs travel memories | travel
외국 생활에서 가장 힘든 점 | The hardest part of living abroad | culture
한국에 처음 왔을 때의 문화 충격 | Culture shock when first coming to Korea | culture
한국어를 배우면서 달라진 생각 | How learning Korean changed my thinking | culture
번역기 사용, 도움이 될까? | Do translation apps help learning? | tech
AI로 외국어를 공부하는 것 | Studying languages with AI | tech
스마트폰 사용 시간을 줄이는 방법 | How to reduce screen time | tech
온라인 수업과 대면 수업 비교 | Online vs in-person classes | school
시험 점수가 실력을 보여 줄까? | Do test scores show real ability? | school
좋은 선생님의 조건 | What makes a good teacher | school
학창 시절에 배운 가장 중요한 것 | The most important thing I learned at school | school
첫 월급으로 하고 싶은 일 | What to do with my first paycheck | work
이직을 고민할 때 생각하는 것 | What I consider when changing jobs | work
회의를 효율적으로 하는 방법 | How to run efficient meetings | work
좋은 동료란 어떤 사람일까? | What makes a good coworker? | work
면접에서 받은 어려운 질문 | A hard interview question I got | work
부탁을 거절하는 방법 | How to say no to a request | society
약속에 늦은 친구를 대하는 방법 | How to deal with a friend who's late | society
오래된 친구와 새로운 친구 | Old friends vs new friends | society
친구와 돈 문제 | Money issues between friends | society
선물을 고를 때 기준 | How I choose gifts | daily
나에게 주는 선물 | A gift to myself | feelings
요즘 나를 행복하게 하는 것 | What makes me happy lately | feelings
나를 화나게 하는 행동 | Behavior that makes me angry | feelings
화를 참아야 할 때와 말해야 할 때 | When to hold anger and when to speak up | feelings
후회되는 선택 | A choice I regret | feelings
용기를 냈던 경험 | A time I was brave | feelings
처음 도전해 본 일 | Something I tried for the first time | feelings
내가 바뀐 계기 | What changed me | feelings
나를 위로하는 방법 | How I comfort myself | feelings
걱정을 줄이는 방법 | How to worry less | health
번아웃을 겪은 적이 있나요? | Have you experienced burnout? | health
수면 습관과 컨디션 | Sleep habits and how I feel | health
걷기 운동의 효과 | The benefits of walking | health
다이어트 유행에 대한 생각 | Thoughts on diet trends | health
건강 앱을 사용해 본 경험 | My experience with health apps | health
요리를 잘하는 방법 | How to get better at cooking | food
제철 음식의 장점 | The benefits of seasonal food | food
음식물 쓰레기를 줄이는 방법 | How to reduce food waste | food
한국 음식과 내 나라 음식 비교 | Korean food vs food from my country | food
맛집 줄 서기, 할 만할까? | Is waiting in line for a famous restaurant worth it? | food
편의점이 바꾼 생활 | How convenience stores changed life | daily
현금 없는 사회 | A cashless society | society
신용카드와 체크카드 | Credit cards vs debit cards | daily
충동구매를 막는 방법 | How to avoid impulse buying | shopping
유행하는 옷을 사는 이유 | Why people buy trendy clothes | shopping
명품을 사는 사람들의 마음 | Why people buy luxury goods | society
광고가 내 선택에 미치는 영향 | How ads affect my choices | society
리뷰를 믿어도 될까? | Can we trust online reviews? | tech
가짜 뉴스를 구별하는 방법 | How to spot fake news | society
뉴스를 보는 습관 | My news habits | society
요즘 관심 있는 사회 문제 | A social issue I care about | society
나이 많은 사람과 대화하는 법 | How to talk with older people | society
호칭 때문에 어색했던 경험 | An awkward moment over titles/forms of address | culture
한국의 존댓말 문화 | Korean honorific culture | culture
빨리빨리 문화의 장단점 | Pros and cons of 'hurry-hurry' culture | culture
한국 사람들이 자주 하는 말 | Things Koreans often say | culture
한국 드라마 속 한국 문화 | Korean culture in K-dramas | culture
한국어 신조어 | New Korean slang words | culture
줄임말 사용에 대한 생각 | Thoughts on abbreviations | culture
내 나라에 소개하고 싶은 한국 문화 | Korean culture I'd introduce to my country | culture
한국에 소개하고 싶은 내 나라 문화 | My culture I'd introduce to Korea | culture
명절의 의미가 달라지고 있다 | The changing meaning of holidays | culture
결혼식 문화 비교 | Comparing wedding cultures | culture
나이를 묻는 문화 | Cultures that ask your age | culture
팁 문화에 대한 생각 | Thoughts on tipping culture | culture
대중교통 에티켓 | Public transport etiquette | society
층간 소음 문제 | Noise between apartment floors | society
반려동물과 공공장소 | Pets in public places | society
길고양이 문제 | Stray cats | society
자원 재활용이 잘 되고 있을까? | Is recycling really working? | nature
텀블러 사용 습관 | Using a reusable tumbler | nature
날씨가 기분에 미치는 영향 | How weather affects mood | nature
계절이 바뀔 때 생기는 변화 | Changes when the seasons change | nature
자연에서 보내는 시간의 가치 | The value of time in nature | nature
캠핑 문화가 인기 있는 이유 | Why camping is popular | hobby
혼자 하는 취미와 같이 하는 취미 | Solo hobbies vs group hobbies | hobby
취미에 쓰는 돈 | Money spent on hobbies | hobby
요즘 유행하는 취미 | Trendy hobbies these days | hobby
운동을 꾸준히 하는 비결 | The secret to exercising regularly | health
스포츠 경기를 직접 보는 것과 TV로 보는 것 | Watching sports live vs on TV | hobby
좋아하는 스포츠 선수 | A sports player I admire | hobby
게임 중독일까, 취미일까? | Gaming: addiction or hobby? | hobby
웹툰이 드라마가 되는 이유 | Why webtoons become dramas | culture
영화 리메이크에 대한 생각 | Thoughts on movie remakes | culture
음악 취향이 바뀐 계기 | What changed my music taste | hobby
콘서트 티켓 경쟁 | Competing for concert tickets | culture
유튜브로 배우는 것들 | Things I learn from YouTube | tech
SNS에 올리지 않는 것 | What I don't post on social media | tech
온라인 친구와 오프라인 친구 | Online friends vs offline friends | society
메신저 답장 속도에 대한 생각 | Thoughts on reply speed in messengers | society
이모티콘 사용 습관 | My emoji habits | tech
개인정보를 지키는 방법 | How I protect my personal information | tech
사진 찍기 좋은 장소를 찾는 법 | How to find photogenic spots | hobby
아날로그 물건이 다시 인기 있는 이유 | Why analog items are popular again | culture
필름 카메라의 매력 | The charm of film cameras | hobby
손글씨의 가치 | The value of handwriting | culture
종이책과 전자책 | Paper books vs e-books | hobby
도서관의 역할 | The role of libraries | society
박물관이 재미있으려면 | What makes museums fun | culture
공연을 보러 가는 이유 | Why I go to performances | culture
여행 유튜버처럼 여행하기 | Traveling like a travel YouTuber | travel
여행 경비를 아끼는 방법 | How to save on travel costs | travel
한 도시에서 한 달 살기 | Living in one city for a month | travel
기억에 남는 길거리 풍경 | A street scene I remember | travel
고향이 그리울 때 | When I miss home | feelings
이사할 때 힘든 점 | What's hard about moving | daily
집을 고를 때 중요한 것 | What matters when choosing a home | daily
룸메이트와 사는 법 | Living with a roommate | daily
집안일 나누기 | Sharing house chores | family
부모님 세대와 나의 차이 | Differences between my parents' generation and me | family
가족과 대화하는 시간 | Talking time with family | family
형제자매가 있는 것의 장단점 | Pros and cons of having siblings | family
가족 여행 계획 세우기 | Planning a family trip | family
나이 들면 하고 싶은 일 | What I want to do when I'm older | feelings
10년 전의 나에게 | To myself 10 years ago | feelings
나의 롤모델 | My role model | feelings
존경하는 역사 인물 | A historical figure I respect | culture
기억에 남는 책 한 권 | A book I remember | hobby
인생 영화 | The movie of my life | hobby
나를 성장시킨 실수 | A mistake that helped me grow | feelings
작은 습관의 힘 | The power of small habits | daily
아침 시간을 잘 쓰는 법 | Making good use of mornings | daily
주말을 알차게 보내는 법 | Spending weekends well | daily
돈과 시간 중 무엇이 더 소중할까? | Money or time — which is more precious? | society
돈을 잘 쓰는 법 | Spending money wisely | daily
저축과 투자에 대한 생각 | Thoughts on saving and investing | society
용돈을 받은 기억 | Memories of getting pocket money | family
기부에 대한 생각 | Thoughts on donating | society
친절이 돌아온 경험 | When kindness came back to me | feelings
""".strip()

def parse(block):
    out = []
    for line in block.splitlines():
        ko, en, cat = [x.strip() for x in line.split('|')]
        out.append((ko, en, cat))
    return out

# Deactivate: near-duplicates in meaning, children's-classroom topics,
# awkward wording, brand-specific topics. Exact duplicates are handled
# generically in SQL (keep the earliest).
DEACTIVATE = {
 'Starter': ['내가 좋아하는 색깔','우리 가족 소개','우리 가족 인원수','내 친구 소개','형제자매 소개','할머니 할아버지',
   '집에서 좋아하는 장소','오늘 먹은 점심','잠자리에 드는 시간','토요일에 하는 일','나의 하루','더운 날 대 추운날','추운 날',
   '맑은 날 대 비오는 날','내 필통','내 지우개','좋아하는 스티커','좋아하는 색연필','좋아하는 풍선','좋아하는 블록 놀이',
   '내 인형','내 치아','우리 반 친구들','좋아하는 선생님','내 교실','좋아하는 장난감','비누로 손 씻기','내 달력',
   '우리 집 화장실','우리 집 현관','좋아하는 놀이','사촌 형제'],
 'Beginner': ['좋아하는 계절','반려동물 키우기','운동하는 습관','좋아하는 한국 음식 베스트 3','좋아하는 한국 배우',
   '한국 드라마 추천','나의 아침 루틴','여행 가고 싶은 곳','좋아하는 커피 종류','오늘 하루 어땠나요?','당신 나라의 생일 문화',
   '좋아하는 한국 아이스크림','좋아하는 BTS 노래','좋아하는 한국 아이돌','감기에 걸렸을 때',
   # exact duplicates of Starter topics — keep them at Starter
   '사진 찍는 것을 좋아해요?','게임을 해요?','디저트를 좋아해요?','반려동물이 있어요?','형제자매가 있어요?','한국어 공부 방법'],
 'Intermediate': ['온라인 쇼핑 vs 오프라인 쇼핑','스트레스를 어떻게 관리해요? 구체적인 방법을 설명해 보세요.','스트레스 관리 방법',
   '외국어를 배우는 가장 좋은 방법','한국의 군입대 문화','한국의 무신사 같은 패션 플랫폼','SNS가 현대인의 생활에 어떤 영향을 준다고 생각해요?'],
}

def q(s): return "'" + s.replace("'", "''") + "'"

if __name__ == '__main__':
    levels = {'Starter': parse(STARTER), 'Beginner': parse(BEGINNER), 'Intermediate': parse(INTERMEDIATE)}
    norm = lambda s: ''.join(ch for ch in s.lower() if ch.isalnum())
    for lv, items in levels.items():
        seen = set()
        for ko, en, cat in items:
            assert norm(ko) not in seen, (lv, ko); seen.add(norm(ko))
    print('-- auto-apply')
    print('-- Generated by supabase/seeds/writing_topics_2026_10.py. Study Room topic refresh:')
    print('-- (1) deactivate exact duplicates (keep earliest), near-duplicates, children-only and')
    print('-- awkward topics (rows kept, active=false); (2) add new topics per level, skipping any')
    print('-- that already exist at that level. sort_order puts new topics after the kept ones.')
    print('-- The rotation epoch is reset to launch (2026-10-12) in code so every topic is used once')
    print('-- before any repeats. Idempotent.')
    print()
    print("""with ranked as (
  select ctid, row_number() over (
           partition by level, regexp_replace(lower(topic_ko), '[^가-힣a-z0-9]', '', 'g')
           order by created_at, sort_order) as rn
    from public.writing_topics where active)
update public.writing_topics w set active = false from ranked r where w.ctid = r.ctid and r.rn > 1;
""")
    for lv, pats in DEACTIVATE.items():
        print(f"update public.writing_topics set active = false where level = {q(lv)} and topic_ko in ({', '.join(q(p) for p in pats)});")
    print()
    for lv, items in levels.items():
        rows = ",\n".join(f"  ({q(ko)}, {q(en)}, {q(cat)}, {i+1})" for i, (ko, en, cat) in enumerate(items))
        print(f"""insert into public.writing_topics (level, topic_ko, topic_en, category, active, sort_order)
select {q(lv)}, v.ko, v.en, v.cat, true, coalesce((select max(sort_order) from public.writing_topics where level = {q(lv)}), 0) + v.n
from (values
{rows}
) as v(ko, en, cat, n)
where not exists (
  select 1 from public.writing_topics w where w.level = {q(lv)}
     and regexp_replace(lower(w.topic_ko), '[^가-힣a-z0-9]', '', 'g') = regexp_replace(lower(v.ko), '[^가-힣a-z0-9]', '', 'g'));
""")
    import sys
    print('-- new topics: ' + ', '.join(f'{lv}={len(v)}' for lv, v in levels.items()), file=sys.stderr)
