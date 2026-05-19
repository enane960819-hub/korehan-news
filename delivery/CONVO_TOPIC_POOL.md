# Conversation Topic Pool — 84 Scenarios

**Generated**: 2026-05-18 (D2 of launch plan)
**Purpose**: feed into conversation generator to expand variety beyond the
4 categories (everyday/work/dating/friends) shipped on Home page.

## How to use

1. Owner reviews / strikes out scenarios that don't fit the brand
2. For each kept scenario:
   - Decide **TOPIK level** (Sprout / Tree / Forest — Seed is too thin for dialogue)
   - Decide **category** for the catalog rail (existing 4 + new categories)
3. Either:
   - **Path A**: Insert as rows into a new `conv_scenario_pool` table that
     the admin "Random topic" button reads from. (Adds a curation step but
     keeps the model from inventing the same 3 topics repeatedly.)
   - **Path B**: Generate convos in batch directly off this list and
     skip the table — simpler if we never need a self-serve flow.

Owner picks A vs B during D2 review.

## Category counts

| Category | Count | Notes |
|----------|-------|-------|
| Everyday | 12 | Existing home-page rail; expand depth |
| Work | 12 | Existing; weight more entries here (B2B learner overlap) |
| Dating | 9 | Existing; spans casual → marriage |
| Friends | 7 | Existing; lighter content |
| School | 7 | NEW — covers 학생 learners (TOPIK 1-3) |
| Travel | 6 | NEW — high-utility for visitors to Korea |
| Family | 6 | NEW — multigenerational forms (반말/존댓말 mixed) |
| Medical | 5 | NEW — practical, high anxiety = high value |
| Service | 5 | NEW — phone/in-person customer service |
| Korean culture | 10 | NEW — only-in-Korea scenarios; brand differentiator |
| Conflict / drama | 5 | NEW — emotion-heavy, advanced grammar surface |

**Total: 84**

## Suggested TOPIK level distribution

| Level | Suggested count | Why |
|-------|----------------|-----|
| 🌿 Sprout (TOPIK 1-2) | ~30 | learner entry pool — simple service, daily life |
| 🌳 Tree (TOPIK 3-4) | ~38 | the bulk — most situational dialogue lands here |
| 🌲 Forest (TOPIK 5-6) | ~16 | conflict / formal / cultural depth scenarios |

---

## 1. Everyday (일상) — 12

| # | EN slug | KO context line (1 sentence) | Suggested level |
|---|---------|-------------------------------|----------|
| 1 | cafe-order | 카페에서 시그니처 메뉴 주문하기 | Sprout |
| 2 | asking-directions | 지하철역에서 길 물어보기 | Sprout |
| 3 | public-transit-card | 교통카드 충전이 안 될 때 | Sprout |
| 4 | grocery-haggle | 시장에서 가격 흥정 | Tree |
| 5 | weather-smalltalk | 출근길 엘리베이터에서 날씨 잡담 | Sprout |
| 6 | bank-open-account | 은행에서 외국인 계좌 개설 | Tree |
| 7 | pharmacy-cold | 약국에서 감기약 사기 (증상 설명) | Tree |
| 8 | call-in-sick | 회사에 아파서 못 간다고 전화 | Tree |
| 9 | apartment-hunt | 부동산에서 원룸 찾기 | Tree |
| 10 | delivery-disagreement | 배달원과 배달 지연 협상 | Tree |
| 11 | customer-service-refund | 콜센터에 환불 요청 | Tree |
| 12 | noisy-neighbor | 옆집에 조용히 해달라고 부탁 | Forest |

