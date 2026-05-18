# Study Room 감사 리포트 (2026-05-18)

스코프: `korehan/korehan-study-room.html` (3,733줄) + `korehan/korehan-study-room.js` (18,440줄)
관련 페이지: `korehan-conversations.html`, `index.html`

심각도 기준: 🔴 즉시 수정 / 🟠 사용자 영향 큼 / 🟡 UX 혼란 / 🟢 코드 정리

---

## 🔴 CRITICAL — 코드가 거짓말함 / 죽은 코드

### 1. `submitWriting()` 함수 — 절반이 죽은 코드 (line 8739~8858)

```javascript
async function submitWriting() {
  // ...정상 로직 (draft 저장, 토스트, 애니메이션)...
  _playSubmitEnvelopeAnimation(function() { returnToActivities(closeWritingModal); });
  return;  // ← 이 줄 아래로 60줄이 절대 실행 안 됨

  // 이하 전부 dead code:
  var sb = getSupa();
  // user_submissions INSERT
  // user_topic_history UPDATE
  triggerAIFeedback(submissionId, text, requiredVocab, requiredGrammar);  // ← requiredGrammar 미정의!
  // awardXP, user_daily_progress.upsert, ...
}
```

**문제:**
- `return` 다음 줄부터 끝까지 영영 실행 안 됨
- 더 심각: dead 영역에서 **`requiredGrammar`** 변수 참조 — 함수 스코프에 정의 안 됨. 만약 누가 `return`을 지우면 즉시 `ReferenceError`로 터짐
- 읽는 사람이 "이 코드가 도는구나" 하고 분석하면 시간 낭비

**수정:** dead 영역 통째 삭제. 이미 새 flow(`submitAllWritingsToday`)에서 처리하니까.

---

### 2. `triggerAIFeedback()` — 호출자 없음, 죽은 함수 (line 8862, ~100줄)

```javascript
async function triggerAIFeedback(submissionId, text, vocab, grammar) {
  // ... Claude 호출, 정교한 rubric, register awareness 프롬프트 등 ...
}
```

호출되는 곳: 위 dead 영역 line 8827 단 한 곳 — **즉, 실제로는 절대 안 불림**.

`callClaude({ feature: 'writing_feedback', model: 'claude-sonnet-4-...', max_tokens: 2000 })` 가 들어 있는데 실제로 못 도니까 작성한 정교한 프롬프트(rubric, register, anti-redundancy 규칙)도 전부 사장됨.

현재 실제 동작: `_triggerPackageFeedback()` (line 8601)이 daily_package 단위로 통합 피드백 — `feature: 'daily_package_feedback'`, max_tokens 2,200.

**수정:** `triggerAIFeedback` 삭제. 또는 `_triggerPackageFeedback`이 부족한 게 있으면 이쪽 좋은 프롬프트를 그쪽에 이식.

---

### 3. `triggerArticleAIFeedback()` — 정의만 있고 호출 0회 (line 8957)

같은 패턴. 한국어 기사 reading + writing에 대한 첨삭 함수인데 어디서도 부르지 않음.

**수정:** 삭제 또는 Article Study 흐름에 다시 연결.

---

### 4. 🎤 Speaking 제출 — "AI 피드백 대기 중"이 거짓말 (line 7776~7805)

```javascript
async function submitSpeaking() {
  // ...
  await sb.from('user_submissions').insert({
    content_type: 'speaking',
    // ...
    speaking_scores: _speakScores || null,
    // ...
  });
  showToast('Recording submitted! Waiting for AI feedback.');  // ← 거짓말
  // ↑↑↑ 어디서도 AI 피드백을 trigger 안 함
}
```

녹음은 저장되지만 **AI 피드백 호출이 0회**. 토스트만 사용자 속이는 거.

비교: 글쓰기는 `_triggerPackageFeedback()`이 따로 도는 흐름이 있는데, speaking은 그 흐름에 포함 안 됨 (`content_type='speaking'`이 daily_package에 안 들어감).

**수정 2가지 옵션:**
- (a) 토스트 문구 변경: "Recording submitted!"만 — 피드백 약속 빼기
- (b) `submitAllWritingsToday`가 `content_type='speaking'`도 함께 수집해서 피드백 같이 받게

---

### 5. 🪣 Speaking 오디오가 **`avatars` 버킷**에 업로드됨 (line 7782)

