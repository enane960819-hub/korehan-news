-- =============================================================================
-- D2 — conv_scenario_pool
-- Curated 84-scenario pool for the admin "Generate Conversations" tool.
-- =============================================================================
-- Schema + data, idempotent. Safe to re-run.
--
-- Consumed by korehan-x9f4k2m7.html (admin) — adds a "🎲 Pick from pool"
-- button that picks one unused (or least-used) scenario at the currently
-- selected level, fills the topic input, and increments use_count after
-- successful generation.
--
-- After running this SQL, also extend the admin <select id="cv-cat"> with
-- three new options ('service', 'korean-culture', 'conflict') so those
-- categories show up in the dropdown — handled in a separate HTML PR.
-- =============================================================================

CREATE TABLE IF NOT EXISTS conv_scenario_pool (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,                                -- matches cv-cat values
  level         CHAR(1) NOT NULL CHECK (level IN ('s','b','i','a')),
  ko_context    TEXT NOT NULL,                                -- 1-line Korean scenario brief
  use_count     INT NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conv_scenario_pool_pick_idx
  ON conv_scenario_pool (level, use_count, last_used_at NULLS FIRST)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS conv_scenario_pool_category_idx
  ON conv_scenario_pool (category)
  WHERE active = TRUE;

-- Anyone authenticated can read; only service_role writes (admin flow uses
-- the x-admin-bypass header on the Edge Function).
ALTER TABLE conv_scenario_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_scenario_pool_read ON conv_scenario_pool;
CREATE POLICY conv_scenario_pool_read ON conv_scenario_pool
  FOR SELECT USING (TRUE);

-- =============================================================================
-- 84 scenarios — ON CONFLICT (slug) DO NOTHING so re-runs are safe
-- =============================================================================

INSERT INTO conv_scenario_pool (slug, category, level, ko_context) VALUES
  -- ── 1. Everyday (12) ──────────────────────────────────────────────────────
  ('cafe-order',              'everyday', 'b', '카페에서 시그니처 메뉴 주문하기'),
  ('asking-directions',       'everyday', 'b', '지하철역에서 길 물어보기'),
  ('public-transit-card',     'everyday', 'b', '교통카드 충전이 안 될 때'),
  ('grocery-haggle',          'everyday', 'i', '시장에서 가격 흥정'),
  ('weather-smalltalk',       'everyday', 'b', '출근길 엘리베이터에서 날씨 잡담'),
  ('bank-open-account',       'everyday', 'i', '은행에서 외국인 계좌 개설'),
  ('pharmacy-cold',           'everyday', 'i', '약국에서 감기약 사기 (증상 설명)'),
  ('call-in-sick',            'everyday', 'i', '회사에 아파서 못 간다고 전화'),
  ('apartment-hunt',          'everyday', 'i', '부동산에서 원룸 찾기'),
  ('delivery-disagreement',   'everyday', 'i', '배달원과 배달 지연 협상'),
  ('customer-service-refund', 'everyday', 'i', '콜센터에 환불 요청'),
  ('noisy-neighbor',          'everyday', 'a', '옆집에 조용히 해달라고 부탁'),

  -- ── 2. Work (12) ──────────────────────────────────────────────────────────
  ('job-interview',           'work',     'i', '신입사원 면접 — 자기소개부터'),
  ('salary-nego',             'work',     'a', '연봉 협상 — 부장님과 1:1'),
  ('boss-1on1',               'work',     'i', '상사와 분기 1:1 미팅'),
  ('resign',                  'work',     'a', '사직 의사 전달 (정중하게)'),
  ('pitch-idea',              'work',     'i', '회의에서 새 프로젝트 제안'),
  ('cross-team-coord',        'work',     'i', '마케팅팀에 협업 요청'),
  ('perf-review',             'work',     'a', '인사평가 결과 면담'),
  ('onboarding-newhire',      'work',     'b', '신입사원 사수로 첫 인사'),
  ('missed-deadline',         'work',     'i', '마감 못 지킨 변명 + 재협상'),
  ('vacation-request',        'work',     'i', '연차 신청 — 거절될까봐 조마조마'),
  ('layoff-discussion',       'work',     'a', '정리해고 통보 받기'),
  ('networking-event',        'work',     'i', '업계 모임에서 첫 인사 + 명함 교환'),

  -- ── 3. Dating (9) ─────────────────────────────────────────────────────────
  ('first-date',              'dating',   'i', '소개팅 첫 만남 카페에서'),
  ('meet-parents',            'dating',   'a', '부모님 처음 뵙는 자리'),
  ('long-distance-call',      'dating',   'i', '장거리 연애 — 영상통화 갈등'),
  ('wedding-plan',            'dating',   'a', '결혼식 장소 두고 의견 충돌'),
  ('breakup',                 'dating',   'a', '헤어지자고 말하기'),
  ('anniversary-surprise',    'dating',   'i', '기념일 깜짝 이벤트 계획'),
  ('online-dating-msg',       'dating',   'i', '데이팅 앱 첫 메시지 교환'),
  ('proposal',                'dating',   'i', '프로포즈 순간'),
  ('post-fight-apology',      'dating',   'i', '다툰 다음 날 사과'),

  -- ── 4. Friends (7) ────────────────────────────────────────────────────────
  ('weekend-trip',            'friends',  'i', '주말 여행 계획 (KTX vs 자차)'),
  ('borrow-money',            'friends',  'i', '친구한테 돈 빌리기 (어색함)'),
  ('gossip-acquaintance',     'friends',  'i', '공통 지인 뒷담화 (반말)'),
  ('roommate-conflict',       'friends',  'i', '룸메이트 청소 분담 문제'),
  ('concert-tickets',         'friends',  'b', '콘서트 티켓팅 대신 부탁'),
  ('karaoke-night',           'friends',  'b', '노래방 가서 누가 먼저 부를지'),
  ('hospital-visit',          'friends',  'i', '입원한 친구 병문안'),

  -- ── 5. School (7) ─────────────────────────────────────────────────────────
  ('extension-request',       'school',   'a', '교수님께 과제 연장 요청'),
  ('group-project-coord',     'school',   'i', '조모임 일정 잡기 (단톡방)'),
  ('study-group',             'school',   'b', '시험기간 스터디 모집'),
  ('club-recruit',            'school',   'b', '동아리 새내기 환영회'),
  ('graduation-plans',        'school',   'i', '졸업 후 진로 — 친구끼리'),
  ('exchange-student',        'school',   'b', '교환학생 환영회 자기소개'),
  ('bullying-intervene',      'school',   'a', '학교폭력 목격 → 선생님께 신고'),

  -- ── 6. Travel (6) ─────────────────────────────────────────────────────────
  ('hotel-checkin',           'travel',   'b', '호텔 체크인 — 예약 확인'),
  ('lost-luggage',            'travel',   'i', '공항 분실물 신고'),
  ('currency-exchange',       'travel',   'b', '환전소 환율 협상'),
  ('tour-guide-qa',           'travel',   'i', '경복궁 가이드한테 질문'),
  ('resto-complaint-abroad',  'travel',   'i', '음식 잘못 나온 거 항의'),
  ('visa-office',             'travel',   'a', '출입국에서 비자 연장'),

  -- ── 7. Family (6) ─────────────────────────────────────────────────────────
  ('grandma-phone',           'family',   'i', '할머니랑 전화 (사투리 약간)'),
  ('sibling-fight',           'family',   'b', '동생이랑 게임기 두고 다툼'),
  ('aging-parent-care',       'family',   'a', '부모님 요양 시설 의논'),
  ('holiday-planning',        'family',   'i', '추석 차례상 분담 의논'),
  ('engagement-announce',     'family',   'a', '부모님께 결혼 발표'),
  ('inheritance',             'family',   'a', '형제간 유산 분배 갈등'),

  -- ── 8. Medical → health category (5) ──────────────────────────────────────
  ('er-visit',                'health',   'i', '응급실 접수 — 증상 빠르게 설명'),
  ('annual-checkup',          'health',   'i', '종합검진 결과 의사 상담'),
  ('mental-health-consult',   'health',   'a', '정신과 첫 상담'),
  ('dental-emergency',        'health',   'i', '치과 — 신경치료 비용 협상'),
  ('vet-visit',               'health',   'b', '동물병원 — 강아지 백신'),

  -- ── 9. Service (5) — NEW category ─────────────────────────────────────────
  ('hair-salon',              'service',  'i', '미용실에서 원하는 스타일 설명'),
  ('tailor-adjust',           'service',  'b', '양복점 — 기장 줄이기'),
  ('phone-plan-nego',         'service',  'i', '통신사 요금제 변경 협상'),
  ('internet-outage',         'service',  'i', '인터넷 안 됨 — 기사 출장 예약'),
  ('realtor-tour',            'service',  'i', '부동산 — 매물 보러 다니기'),

  -- ── 10. Korean cultural (10) — NEW category ───────────────────────────────
  ('hoesik-smalltalk',        'korean-culture', 'i', '회식에서 부장님 옆에 앉아 잡담'),
  ('chuseok-dinner',          'korean-culture', 'i', '추석 차례상 받고 친척 인사'),
  ('hagwon-enroll',           'korean-culture', 'i', '학원 등록 — 레벨 테스트 결과 상담'),
  ('military-visit',          'korean-culture', 'i', '면회 — 입대한 친구 만나러'),
  ('pocha-order',             'korean-culture', 'b', '포차에서 안주 추천 부탁'),
  ('sageuk-period',           'korean-culture', 'a', '사극 스타일 — 양반과 하인 대화'),
  ('apt-mgmt-office',         'korean-culture', 'i', '아파트 관리사무소에 누수 신고'),
  ('dongjumin-center',        'korean-culture', 'b', '동주민센터 — 전입신고'),
  ('karaoke-etiquette',       'korean-culture', 'b', '노래방 매너 — 마이크 양보'),
  ('concert-reserved-seat',   'korean-culture', 'i', '콘서트 — 지정석 자리 다툼'),

  -- ── 11. Conflict / drama (5) — NEW category ───────────────────────────────
  ('return-broken',           'conflict', 'i', '산 지 1주일 만에 고장난 노트북 반품'),
  ('late-apology',            'conflict', 'i', '1시간 늦은 약속 변명 + 사과'),
  ('refuse-request',          'conflict', 'i', '친구 결혼식 사회 요청 거절'),
  ('defend-friend',           'conflict', 'a', '친구가 부당하게 비난당할 때 변호'),
  ('misunderstanding',        'conflict', 'i', '오해 풀기 — "그게 아니라…"')
ON CONFLICT (slug) DO NOTHING;

-- Sanity: should be 84
-- SELECT COUNT(*) AS total, level, COUNT(*) FILTER (WHERE active) AS active_n FROM conv_scenario_pool GROUP BY level;

-- =============================================================================
-- Picker RPC — admin clicks "🎲 Pick from pool", we call this
-- =============================================================================
-- Picks the least-used active scenario at the requested level.
-- Caller MUST call mark_conv_scenario_used(slug) once generation succeeds.

CREATE OR REPLACE FUNCTION pick_conv_scenario(p_level CHAR(1))
RETURNS TABLE (
  slug        TEXT,
  category    TEXT,
  ko_context  TEXT,
  use_count   INT
)
LANGUAGE sql STABLE AS $$
  SELECT slug, category, ko_context, use_count
  FROM conv_scenario_pool
  WHERE active = TRUE AND level = p_level
  ORDER BY use_count ASC, last_used_at NULLS FIRST, random()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION mark_conv_scenario_used(p_slug TEXT)
RETURNS VOID
LANGUAGE sql AS $$
  UPDATE conv_scenario_pool
  SET use_count = use_count + 1,
      last_used_at = NOW()
  WHERE slug = p_slug;
$$;

-- Allow anyone authenticated to read the pool / call the picker.
-- The mark function is fine to expose: it's a single counter bump per slug.
GRANT SELECT ON conv_scenario_pool TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pick_conv_scenario(CHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_conv_scenario_used(TEXT) TO anon, authenticated;
