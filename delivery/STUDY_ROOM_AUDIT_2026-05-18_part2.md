# Study Room 감사 리포트 — Part 2 (2026-05-18)

추가 영역 감사 (Part 1의 follow-up):
- Word Order Activity (`renderWordOrderActivity` ~line 504)
- Slang Quiz (`startSlangQuiz` ~line 4830)
- Article Study (`openArticleStudy` ~line 15365)

심각도: 🔴 즉시 / 🟠 사용자 영향 / 🟡 UX 혼란 / 🟢 코드 정리

---

## 🅰️ Word Order Activity

### A1. 🟠 정답 판정 너무 빡빡 — 한국어 다중 어순 못 받음

```javascript
var isCorrect = ans.join(' ') === correct.join(' ');
```

한국어는 SOV가 기본이지만 토픽 마커(은/는)로 어순 자유로움:
- 정답: "나는 학교에 갔어요"
- 학습자: "학교에 나는 갔어요" — 문법적으로 OK, 토픽 강조 다름
- 결과: ❌ 오답 처리

중급 이상 학습자가 알고 있는 어순 유연성을 점수로 깎음. 

**수정 방안:**
- 다중 정답 배열 받기 (`correct_orders: [["나는","학교에","갔어요"], ["학교에","나는","갔어요"]]`)
- 또는 의미적 동등성 체크 (어려움)
- 또는 "Acceptable" 톨러런스 처리

### A2. 🟡 첫 단어 자동 배치 (line 524-531)

```javascript
// Pre-select the first word of the intended order — anchors the start so
// alternative valid orderings don't leave the user guessing.
if (_wordOrderState.pool.length && _wordOrderState.correct.length) {
  var firstWord = _wordOrderState.correct[0];
  ...
}
```

A1의 부작용. 다중 어순 허용 안 하니까 어쩔 수 없이 첫 단어 anchor — 학습자가 첫 단어 선택 챌린지 잃음.

A1 해결되면 이것도 제거 가능.

### A3. 🟠 logQuizResult 호출 X — Learning Hub 통계 누락

```javascript
function checkWordOrder() {
  // ...
  if (isCorrect) {
    res.innerHTML = '<div ...>Correct!</div>';
    markStageDone('picture');
    // ❌ logQuizResult 없음
```

Phrase Munch는 끝날 때 `logQuizResult('phrase_munch', ...)` 부르는데 Word Order는 안 부름. → 사용자 정답률 / 약점 분석 데이터 누락.

**수정:** `logQuizResult('word_order', { score: isCorrect ? 1 : 0, max_score: 1 })` 추가.

### A4. 🟡 활동명/스테이지 키 불일치

Word Order 활동인데 `markStageDone('picture')`을 부름. 활동 메타 키는 'picture'지만 사용자 입장에선 "Picture Description"으로 보이지 진짜 "그림 묘사" 아님. (Picture Description 모달 안에서 Word Order가 마지막 단계라 그런 듯 — 의도된 것 같지만 헷갈림)

**액션:** 코드 코멘트로 의도 설명. 또는 'picture' 키를 'picture_word_order'로 분리.

### A5. 🟢 fallback 없음

```javascript
if (item && item.word_order_words && item.word_order_words.length) {
```

`word_order_words`가 비어있으면 활동이 그냥 안 뜸. 학습자는 "어 왜 안 보이지?" 상태. 

**액션:** Empty state 메시지 "Today's word-order practice isn't ready yet — try another activity." 추가.

---

## 🅱️ Slang Quiz

### B1. 🟡 오답 보기 dedup이 `ko`로만 — 같은 영문 중복 가능

```javascript
var wrong = _KOREAN_SLANGS.filter(function(x){ return x.ko !== s.ko; })
  .sort(function(){ return Math.random()-0.5; })
  .slice(0,3)
  .map(function(x){ return x.en; });
```

같은 영어 의미("It's so cool" 같은 거)를 여러 슬랭이 가지면, 4개 보기 중 2개가 "It's so cool"일 수 있음 → 정답이 두 개라서 학습자 헷갈림.

**수정:**
```javascript
var wrong = _KOREAN_SLANGS
  .filter(x => x.ko !== s.ko && x.en !== s.en)  // <-- en 도 다른 것만
  .sort(...)
  .slice(0,3)
  .map(x => x.en);
```

### B2. 🟡 작은 풀 방어 없음