## 2. Work (직장) — 12

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 13 | job-interview | 신입사원 면접 — 자기소개부터 | Tree |
| 14 | salary-nego | 연봉 협상 — 부장님과 1:1 | Forest |
| 15 | boss-1on1 | 상사와 분기 1:1 미팅 | Tree |
| 16 | resign | 사직 의사 전달 (정중하게) | Forest |
| 17 | pitch-idea | 회의에서 새 프로젝트 제안 | Tree |
| 18 | cross-team-coord | 마케팅팀에 협업 요청 | Tree |
| 19 | perf-review | 인사평가 결과 면담 | Forest |
| 20 | onboarding-newhire | 신입사원 사수로 첫 인사 | Sprout |
| 21 | missed-deadline | 마감 못 지킨 변명 + 재협상 | Tree |
| 22 | vacation-request | 연차 신청 — 거절될까봐 조마조마 | Tree |
| 23 | layoff-discussion | 정리해고 통보 받기 | Forest |
| 24 | networking-event | 업계 모임에서 첫 인사 + 명함 교환 | Tree |

## 3. Dating (연애) — 9

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 25 | first-date | 소개팅 첫 만남 카페에서 | Tree |
| 26 | meet-parents | 부모님 처음 뵙는 자리 | Forest |
| 27 | long-distance-call | 장거리 연애 — 영상통화 갈등 | Tree |
| 28 | wedding-plan | 결혼식 장소 두고 의견 충돌 | Forest |
| 29 | breakup | 헤어지자고 말하기 | Forest |
| 30 | anniversary-surprise | 기념일 깜짝 이벤트 계획 | Tree |
| 31 | online-dating-msg | 데이팅 앱 첫 메시지 교환 | Tree |
| 32 | proposal | 프로포즈 순간 | Tree |
| 33 | post-fight-apology | 다툰 다음 날 사과 | Tree |

## 4. Friends (친구) — 7

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 34 | weekend-trip | 주말 여행 계획 (KTX vs 자차) | Tree |
| 35 | borrow-money | 친구한테 돈 빌리기 (어색함) | Tree |
| 36 | gossip-acquaintance | 공통 지인 뒷담화 (반말) | Tree |
| 37 | roommate-conflict | 룸메이트 청소 분담 문제 | Tree |
| 38 | concert-tickets | 콘서트 티켓팅 대신 부탁 | Sprout |
| 39 | karaoke-night | 노래방 가서 누가 먼저 부를지 | Sprout |
| 40 | hospital-visit | 입원한 친구 병문안 | Tree |

## 5. School (학교) — 7

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 41 | extension-request | 교수님께 과제 연장 요청 | Forest |
| 42 | group-project-coord | 조모임 일정 잡기 (단톡방) | Tree |
| 43 | study-group | 시험기간 스터디 모집 | Sprout |
| 44 | club-recruit | 동아리 새내기 환영회 | Sprout |
| 45 | graduation-plans | 졸업 후 진로 — 친구끼리 | Tree |
| 46 | exchange-student | 교환학생 환영회 자기소개 | Sprout |
| 47 | bullying-intervene | 학교폭력 목격 → 선생님께 신고 | Forest |

## 6. Travel (여행) — 6

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 48 | hotel-checkin | 호텔 체크인 — 예약 확인 | Sprout |
| 49 | lost-luggage | 공항 분실물 신고 | Tree |
| 50 | currency-exchange | 환전소 환율 협상 | Sprout |
| 51 | tour-guide-qa | 경복궁 가이드한테 질문 | Tree |
| 52 | resto-complaint-abroad | 음식 잘못 나온 거 항의 | Tree |
| 53 | visa-office | 출입국에서 비자 연장 | Forest |

## 7. Family (가족) — 6

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 54 | grandma-phone | 할머니랑 전화 (사투리 약간) | Tree |
| 55 | sibling-fight | 동생이랑 게임기 두고 다툼 | Sprout |
| 56 | aging-parent-care | 부모님 요양 시설 의논 | Forest |
| 57 | holiday-planning | 추석 차례상 분담 의논 | Tree |
| 58 | engagement-announce | 부모님께 결혼 발표 | Forest |
| 59 | inheritance | 형제간 유산 분배 갈등 | Forest |

