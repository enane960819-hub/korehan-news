# KoreHani 수정 리스트 (2026-10-24 전수 점검)

홈·랜딩·공통 UI / 스터디룸 / 기사·뉴스 / 회화·단어·마이페이지·게임 4개 영역 코드 점검 +
운영 DB 읽기 전용 리포트(`supabase/reports/2026-10-24_launch_audit_health.sql`) 결과를 합친 목록.
파일 경로는 모두 `korehan/` 기준. 줄 번호는 2026-10-24 시점.

표기: **P0** 고장·출시 차단 / **P1** 명확히 잘못된 동작·나쁜 UX / **P2** 다듬기 /
**삭제** 쓰레기·중복 기능 / **정리** 죽은 코드·임시 코드.

---

## 1. 사장님이 지적한 3가지 — 원인

### 1-1. 공기 정화 시스템·운영·대피소 같은 단어가 내 단어장에 들어가 있음
- **원인: "복습"하는 동작이 단어를 저장해버림.** `save_or_update_word` RPC가 "없으면 새로 넣기"라서,
  복습/퀴즈 코드가 부를 때마다 사용자가 고르지도 않은 단어가 저장됨. (RPC 정의는 migrations에 없음)
  - 스터디룸 3D 플래시카드: 왼쪽/오른쪽 스와이프마다 저장 (`js/kh-flashcards.js:310-327`). 덱은 뉴스 단어 200개 + 회화 단어 섞인 것 → **주범**
  - 회화 2단계 플래시카드: Known/Still learning 둘 다 저장 (`korehan-study-room.html:1626-1637`)
  - 듣기 퀴즈: 틀리면 **문장 전체**를 "단어"로 저장, 뜻 칸에 한국어가 들어감 (`korehan-study-room.js:11298-11308`)
  - Memory 게임: 복습 안 한 단어도 review+1/correct+1 기록 (`korehan-fun-memory.html:894`)
- 단어 자체가 이상한 이유: 주간 토픽 단어 프롬프트가 "명사 **또는 명사구**", Advanced는 "전문 용어"를 요구 (`korehan-study-room.js:1911,1920`) — 다른 프롬프트는 "단일 단어"라고 해서 서로 모순.
- **고칠 방향:** RPC를 `save_word`(사용자가 직접 저장할 때만) / `log_word_review`(업데이트만, 절대 insert 안 함)로 분리 → migrations에 정의 커밋 → 자동으로 들어간 단어 정리 SQL → 프롬프트 "단일 사전 단어"로 통일 + 저장 시 띄어쓰기 들어간 항목 차단.

### 1-2. 플래시카드에 항상 같은 단어 (사회/한국/문화/학교/뉴스/국제)
- **원인: 저건 덱이 아니라 기본값 단어 6개.** `korehan-shared.js:2489-2496` `DEF_WORDBANK = [뉴스,사회,국제,문화,한국,학교]`.
- 스터디룸 시작 시 `loadVocabPool()`을 기다리지 않고 바로 `loadFlashcards('all')` 실행 (`korehan-study-room.js:337-339`) → 그 순간 풀에는 기본값 6개뿐 → `.slice(0,6)` → **매번 이 6개**. 로딩 끝나도 다시 그리지 않음.
- 같은 화면이 Exercise 탭(`:7378-7389`)과 "3D mode"(`js/kh-flashcards.js:252-257`)로도 복사됨.
- Vocab Bank 덱도 `vocabulary_bank ... .limit(200)` 정렬·레벨·활성 필터 없이 → 매번 같은 200개 (`korehan-study-room.js:10936`). DB 확인: vocabulary_bank 4,389개 **빈도값 전부 0**, `놈`(비속어), `들 = "field, ~s,"` 같은 쓰레기 행 존재.
- **고칠 방향:** 로딩 끝난 뒤 렌더, 기본값 6개 제거, 레벨별·랜덤/순환 조회 RPC, 기본 덱을 "오늘 복습할 내 단어(SRS)"로.

