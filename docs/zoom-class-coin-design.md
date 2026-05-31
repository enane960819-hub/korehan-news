# 줌 클래스 코인 / 예약 설계

> 상태: 설계 확정본 (이 세션까지 결정 반영).
> 이전 세션에서 작성한 초안이 미커밋 상태로 컨테이너 리셋 때 유실되어, 결정사항을
> 기준으로 재작성함. 구현 전 최종 리뷰용.

---

## 1. 목적 / 수익 모델

줌 클래스(라이브 스피킹 세션)는 **Pro 구독자 전용** 유료 기능이다.

- Pro 구독료: **$24.99/월**
- 줌 클래스 1회 예약 = **코인 1개 차감** (1코인 = $1 상당)
- 코인 획득 경로:
  1. **충전(구매)** — 결제로 코인 구입 (예: $30 → 30코인). `paid` 코인.
  2. **무료(streak)** — 5일 출석 등 보상으로 지급. `free` 코인.

### 핵심 정책 (우회 차단)

> 문제: "한 달만 구독 → $30 충전 → 해지 → 구독 없이 줌을 회당 $1로 계속 수강"
> 이 우회가 가능하면 $24.99/월 구독 모델이 무너진다.

**결정 — 예약은 `active pro`만 가능 + 구독 해지/만료 시 잔여 충전 코인 자동 환불.**

- 예약(코인 차감)은 **활성 Pro 구독자만** 가능.
- 구독 해지/만료 시:
  - **충전(paid) 코인 잔액 × $1 → Stripe 자동 환불** (`customer.subscription.deleted` webhook).
  - **무료(free, streak) 코인은 환불 없이 소멸.**
- 결과: 구독을 끊으면 코인이 0이 되므로 우회 불가. 유저는 안 쓴 충전분을 돌려받아 공정.

미결 #1(취소·환불 정책), #2(만료 코인 처리) 모두 위 정책으로 **확정**.

---

## 2. 지갑 스키마 — 충전분/무료분 분리

환불은 충전분만 대상이므로, 지갑이 paid/free를 구분해야 한다.

`user_speaking_coins` 테이블:

| 컬럼 | 의미 |
|---|---|
| `coins_remaining` | **총 잔액** (= paid + free). 기존 컬럼 유지 → 기존 함수/배지 호환 |
| `coins_free` | 무료/streak 지급분. **신규 컬럼** `int NOT NULL DEFAULT 0` |

- 충전(paid) 잔액 = `coins_remaining - coins_free` (파생).
- `grant_speaking_coins`(충전) → `coins_remaining`만 +N, `coins_free`는 안 건드림.
- `claim_zoom_class_coin`(streak 보상) → `coins_remaining` +1 **그리고** `coins_free` +1.

### 차감 우선순위 — 무료분 먼저

예약 시 1코인 차감은 **무료분 먼저, 그다음 충전분**.

```
if coins_free > 0:
    coins_free   -= 1
coins_remaining  -= 1
```

이유: 무료 코인은 해지 시 소멸(환불 안 됨)이므로, 먼저 소진해야 유저에게 유리하고
공정하다. 충전분은 끝까지 남겨 환불 가능 상태로 보존.

---

## 3. 예약 RPC — `book_live_session`

> 현재 문제: `weekly_live_registrations`에 RLS로 **직접 insert**가 열려 있어
> (a) 코인 안 내고 무료 예약 가능, (b) 정원 동시성 버그. 반드시 서버 RPC로만
> 예약하도록 잠근다 (직접 insert RLS 차단).

`book_live_session(p_session_id uuid)` — `SECURITY DEFINER`, **한 트랜잭션** 안에서:

1. `auth.uid()` 확인 (비로그인 거부)
2. **구독 확인** — active pro 아니면 `{ ok:false, reason:'pro_required' }`
   (해지 후엔 환불로 코인이 0이므로 잔액으로도 막히지만, 명시적으로 먼저 차단)
3. 세션 행 `SELECT ... FOR UPDATE` (정원 경쟁 직렬화) — 취소됨/마감(deadline 지남)/과거면 거부
4. 현재 예약 수 COUNT (락 안에서) ≥ `max_attendees` → `{ ok:false, reason:'full' }`
5. 이미 예약했으면 → `{ ok:false, reason:'already_booked' }`
6. 지갑 `FOR UPDATE`. `coins_remaining < 1` → `{ ok:false, reason:'no_coins', balance:0 }`
7. 차감: 무료분 먼저 → 충전분 (위 2장 규칙). 감사용 로그 1줄.
8. 예약 행 insert → `{ ok:true, balance:N }`

프런트는 이 RPC 반환 `reason`별로 메시지 분기 (pro_required → 구독 유도,
no_coins → 충전 유도, full → 마감, already_booked → 안내).

---

## 4. 환불 처리 — 구독 해지/만료

**트리거:** Stripe `customer.subscription.deleted` (및 만료) webhook.

처리 (서버, 한 트랜잭션 + Stripe API):

1. 지갑 `FOR UPDATE` 조회. `paid_balance = coins_remaining - coins_free`.
2. `paid_balance <= 0`이면 환불 없음 → 5번으로.
3. **충전분만 환불.** `speaking_coin_purchases`를 **최근 구매부터 역순**으로 순회하며,
   해당 charge/payment_intent에 대해 미환불 수량만큼 **부분 환불**(quantity × $1).
   `paid_balance`만큼 채울 때까지 진행. (이미 환불/사용된 수량 추적)
4. 각 환불 결과를 `speaking_coin_refunds`(신규/기존)에 기록 — 멱등성 위해 webhook
   재전송 대비 `stripe_refund_id` 유니크.
5. 지갑 0으로: `coins_remaining = 0`, `coins_free = 0` (무료분 소멸 + 충전분 환불 완료).

### 이미 예약된 미래 세션 처리 (기본값)

해지 시점에 이미 예약(코인 차감 완료)한 미래 세션은 **그대로 인정**한다.
코인이 이미 소비된 = 제공해야 할 서비스. 단 해지 후 **신규 예약은 불가**.
→ 환불은 "안 쓴 충전 코인"에만 적용되어 일관됨.

### 멱등성 / 안전장치

- webhook은 중복 전송될 수 있음 → `stripe_refund_id` 유니크 + 지갑 0 체크로 이중 환불 방지.
- 자동 환불 실패(Stripe 에러) 시 재시도 큐 + 운영자 알림 (한 번에 못 막으면 수동 보정).

---

## 5. 남은 확인 / 후속

- [ ] `speaking_coin_purchases`에 충전 시 `quantity`, `payment_intent`, `refunded_qty`
      컬럼이 있는지 확인 (역순 부분환불 추적용). 없으면 마이그레이션.
- [ ] `weekly_live_registrations` 직접 insert RLS 차단 + RPC만 허용하도록 정책 변경.
- [ ] Stripe 부분환불 30일 기한 케이스: 결정상 전액 자동 환불이나, 기한 초과 charge는
      Stripe가 거부할 수 있음 → 실패분은 운영자 수동 처리로 폴백.
- [ ] 프런트 메시지/UX (구독 유도, 충전 유도, 정원 마감) 카피.

---

## 결정 로그

| # | 항목 | 결정 |
|---|---|---|
| 1 | 취소·환불 정책 | 구독 해지/만료 시 잔여 **충전 코인 자동 환불**, 무료분 소멸 |
| 2 | 만료 코인 처리 | active pro만 예약; 해지 시 충전분 환불로 잔액 0 (우회 차단) |
| 3 | 환불 방식 | **자동 환불** (해지 webhook), 충전분만 |