## 8. Medical (의료) — 5

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 60 | er-visit | 응급실 접수 — 증상 빠르게 설명 | Tree |
| 61 | annual-checkup | 종합검진 결과 의사 상담 | Tree |
| 62 | mental-health-consult | 정신과 첫 상담 | Forest |
| 63 | dental-emergency | 치과 — 신경치료 비용 협상 | Tree |
| 64 | vet-visit | 동물병원 — 강아지 백신 | Sprout |

## 9. Service (서비스) — 5

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 65 | hair-salon | 미용실에서 원하는 스타일 설명 | Tree |
| 66 | tailor-adjust | 양복점 — 기장 줄이기 | Sprout |
| 67 | phone-plan-nego | 통신사 요금제 변경 협상 | Tree |
| 68 | internet-outage | 인터넷 안 됨 — 기사 출장 예약 | Tree |
| 69 | realtor-tour | 부동산 — 매물 보러 다니기 | Tree |

## 10. Korean cultural (한국 문화 특화) — 10

> Brand differentiator: scenarios that only exist in Korea. Foreigner
> learners specifically want these.

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 70 | hoesik-smalltalk | 회식에서 부장님 옆에 앉아 잡담 | Tree |
| 71 | chuseok-dinner | 추석 차례상 받고 친척 인사 | Tree |
| 72 | hagwon-enroll | 학원 등록 — 레벨 테스트 결과 상담 | Tree |
| 73 | military-visit | 면회 — 입대한 친구 만나러 | Tree |
| 74 | pocha-order | 포차에서 안주 추천 부탁 | Sprout |
| 75 | sageuk-period | 사극 스타일 — 양반과 하인 대화 | Forest |
| 76 | apt-mgmt-office | 아파트 관리사무소에 누수 신고 | Tree |
| 77 | dongjumin-center | 동주민센터 — 전입신고 | Sprout |
| 78 | karaoke-etiquette | 노래방 매너 — 마이크 양보 | Sprout |
| 79 | concert-reserved-seat | 콘서트 — 지정석 자리 다툼 | Tree |

## 11. Conflict / drama (갈등·드라마) — 5

> Advanced grammar (~기는커녕, 사역/피동, 격식체) lands naturally here.

| # | EN slug | KO context line | Level |
|---|---------|-----------------|-------|
| 80 | return-broken | 산 지 1주일 만에 고장난 노트북 반품 | Tree |
| 81 | late-apology | 1시간 늦은 약속 변명 + 사과 | Tree |
| 82 | refuse-request | 친구 결혼식 사회 요청 거절 | Tree |
| 83 | defend-friend | 친구가 부당하게 비난당할 때 변호 | Forest |
| 84 | misunderstanding | 오해 풀기 — "그게 아니라…" | Tree |

---

## Generation guardrails (when feeding into convo-gen prompt)

1. **Pair each scenario with at least 1 essential expression** from
   `essential_expressions` so learners encounter recurring high-value
   phrases across many scenes.
2. **Cast**: use `cast_characters` (fixed 20) for friends/everyday;
   pull from `role_characters` for role-bound NPCs (의사, 교수, 점원,
   부장 etc). Generator should NOT invent new role characters when one
   exists.
3. **Reporter cast** (`character_reporters`) is OFF-LIMITS — reserved
   for stories/news.
4. **Levels match grammar floor** from the article body prompt (D1 fix):
   Sprout convos may NOT use ~기 위해 / ~게 되다 / 사역 / 피동;
   Tree convos MUST surface 4+ TOPIK 3-4 patterns;
   Forest convos use ~다, ~ㄴ다 formal + advanced syntax.
5. **Honorific level should match scenario**: 부장 ↔ 신입 → 존댓말;
   친구끼리 → 반말; 손님 ↔ 점원 → 존댓말.

---

## Next steps after owner sign-off

- [ ] Owner marks A vs B path (scenario_pool table vs direct batch gen)
- [ ] If A: write SQL to create `conv_scenario_pool` + INSERT 84 rows
- [ ] If B: extend the admin "Generate conversations" flow to take a
      multi-select of scenario IDs from this list and generate one
      conv per selection
- [ ] Schedule batch: do not exceed ~30 generations/hour to stay under
      Sonnet rate limits
