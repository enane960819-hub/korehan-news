# Study Room Staging QA Checklist

Date: 2026-03-28 (UTC)

## 1) Free/Paid access and credits
- [ ] New free account receives 3 credits on first Study Room entry.
- [ ] First entry of the day consumes 1 credit and unlocks day-pass until midnight KST.
- [ ] If user enters after 23:00 KST, warning message is shown.
- [ ] If credits are 0 and no active pass, banner + route to `korehan-courses.html` appears.

## 2) Daily reset (KST)
- [ ] Access/pass state resets at 00:00 KST.
- [ ] Daily submission limit resets at 00:00 KST.

## 3) Topic / Grammar / Picture / Sentence stage flow
- [ ] Each stage transitions to DONE (not auto-submitted).
- [ ] Top-right checklist reflects DONE/TODO accurately.
- [ ] Picture Description and Sentence Writing show green checks when completed.
- [ ] Start Writing is blocked when no prior stage is completed.

## 4) Grammar Focus deep link and persistence
- [ ] Opening from article `?source=grammar-guide&focus=...` auto-opens Grammar Focus.
- [ ] Completing Grammar Focus updates per-user progress in DB.

## 5) Topic preview and admin editability
- [ ] Admin can open Study Room with `?preview_date=YYYY-MM-DD` up to 7 days ahead.
- [ ] Admin picture prompt CRUD works in `korehan-admin.html#study-picture-prompts`.
- [ ] Submitted homework list is visible and feedback can be saved from admin.

## 6) Submission constraints
- [ ] Submit button text: “Submit today’s writing practice”.
- [ ] One submission per day rule enforced.
- [ ] User can submit without completing all stages (as long as daily limit allows).

## Static QA command (implemented)
```bash
./scripts/study_room_qa.sh
```

> Note: Static QA validates guardrails in code; browser/manual staging QA is still required for full interaction checks.