```javascript
var fileName = 'speaking/' + supaUser.id + '/' + kstDateKey() + '_' + Date.now() + '.webm';
var { error: upErr } = await sb.storage.from('avatars').upload(fileName, _speakBlob, { ... });
```

`avatars` 버킷은 의미상 프로필 이미지용. 음성 파일이 거기 들어가면:
- RLS 정책 다를 가능성 (private vs public)
- 스토리지 quota 잘못 잡힘
- 백업/정리 로직이 잘못 적용

**수정:** `speaking-recordings` 같은 전용 버킷 만들고 RLS 설정. 마이그레이션 1줄.

---

### 6. 🤫 `checkPictureDescription()` — Silent catch로 AI 실패 숨김 (line 11106~11162)

```javascript
var feedback = {
  grammar:'문장 종결 표현과 조사(은/는, 이/가)를 한 번 더 확인해 보세요.',  // 하드코딩
  vocab:'장소·행동·감정 단어를 1개씩 더 넣으면 더 풍부해져요.',
  clarity:'누가 무엇을 하는지 순서대로 쓰면 더 명확해집니다.'
};
try {
  // callClaude... parse... overwrite feedback fields
} catch(e) {}  // ← 빈 catch
```

Claude API 실패 시:
- 콘솔에 에러 안 찍힘
- 사용자에겐 매번 **같은 하드코딩 피드백** 표시
- 사용자는 "AI 피드백 받은 줄 알았는데 모두에게 똑같은 조언"으로 인지할 수 있음

**수정:** `catch(e) { console.warn('picture description AI failed:', e); kh_log_error(...); }` + 토스트로 알림 + 폴백 응답에 "AI 일시적 오류, 일반 가이드" 같은 표시.

---

## 🟠 HIGH — 사용자 영향 크지만 즉시 차단은 아님

### 7. 🎙️ 모달 닫을 때 마이크 안 꺼짐 (line 7303~7315)

```javascript
function closeWritingModal() {
  document.getElementById('wmodal').classList.add('hidden');
  document.body.style.overflow = '';
  // mobile tab reset...
  // ↓↓↓ 빠진 것들 ↓↓↓
  // _speakRecorder.stop() 안 함
  // _speakRecognition.stop() 안 함
  // stream.getTracks().stop() 안 함
  // _speakBlob URL.revokeObjectURL 안 함
}
```

사용자가 녹음 중 모달 X 누르면:
- 브라우저 탭에 빨간 녹음 표시등 계속 켜짐 (👤 privacy 우려)
- 메모리 누수 (Blob + ObjectURL)
- 다음 번 모달 열 때 stale state

**수정:** `closeWritingModal`에 `_speakRecorder?.state === 'recording' && _speakRecorder.stop()` + recognition 정지 + URL revoke 5줄 추가.

---

### 8. 📱 Conversations 모달 스크롤 안 됨 (iOS) — 너가 이미 신고한 거

`korehan-conversations.html`:

```css
.detail-overlay {
  position:fixed; inset:0; ...;
  display:flex; align-items:flex-start;
  padding:20px 16px;
  overflow-y:auto;
  /* ← -webkit-overflow-scrolling: touch 없음 */
}
.detail-panel {
  ...;
  overflow:hidden;  /* ← 패널 내부 스크롤 불가 */
}
```

**문제:**
- `.detail-overlay` flex 컨테이너 + `align-items:flex-start` + `overflow-y:auto` 조합은 iOS Safari에서 모멘텀 스크롤 깨짐
- `.detail-panel { overflow:hidden }`이라 패널 안에서도 못 스크롤
- 결과: 콘텐츠가 viewport보다 길면 손가락 드래그가 먹히지 않는 영역 발생

**수정 (CSS 한 줄씩):**
- `.detail-overlay`에 `-webkit-overflow-scrolling: touch;` 추가
- `.detail-panel`을 `overflow:hidden auto; max-height: calc(100vh - 40px)`로 변경
- (필요시) `.detail-overlay`의 `align-items` 제거하거나 `padding-bottom` 추가해서 마지막 카드 잘림 방지

---

### 9. 🎚️ Express Practice 진입 게이트 너무 헐거움 (line 2439~2447)