### 1-3. 3D 단어 우주에서 연관 단어가 하나도 안 뜸
- **원인: 연관 단어를 데이터로 계산하지 않고, 별을 탭할 때마다 Claude를 실시간 호출** (`js/kh-universe.js:1974-2012`).
  실패하면 무조건 빈 배열 → "No related words found" (`:2010`, `:2049-2051`).
  삼켜지는 실패: 비로그인, 이메일 미인증(403), **무료 하루 50회 한도(429, 작문 피드백과 공유)**, 파싱 실패.
- **고칠 방향:** 연관 단어를 서버에서 미리 계산해 테이블에 저장(AI 0원/탭), 실패 시 실제 사유 표시. 아니면 우주 기능 자체 삭제(→ 3장).

---

## 2. 지금 고장나 있는 것 (P0)

### 운영 / 자동화 (DB 리포트로 확인)
- **P0 기사 자동 생성이 10/15 이후 0건.** `daily-article-draft` 크론은 3일간 36/36 "성공"인데 새 기사 없음 → 엣지 함수 안에서 조용히 실패 (Anthropic 크레딧/키 의심). 실패를 감지·알림하는 장치도 없음.
- **P0 스터디룸 주간/일일 콘텐츠가 10/19 이후 생성 안 됨** (`study_daily_content` 마지막 2026-10-19). `daily-content-gen` 크론은 "성공".
- **P0 가입자 개인정보 자동 삭제 크론 `kh_purge_old_signup_pii` 3일 연속 실패** (0/3).
- **P1 AI 사용량 로그의 토큰 수가 전부 0** → 비용 추적 여전히 안 됨 (`claude_api_usage` in/out 0).
- **P1 Korea Buzz 게시 기사 3개뿐** → 스터디룸 Buzz 카드/플래시카드 Buzz 탭이 거의 빈 상태.

### 기능 고장
- **P0 마이크가 사이트 전체에서 차단됨** — `_headers`의 `Permissions-Policy: microphone=()` → Speaking·발음 평가·롤플레이 음성 녹음 전부 막힘. `microphone=(self)`로 변경 (`_headers:5`).
- **P0 Speaking 점수 항상 0** — Azure 채점 실패 시 빈 문자열로 채점 (`korehan-study-room.js:12555-12559`).
- **P0 iPhone 녹음 불가 가능성** — `audio/webm`만 허용 (`:8673-8674, 12530-12531`).
- **P0 홈 PC 뉴스카드 "Study" 버튼 고장** — 존재하지 않는 `openStudyModal` 호출 (`index.html:2324`).
- **P0 데일리 미션 보너스 시 에러** — 스터디룸에만 있는 `showToast` 호출 (`js/features/daily-mission.js:284`).
- **P0 기사 조회수 저장 안 됨** → "Most Read" 고정. 권한 막힌 테이블에 직접 upsert, 만들어둔 `increment_article_view` RPC 미사용 (`korehan-shared.js:4278, 11060-11071`).
- **P0 기자 페이지 2개·포토카드 페이지에 헤더/푸터 없음** — `#dyn-header` id 불일치 (`korehan-reporters.html:43`, `korehan-reporter.html:455`, `korehan-cards.html:229`).
- **P0 이미지 없는 기사에 랜덤 picsum 스톡 사진** (`js/core/articles.js:107-118`, `korehan-shared.js:3768`).
- **P0 회화 페이지 단어 저장이 엉뚱한 구현으로 덮어써짐** — 두 번째 `toggleSave`가 정상 버전을 덮음, 게스트 저장 유실·"undefined" 저장 (`korehan-conversations.html:3193-3225`).
- **P0 비로그인 방문자에게 회화 카드 제목이 한국어만** — 영어 번역이 로그인 사용자 브라우저에서만 생성 (`korehan-conversations.html:958-988`).
- **P0 "Korean Alphabet" 카드가 알파벳이 아니라 음절 게임을 염** (`korehan-study-room.html:497-503`).
- **P0 First Journey 🎯 버튼 눌러도 안 열림** — 제가 넣은 index.html 임시 코드가 패널을 계속 지움 (`index.html:1509-1537`) → 임시 코드 삭제 필요.

