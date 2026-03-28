#!/usr/bin/env bash
set -euo pipefail

FILE="korehan/korehan-study-room.html"
ADMIN="korehan/korehan-admin.html"
MIG="supabase/migrations/20260328_study_room_restructure.sql"

pass(){ printf "[PASS] %s\n" "$1"; }
fail(){ printf "[FAIL] %s\n" "$1"; exit 1; }

contains(){
  local file="$1"; shift
  local pattern="$1"
  rg -n --fixed-strings "$pattern" "$file" >/dev/null 2>&1
}

contains "$FILE" "hour >= 23" && pass "KST 23시 경고 로직 존재" || fail "KST 23시 경고 로직 없음"
contains "$FILE" "_urlParams.get('source') === 'grammar-guide'" && pass "Grammar deep-link 처리 존재" || fail "Grammar deep-link 처리 없음"
contains "$FILE" ".eq('submit_date', today)" && pass "하루 1회 제출 제한 쿼리 존재" || fail "하루 1회 제출 제한 로직 없음"
contains "$FILE" "korehan-courses.html" && pass "크레딧 소진 시 course 이동 경로 존재" || fail "course 이동 경로 없음"
contains "$FILE" "preview_date" && pass "admin preview_date 처리 존재" || fail "admin preview_date 처리 없음"
contains "$ADMIN" "goStudyRoomOps" && pass "admin Study Room ops 진입 함수 존재" || fail "admin Study Room ops 없음"
for tbl in study_user_access study_daily_progress study_picture_prompts study_grammar_focus_items study_grammar_progress; do
  contains "$MIG" "$tbl" && pass "migration includes $tbl" || fail "migration missing $tbl"
done

echo "All static QA guards passed."