```javascript
function canEnterWritingRoom() {
  var hasDoneStep = !!(_studyDone.topic || _studyDone.grammar || _studyDone.picture || _studyDone.sentence || _studyDone.expressions);
  if (hasDoneStep) return true;
  khAlert('Finish one step first', ...);
}
```

**문제:** 5단계 중 **1개만** 끝내면 Express Practice 입장 가능.
- 의도: Express Practice는 5단계 학습의 culmination
- 현실: Topic Yum Yum 1개 끝내면 = Express Practice 들어가서 또 글쓰기. Topic Yum Yum IS Express Practice (같은 작문 모달임)

원형 의존: Express Practice 들어가려면 Express Practice 끝내면 됨? 😅

**수정 옵션:**
- (a) 게이트 기준을 "5개 중 3개" 또는 "5개 중 4개"로 올림
- (b) 'topic' 키를 게이트 조건에서 제외 (Express Practice ≠ Topic Yum Yum이라는 결정 필요)

먼저 PM 결정 필요 — Express Practice가 진짜로 4-step 학습의 '결과물'이라면 (b)에 맞게 게이트 조정.

---

### 10. 🏷️ "Topic Yum Yum" vs "Express Practice" 명명 충돌

같은 기능을 다섯 군데서 다른 이름으로 부름:

| 위치 | 라벨 |
|------|------|
| `korehan-study-room.html:181` | `Topic Yum Yum` (탭) |
| `korehan-study-room.html:1090` | `Topic Yum Yum` (학습 선택 노드) |
| `korehan-study-room.js:602` | `Express Practice` (체크리스트) |
| `korehan-study-room.js:2444` | `Topic Yum Yum` (에러 메시지) |
| `korehan-study-room.js:8257` | `Topic Yum Yum` (label map) |

**문제:** 사용자가 어디 누르는지 헷갈림. "Topic Yum Yum → Express Practice 들어가" — 두 개가 같은 거인 줄 모름.

**수정:** PM 결정 → 한 이름으로 통일. (개인적 의견: "Express Practice"가 더 학습자 친화적 — Topic Yum Yum은 귀엽긴 한데 의미 불분명)

---

### 11. ⏳ 메인페이지 6초 로딩 — 26개 script 동기 로드 (`index.html`)

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/core/security.js?v=20260502a"></script>
<script src="js/core/storage.js?v=20260502a"></script>
... (총 26개) ...
```

- 전부 `defer`/`async` 없음 → 순차 다운로드 + 파싱
- 폰 4G에서 라운드트립 50~200ms × 26 = **1.3~5.2초** 통째로 블로킹
- 거기에 Supabase fetch + articles 렌더 1~2초 + auth check 0.5~1초 = **합쳐서 6초**

**수정 우선순위:**
1. 의존성 없는 스크립트에 `defer` 추가 (icons, analytics, video-player 등)
2. 의존성 그래프 그려서 안전한 순서 보존 (security → storage → ... → articles 같은 순서가 있음)
3. 장기: hashed-filename 번들링 (CLAUDE.md P0 follow-up에 이미 적혀있음)

**예상 효과:** 30~60% 단축 → 3~4초. 그러나 script 순서 의존성이 있으니까 **PR로 step-by-step 테스트하면서** 적용 권장.

---

### 12. 🌀 로딩 화면 사라짐 (체감)

코드는 정상 (`index.html:880` `#kh-loader` 멀쩡함). 하지만 **너무 빨리 dismiss**:

```javascript
// _autoStep interval 0.3 ~ (99-current)*0.04
// 그리고 _ldr(100)이 8군데에서 호출
```

`_khLoaderSet(100)` 호출 지점이 코드 안에 8군데. localStorage 캐시 히트 시 → 0.3초 안에 100% → dismiss.

**가설:** 캐시 히트 시 너무 일찍 dismiss됨. 사용자는 로딩 화면이 "없어진" 줄로 인식.

**수정:**
- 최소 표시 시간 도입: `if (Date.now() - startTime < 1200) setTimeout(dismiss, 1200 - elapsed)`
- 또는 `_ldr(100)` 호출 정리해서 진짜 "모든 데이터 로드 완료"일 때 1번만 호출

---

### 13. 🔍 All News 검색 — `#dyn-search-bar` ID 중복 (`korehan-all.html:21, 28`)