```javascript
var pool = _KOREAN_SLANGS.slice().sort(random).slice(0, 5);
```

`_KOREAN_SLANGS`가 5개 미만이면 slice(0,5)는 가능한 것만 반환. 그 후 wrong filter도 슬랭 적으면 3개 못 채움. UI에 옵션 < 4개로 깨질 가능성.

**수정:** 시작 전 `_KOREAN_SLANGS.length >= 4` 체크 → 부족하면 "Loading more slangs..." 메시지.

### B3. 🟠 logQuizResult 호출 X — 슬랭 정답률 추적 안 됨

`renderSlangQuiz` 종료 시점에 `q.score`만 보여주고 끝. Learning Hub로 안 흘러감.

**수정:**
```javascript
if (q.current >= q.questions.length) {
  if (typeof logQuizResult === 'function') {
    logQuizResult('slang_quiz', { score: q.score, max_score: q.questions.length, accuracy_pct: Math.round(_pct * 100) });
  }
  // ... existing render
}
```

### B4. 🟡 오답 시 설명 부재

```javascript
fb.innerHTML = '<div ...>' + (correct ? '정답!' : '오답!') + '</div>'
  + '<div ...>' + item.slang.ko + ' = ' + item.slang.en + '</div>'
```

오답에도 그냥 정답 보여주고 끝. `item.slang.desc` 필드 있는데도 안 씀.

**수정:** 오답 시 `desc` 표시해서 학습 기회 제공:
```javascript
fb.innerHTML = '... 오답!' + ko + ' = ' + en
  + (item.slang.desc ? '<div style="margin-top:6px;opacity:.7">' + item.slang.desc + '</div>' : '');
```

---

## 🅲 Article Study

### C1. 🟠 closeArticleStudy() 정리 안 함

```javascript
function closeArticleStudy() {
  var m = document.getElementById('as-modal');
  if (m) m.classList.add('hidden');
  document.body.style.overflow = '';
}
```

Writing modal과 같은 패턴 (이번 PR에서 wmodal은 고쳤음). Article Study는 마이크 안 쓰지만:
- TTS speech (있다면) — `window.speechSynthesis.cancel()` 안 함
- _asQState 같은 활동 상태 그대로 — 다음 열 때 stale
- 진행 중 활동 abort 처리 없음

**수정:** TTS cancel + 상태 reset 추가.

### C2. 🟡 Quiz 설명 너무 빈약

```javascript
html += '<div class="su-explain">...'
  + '<div class="su-explain-title">Answer</div>'
  + '<div class="su-explain-text"><b>' + (q.options[q.correct]||'') + '</b></div>'
```

오답 시 "Answer: <정답 옵션 텍스트>"만. WHY가 없음.

Phrase Munch는 step-by-step 설명 보여주는데 Article Study Quiz는 답만 던짐. 학습 효과 약함.

**수정:** AI 콘텐츠에 `explanation` 필드 추가 + 표시. (article_study_content.questions에 explanation 컬럼 추가)

### C3. 🟠 자동 advance 1200ms — 조정 불가

```javascript
setTimeout(function(){
  if(_asQState.current<_asQState.qs.length-1){
    _asQState.current++;
    _asRenderQuiz();
  }
  // ...
}, 1200);
```

답 클릭 → 1.2초 후 자동으로 다음 문제. 사용자가 설명 읽을 시간 부족할 수 있음. 멈출 방법 없음.

**수정:**
- "Next" 버튼 추가하고 자동 advance 제거
- 또는 1.2초 → 2.5초 늘림
- 또는 user 환경설정으로 noted

### C4. 🟡 _asAutoSubmitOldWork — 실패 silent

```javascript
for(var ai=0;ai<ids.length;ai++){
  // ...
  var r=await sb.from('user_submissions').upsert(...);
  if(!r.error){item.submitted=true;changed=true;}
  // 실패 시 → 아무것도 안 함
}
```

DB 업서트 실패 시 localStorage 안 업데이트되고 다음 페이지 로드 때 다시 시도 — 재시도는 OK지만 영구 실패 (예: 권한 이슈)인 경우 사용자/관리자 모르게 무한 재시도.

**수정:** retry counter localStorage에 + 일정 횟수 후 surface.

### C5. 🟡 _asSaveContentToDB 6회 retry — 사일런트로 망가질 수 있음