### 돈·신뢰 관련 (유료 출시 차단)
- **P0 요금제 표와 실제 잠금이 불일치** — Growth Lab 등은 Premium이라 팔면서 실제로는 안 잠김, 반대로 회화학습·듣기·주간/월간 복습은 잠겨 있는데 요금표엔 없음 (`js/core/plans.js:20-50`).
- **P0 Courses(요금) 페이지가 없는 기능을 판매** — "수료증(Completion Certificate)" 구현 없음, 삭제된 Stories·자유작문/일기 포함 (`korehan-courses.html:283-540`).
- **P0 상점 "Buy with Cash"가 결제 안 됨** — pending 주문만 기록 (`shop-client.js:361-369`). 광고 없는 사이트에서 "Ad-Free" 판매 (`:96-101`).
- **P0 랜딩 "마이크로트랜잭션 없음" 문구가 거짓** — 상점에서 $59.99 냥 팩, $149.99 평생 서포터, 가챠 판매 (`landing.html:599`).
- **P0 관리자·튜터 개인 Gmail이 공개 JS에 하드코딩**, 클라이언트가 `_isAdmin` 판단 → 모든 Premium 열림 (`korehan-shared.js:2420, 1889-1891`).
- **P0 프로필이 다른 사용자 email 포함한 `user_stats`를 읽을 수 있음** (`korehan-profile.html:202-205`).
- **P0 프로필 화면에 개발자 문구** "coming with Phase 3 (user_badges public read)" (`korehan-profile.html:279,361`).

---

## 3. 삭제할 것 (쓰레기·중복)

**게이미피케이션/장식**
- 상점의 **가챠(뽑기)** 탭 — 확률형 아이템, 규제·신뢰 리스크 (`korehan-shop.html:180-210`, `gacha-client.js`)
- **마이룸**(가구 배치·음악·펫·벽지, ~2,100줄 + 1.67MB 배경) (`korehan-mypage.html:2861-4930`)
- **기자 아이돌화**: 선물하기·호감도·포토카드·"매니저로 고용" 버튼 (`korehan-reporter.html:623-663`, `korehan-cards.html` 페이지 전체)
- **Neon 테마** 토글 (CSS 오버라이드 수백 개) → 하려면 정식 다크모드로
- 홈 별빛 캔버스 애니메이션, 강제 스플래시 로더(`index.html:1035-1445`)
- 붓 터치 저장 애니메이션, PC 카드 3D 틸트 (`korehan-shared.js:11214-11427`)
- 플래시카드 파티클·별자리 결과 캔버스 (`js/kh-flashcards.js:288-298, 411-490`)
- 스터디룸 Solar/Tarot/Orb 실험 레이아웃 선택기, 버튼 물결 캔버스
- 사이드바 날씨·KST 시계·랜덤 단어 위젯
- 가짜 "BREAKING" 티커 (같은 기사가 첫 화면에 4번 반복: 티커·히어로·사이드·그리드)

**중복 기능 (하나로 합치기)**
- 단어 저장 경로 8개+, 저장 단어 목록 UI 4개(Word Book·Notes·마이페이지 모달·Learn), 플래시카드/SRS 구현 6개+ → **단어장 1개 + 복습(SRS) 1개**
- 어순 배열 드릴 6개, 한글 자모 입력기 4개, TTS 경로 7개
- 문법 진입점 4개(Grammar Path·Skill Tree·Grammar Focus·Weak Drill) → Grammar Path 하나
- 알파벳 2곳(Alphabet 카드 + 기초 과정) → 기초 과정만
- `korehan-learn.html`(Vocab Drill)이 스터디룸과 기능 중복
- 회화 연습 흐름 3개(회화 페이지 4개 드릴 / 스터디룸 4단계 / CTA)
- 뉴스 홈이 3개(index / korehan-all / korehan-news.html) → korehan-news.html 리다이렉트
- 섹션 페이지 5개가 사실상 같은 파일(world/society/culture/korea/opinion) → `korehan-section.html?s=` 하나
- Help 탭(작문 모달 패널 복붙), Word Bank 모달(호출되는 곳 없음)

**정리 대상 페이지/기능**
- **3D 단어 우주** (~2,400줄 + 3D 엔진, 학습 루프 없음, 탭마다 AI) — 삭제 또는 연관단어 사전계산 후 단어장 보너스로만
- **Playground 게임 8개** → 학습 효과 있는 2~3개(Dictation·Chosung·Sentence Order)만, 메인 메뉴에서 내리기
- 친구·방명록·차단 (출시 후로)
- 기자 프로필은 소개 + 기사 목록만
- `korehan-character.html` (빈 페이지), `korehan-opinion.html` (고아 페이지)