```html
<div id="dyn-search-bar"></div>   <!-- line 21 -->
...
<div id="dyn-search-bar"></div>   <!-- line 28 — 같은 ID 두 번 -->
```

**문제:**
- HTML 표준 위반 (ID는 페이지에서 유일해야 함)
- `document.getElementById('dyn-search-bar')`는 **첫 번째** 노드만 반환
- 두 번째 div는 영원히 빈 상태로 남거나, 코드에 따라 잘못된 노드에 마운트

이게 "검색 새로고침" 증상의 원인일 가능성. 검색 form이 두 번 마운트되면 첫 클릭은 정상, 두 번째 클릭은 form submit 처리가 안 돼서 페이지 리로드.

**수정:** 한 군데로 통일. 둘 중 무엇이 맞는지 PR 히스토리로 확인.

검색 자체의 속도 문제는 별도 — Supabase 매번 fetch하는지, 클라이언트 필터링이 효율적인지 코드 확인 필요 (이번 감사에선 깊이 안 봄).

---

## 🟡 MEDIUM — UX 혼란 / 일관성 문제

### 14. Express Practice 모달 - 레벨별 분기 사일런트 (line 2406~2437)

```javascript
function openWritingModal() {
  // ...
  if (_currentLevel === 'Starter' || _currentLevel === 'Beginner') {
    openBeginnerModal();    // 다른 모달 열림
    return;
  }
  if (_currentLevel === 'Intermediate') {
    openIntermediateModal();  // 또 다른 모달
    return;
  }
  // Advanced만 wmodal 열림
  document.getElementById('wmodal').classList.remove('hidden');
  // ...
}
```

같은 버튼이 레벨에 따라 3가지 다른 모달을 열어. 의도는 OK (난이도별 UI), 하지만:
- 코드 가독성 ↓
- 버그 수정할 때 3군데 다 봐야 함 (예: 모달 닫기 정리 로직 누락이면 3군데에 다 추가)
- 사용자 도움말이 어렵 — 어떤 화면이 보일지 모름

**수정 (장기):** 모달 컴포넌트 통합 + 레벨별 콘텐츠 슬롯. 단기엔 그대로 두는 게 더 안전.

---

### 15. 🎲 Phrase Munch — 점수 보존 분기 약함 (line 3563)

```javascript
_pm.scores[_pm.idx] = (choice === correct) ? 1 : 0;
```

- 사용자가 같은 라운드를 다시 풀면 첫 답이 그대로 score에 박힘
- "back" 버튼이 있는지 / 같은 idx 두 번 답하는 게 가능한지 확인 필요
- `logQuizResult('phrase_munch', ...)` 호출은 최종 단계에서만 — 중간 이탈 시 통계 안 남음

**수정 권장:**
- 동일 idx 응답 시 점수 변경 차단 또는 명시적 retry 카운터
- 중도 이탈 시 부분 점수라도 `logQuizResult`로 기록

---

### 16. 🎯 Slang Quiz 점수 표시 — 색상 임계값 매직 넘버 (line 4830)

```javascript
'background:'+(q.score >= 4 ? '#a78bfa' : q.score >= 2 ? '#22c55e' : '#f87171')
```

`q.questions.length`가 4~5개 라운드라면 임계값 (4, 2) 합리적인데, 만약 questions 수가 동적이라면 (예: 6개로 바뀌면) 임계값이 의미 잃음.

**수정:** `score / questions.length` 비율 기반으로 (`>= 0.8` `>= 0.5` 등).

---

### 17. 🧹 `var` 일관성 (1.8만 줄에 `let`/`const` 8개)

CLAUDE.md 명시: "Prefer var for module-level state (legacy pattern)". 일관성 ✅.

하지만 8개의 const/let이 어디 있는지 확인 안 했는데, **혼재가 의도된 건지** PM 확인 권장. 일부 새 코드 작성자가 `let`을 써서 들어왔을 수도.

**액션:** 별 위험 아님. 만약 통일하고 싶으면 codemod로 일괄 처리 가능.

---

## 🟢 LOW — 코드 정리

### 18. 빈 catch 블록 다수

`korehan-study-room.js`에 `catch(e) {}` 패턴이 곳곳에. localStorage 접근 / JSON parse 등에선 정당화될 수 있지만 (이미 fallback 처리), Claude API 호출 같은 중요 지점에 빈 catch는 #6처럼 위험.

