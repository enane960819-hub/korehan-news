# 줌 클래스 코인 시스템 — 설계문서

> 작성: 2026-05-31 · 상태: **검토 대기 (코드 미작성)**
> 검토 후 단계별 PR로 구현 예정.

---

## 0. 한 줄 요약

**Speaking Coach 코인 = 줌 클래스 코인** (기존 `user_speaking_coins` 지갑 그대로 재사용).
냥(nyang)·상점과 **완전 분리**. 코인은 오직 두 경로로만 생긴다:

1. **5일 연속 출석 → 1코인** (무료, 구독자만) — `free` 코인
2. **충전** (최소 5개, $1/개, 구독자만 — 이미 구현됨) — `paid` 코인

**$24.99/월 Pro 구독**은 코인을 **자동 지급하지 않는다.** 구독은 "줌 클래스에 접근하고
위 두 경로로 코인을 **획득할 권리**"만 부여한다. 코인은 만료되지 않고 이월(carry-over)된다.
1코인 = 줌 클래스 1회 예약.

**예약은 active pro만 가능.** 구독을 해지/만료하면 **잔여 충전(paid) 코인은
$1×수량으로 Stripe 자동 환불**되고, **무료(free/streak) 코인은 소멸**한다. 이렇게 하면
"한 달만 구독 → $30 충전 → 해지 → 구독 없이 회당 $1로 줌만 수강"하는 우회를 막는다
(해지하면 코인이 0이 되므로 비구독자가 코인을 들고 있을 수 없다). 환불은 충전분만
대상이므로 지갑이 paid/free를 구분해야 한다(§2 참조). 미결 #1·#2 → 이 정책으로 확정.

---

## 1. 현재 코드 자산 (재사용 맵)

| 자산 | 위치 | 줌 클래스에서의 역할 |
|---|---|---|
| `user_speaking_coins` 지갑 | `20260422_speaking_coach_wallet.sql` | **줌 클래스 코인 지갑** (그대로 사용, 이월 = `+=` 누적이라 공짜로 됨) |
| `consume_speaking_coin()` | 동일 | 예약 시 코인 차감의 **패턴 참고** (원자적 `FOR UPDATE`) |
| `grant_speaking_coins()` | 동일 | 충전 시 지급 (service_role, idempotent) — 그대로 |
| `speaking-pass-checkout` | Edge Function | 코인 충전 ($1×수량, **이미 pro-gated, 최소 5개**) — 그대로 |
| `speaking-pass-webhook` | Edge Function | Stripe 서명검증 + 코인지급 + 환불 — **여기에 구독 이벤트 분기 추가** |
| `user_subscriptions` | `20260412_user_subscriptions.sql` | Pro 플랜 상태 (plan/status/expires_at, user당 UNIQUE) |
| `weekly_live_sessions` / `weekly_live_registrations` | `20260502_weekly_live_sessions.sql` | 줌 세션(정원 `max_attendees`) / 예약 |
| `cpRegister()` / `cpCancelRegistration()` | `korehan-courses.html` | 예약 UI — **RPC 호출로 교체 필요** |
| `study_daily_progress.submitted` | `20260328_study_room_restructure.sql` | 5일 연속 출석 streak 계산 소스 |
| `claim_streak_award()` | `20260507_streak_freeze_award.sql` | streak 보상 idempotent 지급의 **패턴 참고** |

---

## 2. 빌드 항목 (4개)

### 항목 1 — $24.99/월 Pro 구독 결제 ⚠️ 신규

**왜:** 줌 클래스(=코인 획득/충전)의 게이트. 현재 코인 충전 함수는 `isPro` 체크를 하는데,
**pro가 되는 경로 자체가 없다.** 이걸 만든다.

**1a. 신규 Edge Function `pro-subscription-checkout/index.ts`**
- `speaking-pass-checkout`를 복제하되 차이점:
  - `mode: 'subscription'` (구독)
  - line item = `STRIPE_PRICE_PRO_MONTHLY` (월 $24.99 recurring price), quantity 1
  - **pro 게이트 없음** — 누구나(로그인만) 호출 가능 (이게 pro가 되는 입구라서)
  - `metadata: { user_id, product: 'pro-subscription' }`
  - `success_url`/`cancel_url` → 적절한 페이지