---

## 4. 아직 한국어로 나오는 UI

- 모든 뉴스 카드의 **섹션 칩** `사회/국제/문화/IT과학/연예` — `sectionLabel()` 거치도록 (shared.js 3052, 3079, 3091, 3397, 3485, 3538, 3774, 3797, index.html 2299·2321, reporter.html 1496)
- 목록에 없는 섹션은 레일 제목이 한국어 그대로 (`korehan-shared.js:3829-3831`), 섹션 URL도 `?s=연예`
- **댓글** 전부: `댓글`, `댓글을 남기려면 로그인하세요`, `등록`, 입력 placeholder (`korehan-shared.js:4192-4199, 11818`)
- 문장 분석 로딩 `분석 중` (`korehan-shared.js:5565, 6014`)
- 로그인 실패 배너 전체 + "닫기" (`korehan-shared.js:3271-3273`)
- 기자 직함 `기자/특파원/…에디터` (`js/core/reporters.js:24-31`)
- 호버 툴팁 문법 용어 `피동 · 관형형 과거`, `과거 정중체` (`korehan-hover-tooltips.js:166-217`)
- 발음 버튼 `발음 듣기`, 날짜 `2026.4.22.` 형식
- **화폐 이름** `냥` / nyang / 🐾 / kimchi 혼용 → 영어 하나로 (또는 경제 시스템 자체 정리)
- 상점: `냥으로 구매`, 빈 인벤토리, 툴팁 (`shop-client.js:311-343`)
- 홈 Korean Basics 카드 문구 (`index.html:1464-1470`)
- 저장 단어 뜻 앞의 `[슬랭]/[표현]/[교정]` 접두어가 단어장·복습·우주 카드에 그대로 노출 → `category` 컬럼 분리
- 슬랭 태그·경고 `일상/주의/MZ세대/…`, 오답 해설이 한국어 `desc` (`korehan-study-room.js:4987-5030, 5285`)
- Growth Lab `Plan 생성 실패` (`korehan-learning-overview.html:4577`)
- 페이지 `<html lang="ko">`, `og:locale ko_KR`, 한국어 meta 설명 — 홈·기사·스터디룸·목록·온보딩·요금·기자 등 거의 전 페이지

---

## 5. 영역별 문제 (P1/P2)

### 홈 / 랜딩 / 온보딩
- P1 배너 과다: 첫 화면 위에 배너/알약 최대 6개 + 하단 고정 요소 5개(쿠키·가입유도·미션·🎯·하단바) 겹침 → "다음 할 일" 슬롯 1개로
- P1 Beginner Guide를 한 화면에 4번 홍보
- P1 주간/월간 복습 배너가 엉뚱한 화면으로 이동, 무료 사용자에게도 노출 (`index.html:1232,1239`)
- P1 데이터 없는 신규 사용자에게 가짜 약점 문법 "-아/어서 vs -고" 표시 (`korehan-shared.js:11439`)
- P1 같은 페이지에 스트릭 숫자 2개(서로 다른 출처), 신규에게 "0 day streak"
- P1 회화 레일이 DB 실패 시 가짜 회화 12개(링크 깨짐) 표시
- P1 헤더 레벨 필터가 뉴스 외엔 안 먹음, 결과 없으면 빈 화면
- P1 SEO: `/` 접속 비로그인은 JS로 landing으로 리다이렉트, 랜딩↔홈 루프
- P1 랜딩: "I already have an account"가 로그인 아닌 홈으로, FAQ의 "Hangul Builder" 없는 기능, "Browse FAST TRACK"이 게임 페이지로, ₩0 / $8.99 통화 혼용
- P1 온보딩: 아이콘 라이브러리 미로드로 빈 아이콘, 나이 확인 실패 시 브라우저 alert
- P1 상단 메뉴 9개 (Shop·Playground가 학습과 동급) → Read / Conversations / Study / Review / Progress
- P1 "Courses" 메뉴가 실제로는 요금 페이지 → "Pricing"
- P1 푸터에 환불 정책·쿠키 설정 링크 없음, 뉴스레터 "메일러 준비 중" 문구
- P1 데일리 미션 목표 비현실적(매일 기사3+단어20+퀴즈3+빈칸), 완료 처리 경로 2개, "오늘 XP" 숫자 2개
- P1 First Journey 단계가 "상점에서 구매", "마이룸에 배치" → 학습 단계로 (또는 삭제)
- P2 홈이 안 쓰는 스크립트 ~25개 로드, 685KB shared.js / 콘솔 로그 / 오타 "Norebang"

