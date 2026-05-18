# Index.html Script Defer 분석 (2026-05-18)

Audit Part 1 #11 후속. 메인페이지 6초 로딩 → `defer` 추가로 단축 가능성 조사.

## 📐 현재 상태

`korehan/index.html`이 외부 `<script>` 26개를 **모두 sync 로드**. 결과:
- 폰 4G에서 라운드트립 50-200ms × 26 = 1.3~5.2초 통째로 블로킹
- 각 스크립트 다운로드/파싱 동안 HTML 렌더링 중단
- 첫 페인트 지연

## 🔍 스크립트별 분석

각 스크립트에 대해 검사: (1) 사이즈, (2) top-level 부작용, (3) 다른 스크립트가 의존하는지, (4) defer 안전성.

### Critical Path (sync 유지 권장)

| # | 스크립트 | 줄 수 | top-level | defer? | 이유 |
|---|---------|------|----------|--------|------|
| 1 | `cdn.jsdelivr.net/.../supabase-js@2` | (external) | createClient global | ❌ | korehan-shared.js가 즉시 `window.supabase.createClient` 호출 |

이 1개만 진짜 sync 유지가 안전.

### Defer 안전 — Core Helpers (DOMContentLoaded 전에만 등록되면 OK)

| # | 스크립트 | 줄 수 | top-level | defer? | 검증 |
|---|---------|------|----------|--------|------|
| 2 | `js/core/security.js` | 32 | helper 정의만 | ✅ | DOM access 없음, 함수만 export |
| 3 | `js/core/storage.js` | 12 | lsGet/lsSet 정의 | ✅ | 순수 함수 |
| 4 | `js/core/icons.js` | 30 | Lucide setup | ✅ | DOMContentLoaded에서 renderIcons() — defer OK |
| 5 | `js/core/modals.js` | 154 | openModal/closeModal | ✅ | 함수만, 호출은 인터랙션 시 |
| 6 | `js/core/ui-states.js` | 64 | UI 헬퍼 | ✅ | 함수만 |
| 9 | `js/core/plans.js` | 214 | requirePlan/canAccess | ✅ | 함수만 |
| 10 | `js/core/article-cache.js` | 271 | safeParseJSON 등 | ✅ | 함수만 |
| 11 | `js/core/phrases.js` | 357 | phrases 헬퍼 | ✅ | 사용자 인터랙션 후 |
| 12 | `js/core/saved-words.js` | 192 | saved-words 헬퍼 | ✅ | 사용자 인터랙션 후 |
| 13 | `js/core/hangul-jamo-input.js` | (확인) | IIFE | ✅ | input element 있을 때만 활성 |
| 15 | `js/core/articles.js` | (확인) | IIFE `hydrateArticlesCacheFromStorage` | ✅ | localStorage 읽기만 |
| 16 | `js/core/reporters.js` | (확인) | IIFE + DOMContentLoaded listener | ✅ | DOM listener는 defer-safe |
| 26 | `korehan-shared.js` | 11566 | 큰 IIFE | ✅ | DOMContentLoaded 안에서 init |

### Defer 안전 — Background / Analytics (사용자 영향 없음)

| # | 스크립트 | 줄 수 | top-level | defer? |
|---|---------|------|----------|--------|
| 7 | `js/core/analytics.js` | 154 | 2개 IIFE (bootstrapAnalytics, dedup) | ✅ |
| 8 | `js/core/user-analytics.js` | 282 | IIFE setup | ✅ |
| 17 | `js/features/streak.js` | 125 | auth-dependent | ✅ |
| 18 | `js/features/daily-mission.js` | 367 | 첫 페인트 후 | ✅ |
| 19 | `js/features/reading-tracker.js` | 67 | beforeunload listener | ✅ (listener는 defer-safe) |
| 20 | `js/features/bookmarks.js` | 53 | 함수만 | ✅ |
| 21 | `js/features/comments.js` | 507 | 스크롤 후 | ✅ |
| 22 | `js/features/sidebar.js` | 179 | IIFE | ✅ |

### Defer 안전 — Interaction-Triggered (전혀 안 쓰일 수도)

| # | 스크립트 | 줄 수 | 트리거 |
|---|---------|------|--------|
| 14 | `js/features/video-player.js` | 421 | 비디오 클릭 시 |
| 23 | `js/features/analyze-mode.js` | 133 | "분석 모드" 토글 |
| 24 | `js/features/translation.js` | 302 | 번역 토글 |
| 25 | `js/features/fill-blank.js` | 501 | 스터디룸 / 빈칸 활동 |

이 4개는 사실 **lazy-load 후보**도 됨 (`<script>` 자체를 인터랙션 시점에 동적 삽입). 하지만 defer만 해도 큰 효과.

---

## 🔬 의존성 검증

### 인라인 스크립트 충돌?

`index.html` 인라인 `<script>` 3개:
- **Line 856** — 첫 방문 리다이렉트 (localStorage만 사용, 외부 의존 X) ✅
- **Line 893** — kh-loader IIFE (DOM-only, 외부 의존 X) ✅
- **Line 1277** — `var HOME_CONVS = [...]` 데이터 (외부 의존 X) ✅

→ 모든 인라인이 defer 외부보다 먼저 실행됨. 외부가 인라인 데이터에 의존하면 OK. **충돌 없음.**

### 외부 스크립트 간 의존?