- 신규 Secret: `STRIPE_PRICE_PRO_MONTHLY`

**1b. `speaking-pass-webhook`에 구독 이벤트 분기 추가** (새 웹훅 안 만들고 기존 것 확장 — 서명검증/에러로깅 재사용)
- `checkout.session.completed` 에서 `metadata.product === 'pro-subscription'` → 구독 활성화
- `invoice.paid` → 매월 갱신 (expires_at 연장)
- `customer.subscription.deleted` → status='cancelled' **+ 잔여 충전 코인 자동 환불** (§5 참조).
  구독은 코인을 안 주지만, 해지 시엔 안 쓴 충전분을 돌려준다.
- 코인 지급 **없음** (구독은 코인 안 줌)

**1c. 신규 migration — 구독 적용 RPC + 컬럼**
- `user_subscriptions`에 컬럼 추가: `stripe_customer_id text`, `stripe_subscription_id text`
- `apply_subscription_event(p_user_id, p_stripe_customer_id, p_stripe_subscription_id, p_status, p_period_end)` — service_role 전용, idempotent upsert. plan='pro' 설정, expires_at=period_end.

---

### 항목 2 — 줌 클래스 예약(코인 차감) ⚠️ 신규 + 기존 경로 차단

**핵심 문제:** 지금은 `weekly_live_registrations`에 RLS로 **직접 insert** → 코인 안 내고 무료 예약 가능 + 정원 동시성 버그. 반드시 서버 RPC로만 예약하게 잠근다.

**지갑 충전분/무료분 분리 (환불 회계용):** 해지 시 환불은 충전분만 대상이므로 지갑이
paid/free를 구분해야 한다.
- `user_speaking_coins`에 컬럼 추가: `coins_free int NOT NULL DEFAULT 0` (무료/streak 지급분).
- 충전(paid) 잔액 = `coins_remaining - coins_free` (파생). 합계 컬럼 `coins_remaining`은
  유지 → 기존 `consume_speaking_coin` / `grant_speaking_coins` / 잔액 배지 호환.
- `grant_speaking_coins`(충전) → `coins_remaining`만 +N, `coins_free`는 안 건드림.
  `claim_zoom_class_coin`(streak) → `coins_remaining` +1 **그리고** `coins_free` +1.
- **차감 우선순위: 무료분 먼저 → 충전분.** 무료분은 해지 시 소멸(환불 안 됨)이므로
  먼저 소진해야 유저에게 유리·공정하고, 충전분을 끝까지 남겨 환불 가능 상태로 보존.

**2a. 신규 migration — 예약/취소 RPC (원자적)**

`book_live_session(p_session_id uuid)` — `SECURITY DEFINER`, 한 트랜잭션 안에서 순서대로:
1. `auth.uid()` 확인
2. **구독 확인** — active pro 아니면 `{ ok:false, reason:'pro_required' }`
3. 세션 행 `SELECT ... FOR UPDATE` (정원 경쟁 직렬화) — 취소됨/마감(deadline 지남)/과거면 거부
4. 현재 예약 수 COUNT (락 안에서) ≥ `max_attendees` → `{ ok:false, reason:'full' }`
5. 이미 예약했으면 → `{ ok:false, reason:'already_booked' }`
6. 지갑 `FOR UPDATE`, `coins_remaining < 1` → `{ ok:false, reason:'no_coins', balance:0 }`
7. 코인 -1 (**무료분 먼저, 그다음 충전분** — `coins_free>0`이면 `coins_free-=1`, 항상 `coins_remaining-=1`),
   예약 행 insert, (감사용) 예약-코인 사용 로그
8. `{ ok:true, balance:N }`

`cancel_live_booking(p_session_id uuid)` — `SECURITY DEFINER`:
- 예약 존재 + (정책상 취소 가능 시점, 예: 시작 전) → 예약 삭제 + **코인 1 환불**
- idempotent (이미 취소면 환불 중복 금지)
- 정책 결정 필요: 시작 N시간 전까지만 환불? (아래 미결 질문)