### 스터디룸
- P1 활동 ~30개가 덧붙이기로 쌓임 → **Weekly Lesson(5단계) / Review / Grammar Path / Article Study / Conversations / Fast Track**로 축소 권장
- P1 Express Practice 잠금 문구("1개 완료 시")와 실제 조건(5개 중 4개) 불일치
- P1 "daily"라고 써놓고 실제는 주간 콘텐츠, 작문 제출 주 1회뿐(유료치고 빈약)
- P1 활동 ID가 이름과 다름(Phrase Munch=grammar, Speaking=picture, Dictation=sentence)
- P1 받아쓰기: 승인된 DB 문장을 "오래됐다"며 버리고 사용자마다 AI 재생성, 브라우저 음성만 사용(기기에 따라 무음)
- P1 듣기 퀴즈: 두 번째 세션부터 Next가 퀴즈를 닫음, 결과 저장 안 됨, "AI 생성" 허위 문구, 가짜 파형
- P1 문장 빌더: 긴 문장이 폰에서 넘침, 품사 색이 틀림(먹고/가서를 부사로 표시)
- P1 슬랭: 가장 좋은 콘텐츠(채팅 예시)가 렌더 안 됨, Quiz 탭이 Premium 잠금 우회
- P1 주간 복습 일요일만/월간 1~3일만/저장 1회 → 언제든 가능하게, "OPEN" 배지 하드코딩
- P1 복습 퀴즈 "typed" 문제를 객관식으로 바꾸고 로마자 힌트로 정답 노출
- P1 Article Study: 콘텐츠 준비 안 된 기사까지 500개 나열 → 준비된 것만·레벨별
- P1 플래시카드에 발음 버튼 없음, 앞면에 로마자 → 읽기 테스트 무력화
- P1 모바일(≤640px)에서 Review Due·Grammar Path·Weekly Quest·Listening이 숨겨짐 → SRS에 접근 불가
- P1 Phone Call "데모 모드"는 무음 타이머
- P1 Forest(고급) 잠가놓고 고급 전용 코드는 잔뜩 배포
- P2 Topic Yum Yum / Phrase Munch 같은 이름이 직관적이지 않음, 레벨 이름 체계 2개(Seed… / Starter…)

### 기사 / 뉴스
- P1 Analyze 토글이 캐시를 못 써서 매번 AI 호출, 구형 Safari에서 정규식 에러 → 문장 분석 패널과 중복이므로 삭제
- P1 Review 흐름이 중간 실패 시 막힘(Skip 없음), "4가지"라 써놓고 5단계
- P1 번역 버튼이 한국어 문단을 영어로 **교체** → 문단 아래 병기로
- P1 기사 열고 0.3초 만에 "읽음" 처리, 트래커 3중 기록
- P1 다음 기사 스와이프가 레벨·섹션 무시하고 랜덤
- P1 문장 탭 시 단어 툴팁과 분석 패널이 동시에 열림
- P1 기사 목록 조회에 `status='published'` 필터 없음 → 초안이 검색·리더에 노출
- P1 기사 1개 열 때 요청 20개+ (단어 사전 수천 행 매번 다운로드, 캐시 없음)
- P1 hover 단어 시스템 2개 중복
- P1 "Most Read"가 삭제/초안 기사 노출, 댓글 로드 실패를 "첫 댓글을 남겨보세요"로 표시
- P1 리더에서 PC 포함 헤더/푸터 전부 숨김, 뒤로가기는 항상 홈
- P1 Reddit 영상 소스 → 유료 서비스 저작권 리스크 검토
- P1 기자 바이라인 링크가 로딩 후 목록 페이지로 바뀜
- P2 카드 스타일 7종 혼재 → 1~2개 컴포넌트로, 섹션 페이지 기사 4개 중복 표시, 모바일 행 이미지 깨짐
- P2 사이트맵에 korehan-all과 기사 누락, 빈 섹션 페이지는 포함
- P2 스토리 레일·태블릿 이상 홈 뉴스 레일이 아직 구형 카드(크롬 스크롤 버그 구조) → 스토리 페이지 삭제, 홈은 전 화면 `khn-*`로