```javascript
for (var attempt = 0; attempt < 6; attempt++) {
  res = await sb.from('article_study_content').upsert(row, ...);
  // ...
  if (badCol && (badCol in row)) {
    console.warn('[ArticleStudy] dropping unknown column', badCol, '— retrying');
    delete row[badCol];
    continue;
  }
}
```

좋은 robust 로직이긴 한데 컬럼 6개 다 떨어지면 결국 빈 row만 INSERT됨. 학습 콘텐츠 자체가 안 저장됨 → 다음 학습자가 또 AI 생성 트리거 → 비용 폭발.

**수정:** 핵심 컬럼 (vocab, questions) 빠지면 retry 포기 + alert.

### C6. 🟡 Sentence bonus phrases 없으면 건너뜀

```javascript
if (!incorrect.length) {
  _asSetNav('none','');
  return;
}
```

`wrong_phrases` 없으면 보너스 단계 자체가 안 뜸. 좋은 선택 (garbage 안 보여주는). 하지만 학습자는 "왜 보너스 가끔 있고 가끔 없지?" 모름. → 일관성 없음.

**수정:** "Today's bonus practice isn't ready" 메시지 또는 wrong_phrases 자동 생성 trigger.

---

## 🅳 통합 패턴 — 모든 활동에 공통된 문제

### D1. 🟠 logQuizResult 호출 일관성 없음

| 활동 | logQuizResult? |
|------|---------------|
| Phrase Munch | ✅ 호출함 |
| Word Order | ❌ 없음 |
| Slang Quiz | ❌ 없음 |
| Article Study Quiz | ❌ (다른 경로로 user_submissions) |
| Picture Description | ❌ |
| Dictation | (확인 안 함) |

Learning Hub는 정답률 / 약점 분석에 의존하는데 데이터 누락이 많음.

**수정:** 모든 quiz 종료 지점에서 `logQuizResult` 호출 표준화. 헬퍼 함수 만들면 좋음.

### D2. 🟠 모달 close 정리 패턴 없음

각 모달의 close 함수가 제각각:
- `closeWritingModal`: 이번 PR에서 마이크 정리 추가 ✅
- `closeArticleStudy`: 정리 없음 ❌
- `closeDictationModal`: ?
- `closeKeyExpressionsModal`: ?
- `closeSpeakingPractice`: ?

**수정:** `_closeStudyModal(modalId)` 헬퍼 만들어서:
- modal hide
- body.overflow 복원
- TTS cancel
- 활동 state reset
- audio URL revoke

각 모달 close 함수가 이걸 호출하도록.

### D3. 🟡 매직 넘버 (auto-advance 1200ms, score thresholds 등) 흩어져 있음

상수 한 곳 (`STUDY_ROOM_CONFIG = { autoAdvanceMs: 1200, slangMasteryRatio: 0.8, ... }`)에 모으면 튜닝 쉬워짐.

---

## 📋 권장 처리 순서

| 순위 | 항목 | 시간 |
|-----|------|------|
| 1 | A1 Word Order 다중 어순 (배열 받기) | 1시간 + 데이터 마이그레이션 |
| 2 | D1 logQuizResult 표준화 | 30분 |
| 3 | B4 Slang 오답 설명 표시 | 10분 |
| 4 | C2 Article Study quiz explanation 필드 | 1시간 + DB 마이그레이션 |
| 5 | C1, D2 모달 close 정리 헬퍼 | 30분 |
| 6 | B1, B2 Slang dedup + 풀 방어 | 15분 |
| 7 | C3 Auto-advance 조정 | 15분 |
| 8 | A3 Word Order logQuizResult | 5분 (D1 일부) |
| 9 | A5 Word Order empty state | 10분 |
| 10 | C5 Article Study save retry 핵심 컬럼 가드 | 20분 |

---

## ❓ 너 결정 필요할 만한 것들

- **A1 다중 어순:** 정답 배열 받는 거 admin UI / AI 프롬프트 둘 다 바꿔야 함. 큰 작업. 우선순위?
- **C2 quiz explanation:** 기존 article_study_content row 다 explanation 비어있을 거 → AI 재생성 비용 발생. 신규부터 적용? 기존도 백필?
- **A4 stage key 분리:** 'picture' 단일 키 vs 'picture_word_order' 분리 → 학습 진행 데이터 마이그레이션 영향.