**액션:** 빈 catch 위치 전수 검토. JSON parse / localStorage는 OK, 네트워크 / API 호출은 최소한 `console.warn`.

---

### 19. 동일 함수 중복 정의 가능성

- `openWritingModal` (line 2406)
- `openWritingModalForLearning` (line 7171)
- `openWritingModalWithMode` (line 10481)

세 개의 비슷한 진입 함수. 각자 다른 컨텍스트 (레벨별 / 학습 흐름별)에서 부르지만 내부 중복 코드 가능성 큼.

**액션:** diff 떠서 공통 부분 추출.

---

### 20. 학습 진행도 동기화 (`syncStudyProgress`) — 에러 swallowing

```javascript
async function syncStudyProgress(stage) {
  // ...
  try { await sb.from('user_daily_progress').upsert(patch, ...); } catch(e) {}
}
```

DB 동기화 실패 시 사용자는 알 수 없음. localStorage에는 저장됐지만 DB엔 누락 → 다른 기기에서 진행도 없음.

**수정:** 실패 시 retry 큐 (이미 어디 있나 확인 필요) 또는 사용자에게 sync 실패 표시.

---

## 📋 권장 처리 순서 (영향 / 위험 / 시간 종합)

| 순위 | 항목 | 시간 | 위험 |
|-----|------|------|------|
| 1 | 🔴 #4 Speaking "AI 피드백" 거짓 토스트 | 5분 | 없음 (문구만 변경) |
| 2 | 🔴 #6 Picture description silent catch | 10분 | 없음 (로깅만 추가) |
| 3 | 🟠 #7 모달 닫을 때 마이크 정지 | 15분 | 낮음 |
| 4 | 🟠 #8 Conv 모달 스크롤 CSS | 10분 | 낮음 |
| 5 | 🟠 #13 `#dyn-search-bar` ID 중복 | 15분 + 테스트 | 중간 (검색 회귀) |
| 6 | 🟡 #10 "Topic Yum Yum"/"Express Practice" 통일 | 20분 + PM 결정 | 없음 |
| 7 | 🟡 #9 Express Practice 게이트 강화 | PM 결정 우선 | - |
| 8 | 🟢 #1~#3 죽은 코드 삭제 | 30분 | 낮음 (그냥 삭제) |
| 9 | 🔴 #5 Speaking 버킷 분리 | 1시간 + 마이그레이션 | 중간 |
| 10 | 🟠 #11 메인페이지 defer 추가 | 1~2시간 + 회귀 테스트 | 높음 (script 순서) |
| 11 | 🟠 #12 로더 최소 표시 시간 | 20분 | 낮음 |

---

## 🤖 사용자 영향 정리 (학습자 관점)

**현재 학습자가 알아채는 문제:**
- "녹음 제출했는데 AI 피드백이 안 와요" → #4
- "Picture description AI 피드백이 항상 똑같은 말이에요" → #6
- "Express Practice 들어갈 수 있는 조건이 이상해요" → #9
- "Conversations 모달이 안 움직여요" (iOS) → #8
- "검색하면 페이지가 새로고침돼요" → #13
- "메인페이지 너무 느려요" → #11

**학습자가 모르지만 일어나는 일:**
- 모달 닫고 나서 마이크가 계속 켜져 있음 → #7
- AI API 실패 통계가 사일런트하게 누락 → #6, #18
- DB 진행도 동기화 실패 시 모르게 데이터 손실 → #20
- 음성 파일이 'avatars' 버킷에 섞여 있음 → #5

---

## 📦 이번 감사에서 안 본 영역 (다음 세션)

- Word Order 활동 (line ~504-590) — 정답 판정 로직
- Slang Quiz 전체 — 분기와 점수 계산
- Phrase Munch의 sentence-rebuild 단계
- Dictation 4단계 + phoneme/connected 모드
- Article Study 흐름 (별도 모달)
- Conversation Study 흐름 (별도 모달)
- Daily Mission / Streak 시스템 통합
- 모바일 UI mode (solar / tarot / orb) — `_lsGetMobileMode()` 분기들
- Pronunciation Azure SDK 통합 (`_speakAnalyzeAzure`)
- Coach Coin Stripe 흐름

이것들도 보길 원하면 다음 세션에서 ㄱㄱ.