### 회화 / 단어 / 마이페이지 / Growth Lab / 게임
- P1 회화 퀴즈 완료가 "story"로 기록되어 실제 기록 안 됨 (`korehan-conversations.html:3356-3380`)
- P1 회화 단어 "undefined" 표시, 단어 없으면 "Loading…" 무한
- P1 회화 페이지에 관리자 CRUD(수정·삭제·업로드)가 학습자 페이지에 포함
- P1 회화 목록이 미리보기 3줄 위해 모든 회화 전체 JSON 다운로드
- P1 Learn 페이지 탭 선택 오류, 오늘의 표현이 표현 전체를 렌더, 듣기 퀴즈 항상 같은 뉴스 단어 8개 + 매번 AI
- P1 대부분의 SRS UI가 복습 일정을 실제로 갱신 안 함(카운터만 증가) → `review_word(grade)` RPC 하나로
- P1 Growth Lab 저장이 다른 conflict 키 사용 → 실패해도 "Saved" 표시
- P1 Growth Lab 히스토리에서 회화 열면 엉뚱한 회화(`?open=` 인덱스), 비로그인 데모가 `Math.random()` 숫자
- P1 Growth Lab 문법 퀴즈 정답 2개 가능한 문제 (`:2553,2555`)
- P1 마이페이지에 학습 진도 없음(코드는 있는데 호출 안 함), XP 계산 방식 2개 충돌, 레벨 사다리 3종(Bronze… / Seedling… / Seed…)
- P1 게임 Dictation·Sentence Order 정답 띄어쓰기 오류(`학생 입니다`, `공부 해요`, `죄송 합니다` …)
- P2 Learn 한글 예시 "으른(adult)" → 어른, 오타 "the meaning the meaning"
- P2 게임들이 초보용인데 뉴스 단어 200~400개 무작위 사용

### Stories 잔재 (삭제했는데 아직 연결됨)
- P0 PC 상단 메뉴 Stories 드롭다운, 모바일 사이드바 Stories("New" 배지)
- P1 푸터, 온보딩 kpop 목표 CTA, 랜딩 "Read stories →", Beginner Guide, Growth Lab(배너·필터·통계), 요금 페이지, 사이트맵
- 정리: `korehan-stories.html`(171KB), `loadHomeStories`, 스터디룸 `_storyVocab`/`loadStoriesForReading`, article-cache의 stories_data 조회, 관리자 CMS 스토리 생성기, DB 테이블 4개(백업 후 삭제), `_redirects`에 301 추가

---

## 6. 보안 · 비용

**보안**
- P0 관리자/튜터 이메일 공개 JS 하드코딩 + 클라이언트 `_isAdmin` 판단
- P0 `user_stats`(email 포함) 타 사용자 조회 가능
- P1 로그인 사용자 누구나 공유 AI 캐시 덮어쓰기 가능: `article_cache`, `grammar_examples_cache`, 주간 레슨(`save_daily_content_if_missing`) → 쓰기는 엣지 함수로만
- P1 냥(코인) 잔액을 클라이언트가 직접 수정: First Journey 보상, 작문 리뷰 티켓, 방 아이템 구매, 기자 선물 폴백 → 서버 RPC로
- P1 Premium 잠금이 클라이언트 `canAccess()`에만 의존 → AI 무거운 기능은 서버에서도 확인
- 정리 `?authdebug=1`이 이메일·세션 표시, 24MB PDF·내부 문서(md, ts)가 웹 루트로 공개, robots.txt가 관리자 URL 광고