**2b. RLS 잠금** — `weekly_live_registrations`의 `wlr_self_insert` / `wlr_self_delete` 정책 제거(또는 무력화). 예약/취소는 오직 위 RPC로만. (읽기 카운트 정책 `wlr_count_read`는 유지.)

**2c. 프론트엔드 `korehan-courses.html`**
- `cpRegister()` → `sb.rpc('book_live_session', { p_session_id })` 로 교체. 반환 reason별 처리:
  - `no_coins` → "코인이 부족해요. 충전(최소 5개) 또는 5일 출석으로 받으세요" + 충전 버튼
  - `pro_required` → 구독 안내 + 구독 버튼(→ `pro-subscription-checkout`)
  - `full` / `already_booked` → 안내
- `cpCancelRegistration()` → `sb.rpc('cancel_live_booking', ...)`
- 카드에 **코인 잔액 배지** + "1회 예약 = 코인 1개" 표기

---

### 항목 3 — 5일 연속 출석 → 코인 1개 ⚠️ 신규

**3a. 신규 migration — `claim_zoom_class_coin()` RPC** (`claim_streak_award` 패턴 차용)
- active pro 아니면 거부 (구독자만)
- `study_daily_progress`에서 `submitted=true`인 날을 오늘부터 역순으로 세어 **연속일수** 계산
- 지급량 = `FLOOR((streak - last_claimed_streak) / 5)` 코인 (5일마다 1개, 중복지급 방지)
- 멱등성 마커: `profiles.last_zoom_coin_streak`(신규 컬럼) 또는 별도 `zoom_coin_grants` 테이블
- 지급은 이 RPC가 `SECURITY DEFINER`로 지갑에 직접 `+=` (감사 로그 한 줄 남김)
- 반환: `{ ok, granted, streak, balance }`

**3b. 프론트엔드** — 일일 제출 완료 시 / courses·study 페이지 로드 시 호출, 지급되면 토스트.

---

### 항목 4 — 충전 최소 5개 ✅ 이미 완료

`speaking-pass-checkout`에 `MIN_COINS=5` 이미 존재. **변경 없음.**

---

## 3. 데이터 흐름 (요약 다이어그램)

```
[비구독자]
   │  pro-subscription-checkout ($24.99/mo)
   ▼
[Stripe 구독] ──webhook(checkout.completed/invoice.paid)──► user_subscriptions(plan=pro, active)
   │
   ├─(A) 5일 연속 출석 ── claim_zoom_class_coin() ──► user_speaking_coins +1
   │
   └─(B) 충전(min 5) ── speaking-pass-checkout ──Stripe──webhook──► grant_speaking_coins() ──► +N
                                                                            │
[줌 예약] book_live_session() ──(active pro? 정원? 잔액?)──► coins -1(무료분 먼저) + 예약 ◄────────┘
[예약 취소] cancel_live_booking() ──► coins +1 (환불, 정책 내)
[구독 해지] subscription.deleted ──► 충전분 Stripe 환불 + 무료분 소멸 → 지갑 0
```

---

## 4. 오너(본인)가 Stripe 대시보드에서 할 일

코드만으론 안 되고 본인만 할 수 있는 작업:

**A. Stripe 대시보드**
1. **$24.99/월 구독 상품** 생성 → recurring monthly price의 `price_xxx` 복사
2. 코인용 $1 일회성 price (`STRIPE_PRICE_COACH_COIN`)는 이미 쓰는 중 — 그대로
3. 기존 Webhook 엔드포인트(`speaking-pass-webhook`)의 이벤트 목록에 추가 체크:
   `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
   (`checkout.session.completed`, `charge.refunded`는 이미 체크돼 있을 것)

**B. Supabase → Edge Functions → Secrets**
- `STRIPE_PRICE_PRO_MONTHLY` = 위 A-1의 `price_xxx`  ← **신규**
- (기존: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_COACH_COIN`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL` 그대로)

**C. 배포** (코드 작성 후)
- `supabase functions deploy pro-subscription-checkout`
- `supabase functions deploy speaking-pass-webhook` (구독 분기 추가분)
- migration 적용

> 권장: 먼저 `sk_test_` 테스트 모드 + 테스트카드 `4242 4242 4242 4242`로 전 구간 검증 후 라이브 키 교체. 결제는 되돌리기 어려움.

---

## 5. 구독 해지/만료 시 환불 처리 ⚠️ 신규

**정책 (확정):** active pro만 예약 가능. 구독을 해지/만료하면 **잔여 충전(paid) 코인을
$1×수량으로 Stripe 자동 환불**하고 **무료(free/streak) 코인은 소멸**시킨다. → 비구독자는
코인을 들고 있을 수 없으므로 회당 $1 우회가 차단된다.

**트리거:** Stripe `customer.subscription.deleted` webhook (`speaking-pass-webhook`의 1b 분기).

**처리 (서버, 한 트랜잭션 + Stripe API):**
1. 지갑 `FOR UPDATE` 조회. `paid_balance = coins_remaining - coins_free`.
2. `paid_balance <= 0`이면 환불 없음 → 4번.
3. **충전분만 환불.** `speaking_coin_purchases`(또는 충전 기록)를 **최근 구매부터 역순**으로
   순회하며 해당 charge/payment_intent에 미환불 수량만큼 **부분 환불**(quantity × $1),
   `paid_balance`를 다 채울 때까지. (이미 환불/사용된 수량 추적)
4. 지갑 0으로: `coins_remaining = 0`, `coins_free = 0` (무료분 소멸 + 충전분 환불 완료).

**이미 예약된 미래 세션:** 해지 시점에 이미 예약(코인 차감 완료)한 세션은 **그대로 인정**.
코인이 이미 소비됐으니 제공해야 할 서비스다. 단 해지 후 **신규 예약은 불가**. → 환불은
"안 쓴 충전 코인"에만 적용되어 일관됨.

**멱등성/안전장치:**
- webhook 중복 전송 대비 — 환불 기록(`stripe_refund_id` 유니크) + 지갑 0 체크로 이중 환불 방지.
- Stripe 자동 환불 실패(에러/기한 초과) 시 재시도 큐 + 운영자 알림(수동 보정 폴백).
- **부분환불 30일 기한:** 정책상 전액 자동 환불이나, 기한 초과 charge는 Stripe가 거부할 수
  있음 → 실패분은 운영자 수동 처리로 폴백.

---

## 6. 미결 결정사항 (구현 전 확정 필요)

1. ~~**예약 취소 환불 정책**~~ — (참고) §2의 `cancel_live_booking` 시작 N시간 전 환불 기준은 별도. (단순 코인 1 환불, Stripe 무관)
2. ~~**구독 만료 시 잔여 코인**~~ → **확정:** active pro만 예약, 해지 시 충전분 자동 환불·무료분 소멸 (§5).
3. **5일 streak 기준** — `study_daily_progress.submitted=true`만 인정? 오늘 포함/제외? streak freeze(얼리기)로 메운 날도 인정?
4. **충전 기록 스키마** — `speaking_coin_purchases`에 역순 부분환불 추적용 `quantity` / `payment_intent` / `refunded_qty` 컬럼이 있는지 확인. 없으면 마이그레이션.
5. **진행 순서** — 항목1(구독+환불) → 항목2(예약+지갑분리) → 항목3(streak) 순서로 각각 별도 PR (권장).

---

## 7. 구현 시 주의 (과거 인시던트 반영)

- **스크립트 변경마다 cache-buster(`?v=`) 갱신** — `korehan-courses.html` 등 (CLAUDE.md 2026-05-16 인시던트).
- **마이그레이션 파일명** `20260531_zoom_class_coins_*.sql` 컨벤션 유지.
- **모든 신규 RPC**는 `SECURITY DEFINER` + `SET search_path = public, pg_temp` (보안 핫픽스 컨벤션).
- 코인/결제는 되돌리기 어려우므로 테스트 모드 우선.