`defer`는 DOM 순서 보존하면서 비동기 다운로드. 26개 동일 순서로 실행되므로 현재 의존성 그대로 유지됨.

특히 우려할 만한 케이스 확인:
- `articles.js`는 `lsGet`(storage.js), `safeParseJSON`(article-cache.js)에 의존 → DOM 순서대로 이미 뒤에 있음 ✅
- `korehan-shared.js`는 거의 모든 게 정의된 후 마지막에 로드 → 의존 충족 ✅
- IIFE들 (analytics, articles, reporters)은 자기 안에서만 작동, 외부 스크립트 함수 호출 안 함 (top-level에선) ✅

---

## ⚡ 예상 효과

### 시나리오 1: 전부 defer (Supabase SDK 제외)
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/core/security.js?v=..." defer></script>
<script src="js/core/storage.js?v=..." defer></script>
... (24개 모두 defer)
<script src="korehan-shared.js?v=..." defer></script>
```

**효과:**
- HTML 파싱 동안 25개 스크립트 병렬 다운로드 (브라우저가 동시 6~8개씩 fetch)
- 파싱 완료 후 순차 실행 (5~10ms × 26 = 130~260ms)
- 총 시간: **다운로드 1.3~2초로 단축** (현재 1.3~5.2초)
- 폰 4G에서 **2~3초 단축** 기대

### 시나리오 2: Critical만 sync, 나머지 defer
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/core/security.js?v=..."></script>      <!-- sync -->
<script src="js/core/storage.js?v=..."></script>       <!-- sync -->
<script src="js/core/article-cache.js?v=..."></script> <!-- sync -->
<script src="js/core/articles.js?v=..."></script>      <!-- sync -->
...
<script src="korehan-shared.js?v=..." defer></script>  <!-- defer -->
```

장점: 더 안전 (시나리오 1보다 회귀 위험 낮음)
단점: 효과 작음 (~1초 단축)

---

## 🚦 권장 단계 (안전 → 효과)

### Phase 1 (10분, 위험 매우 낮음): Background features만 defer
변경:
- analytics.js, user-analytics.js: defer
- streak.js, daily-mission.js, bookmarks.js, comments.js, sidebar.js, reading-tracker.js: defer

기대 효과: **0.5~1초 단축**
회귀 위험: 매우 낮음 (이미 비동기 로드 패턴인 것들)

### Phase 2 (20분, 위험 낮음): Interaction-triggered도 defer
추가 변경:
- video-player.js, analyze-mode.js, translation.js, fill-blank.js: defer

기대 효과: **추가 0.5~1초**
회귀 위험: 낮음 (사용자 인터랙션 전엔 안 쓰임)

### Phase 3 (30분, 위험 중간): Core helpers도 defer
추가 변경:
- security, storage, icons, modals, ui-states, plans, phrases, saved-words, hangul-jamo-input, article-cache: defer
- korehan-shared.js: defer (이미 마지막이라 큰 변화 없음)

기대 효과: **추가 0.5~1초**
회귀 위험: 중간 (인라인 스크립트 / DOM ready 타이밍 회귀 가능성)

### Phase 4 (1시간, 회귀 테스트 필요): articles.js + reporters.js도 defer
추가 변경: 마지막 까다로운 거.

기대 효과: 미미 (이미 빠른 단계)
회귀 위험: 가장 큼 (홈 News rail에 영향)

---

## ⚠️ 회귀 테스트 항목

각 phase 마다:
- [ ] 메인페이지 로딩 — 시각적 깨짐 없이 정상 렌더링
- [ ] 홈 News rail / Stories rail / Conversations rail 정상 로드
- [ ] 헤더 / 푸터 정상 표시
- [ ] 사이드바 정상
- [ ] 로그인된 상태 / 비로그인 상태 모두 확인
- [ ] 폰 (실기기) + 데스크탑 둘 다
- [ ] Network throttling: Fast 3G / Slow 4G 시뮬레이션
- [ ] Lighthouse Performance 점수 (before/after)

---

## 💡 추가 최적화 (장기)

- **Critical CSS inline** — `korehan-shared.css` 일부를 `<style>`로 인라인
- **Font preload** — `<link rel="preload" as="font">` Google Fonts
- **Image lazy load** — News 카드 이미지 `loading="lazy"` (대부분 이미 되어있는지 확인)
- **Bundling** — CLAUDE.md P0에 적혀있는 hashed-filename Vite 번들링
- **HTTP/2 push** — Cloudflare 설정에 critical assets push

---

## 🤔 결정 필요

**한 번에 다 가? 단계적?**

- 단계적 (Phase 1 → 2 → 3 → 4) 추천 — 각 phase 후 모니터링
- 회귀 발생 시 phase 단위로 롤백 쉬움
- 매 phase 마다 별도 PR

**Phase 1만 지금?**
- 위험 매우 낮고 효과 0.5~1초 — quick win
- 1시간 안에 끝남

**아니면 다 한꺼번에 (시나리오 1)?**
- 더 빠른 결과
- 회귀 났을 때 원인 추적 어려움

---

## 📋 내가 할 수 있는 것

다음 세션에서:
- Phase 1만 → 10분 PR, 빠른 ship
- Phase 1+2 → 30분 PR
- Phase 1~3 → 1시간 PR + 회귀 테스트 가이드
- 전체 (1+2+3+4) → 1.5시간 PR + 폰 실기기 테스트 권장