**AI 비용 (사용자 행동마다 호출, DB 공유 캐시 없음)**
- 우주 연관단어(탭마다), 토픽 단어(sessionStorage), 학습자 브라우저가 주간 레슨 생성, 흔한 실수 패널(사용자별·일별), Key Expressions 상황 퀴즈(사용자별·일별), 받아쓰기 생성(저장 안 함), Word Snap 번역(캐시 없음)
- 기사 영어 제목·회화 영어 제목을 방문자 브라우저에서 번역(localStorage만) → 생성 시점에 DB 저장
- Analyze 토글, 문법 탭·T/F·빈칸 첫 방문 시 실시간 생성 → 관리자 bake에 포함
- 무료 하루 50회 한도를 장식 기능(우주)이 소진 → 작문 피드백까지 막힘

---

## 7. 코드 정리 (임시·죽은 코드)

- **제가 진단용으로 넣은 것**: `index.html` `?khdebug`·`?khx` 스크립트, TEMP WORKAROUND 블록, `scroll-test.html` → 전부 삭제
- `onboarding-preview-compact.html`, `fun/` 디렉터리, 홈 `loadHomeStories`·필터 알약 코드·`renderHomePage` 죽은 분기
- 스터디룸 미사용 모달·함수: Starter 모달, Sentence Writing, Word Bank 모달, Nuance Quiz, renderHangulCard, renderSlang, `_kePrefetchSituations` 몸체, 호환용 숨김 요소
- 기사: 죽은 AI 함수 ~450줄(`_khTriggerFullArticleAnalyze`, `_bgPregenArticleCache` 등), `checkArticleSummary`, 미사용 목록 함수, `article_cache` kv/wide 이중 스키마 추측 코드
- 회화: 도달 불가 퀴즈 ~400줄, 기자 데이터 섞임, 빈 `KH_CHARACTERS`
- 학습 허브 CSS `.nr-rail-scroll` 잔재, 하드코딩 단어 사전(`VOCAB`, `DEF_SENTENCES`), localStorage 키 ~104개 버전 잔재
- CLAUDE.md 갱신: `assign_daily_vocab()` 미사용, `save_or_update_word` 정의가 migrations에 없음

---

## 8. 사장님이 직접 해야 하는 것

- [ ] **기사·일일 콘텐츠 자동화가 멈춘 원인 확인** — Anthropic 콘솔 크레딧/결제 상태, `daily-article-draft` 엣지 함수 로그 (Supabase → Edge Functions → Logs)
- [ ] Anthropic·Pexels·Azure 키 교체 (TODO.md 2026-10-12 항목, 아직 미완료로 기록됨)
- [ ] Stripe 실결제 전환 (TODO.md) — 단, 2장 "돈·신뢰" P0부터 정리한 뒤에
- [ ] 결정 필요: 냥 경제·상점·가챠·마이룸을 유지할지 없앨지 / 3D 우주 유지 여부 / Playground 남길 게임 / 고급(Forest) 레벨 출시 여부
- 무의미해진 TODO: 스토리 표지 생성, Storybook go-live (Stories 삭제됨)

---

## 제안 진행 순서

1. **멈춘 것 살리기** — 자동화(기사·일일 콘텐츠·PII 삭제 크론) 원인, 마이크 차단, Speaking 0점, 조회수, 깨진 버튼·헤더, 임시 진단 코드 삭제
2. **단어 데이터 바로잡기** — 저장 RPC 분리 + 자동 저장된 쓰레기 정리 + 플래시카드 6개 고정 + 단어 생성 프롬프트 + `category` 컬럼 (사장님 지적 1·2번)
3. **돈·신뢰 정리** — 요금표=실제 잠금 일치, 없는 기능 판매 문구 제거, 상점 현금결제/가챠/Ad-Free 처리, 보안 P0
4. **한국어 UI 마무리** — 섹션 칩·댓글·화폐·태그·meta
5. **덜어내기** — 3장 삭제 목록 (결정 받은 것부터)
6. **합치기(갈아엎기)** — 단어장/SRS 하나, 스터디룸 활동 축소, 문법 진입점 하나, 카드 컴포넌트 통일, 메뉴·홈 배너 정리
7. **AI 비용 서버화** — 사용자 브라우저에서 생성·번역하던 것들을 생성 시점 DB 저장으로
