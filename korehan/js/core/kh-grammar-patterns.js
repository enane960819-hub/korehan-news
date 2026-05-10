// Korean grammar pattern detector — TOPIK 1-4 textbook patterns
// Regex-based, deterministic. Returns the patterns that appear in a
// sentence so the per-sentence analysis prompt can force the AI to
// explain each detected pattern (one entry per detection, no merging,
// no skipping).
//
// Exported as window.KH_GRAMMAR.detect(sentenceText) → array of:
//   { label: '~지 않다 (negation)', hint: '<short usage hint to feed model>' }
//
// Coverage philosophy:
//   - Catch the textbook fundamentals AI keeps skipping (negation,
//     past-polite, continuous, modifier, particles, irregular conjs,
//     common connectives + auxiliary verbs).
//   - Idioms / 사자성어 / 굳어진 표현 / less-common patterns are LEFT to
//     the AI (the model is good at those; the textbook stuff is what
//     it's bad at, and that's where we need code-level enforcement).
//
// Each entry has a regex + the canonical label. Order matters only
// for de-dup precedence (more specific patterns listed first so e.g.
// ~기 시작하다 wins over a bare ~기 nominalizer match).

(function() {
  'use strict';

  // Each pattern: { re, label, hint }
  // - re: RegExp matched against the sentence (whitespace-stripped form
  //       is also tested via _strip below to tolerate spacing variation).
  // - label: canonical pattern name (also doubles as the AI label).
  // - hint: 1-line usage description to feed the model so it doesn't
  //         have to guess the meaning of the pattern.
  var PATTERNS = [
    // ── Negation ─────────────────────────────────────────────────
    { re: /지\s*않(았|아|아요|았어요|았습니다|네|군|는|아도)/, label: '~지 않다', hint: 'long-form negation. <stem> + 지 않다 = "do not / be not"' },
    { re: /지\s*못(했|해|해요|했어요|했습니다|하)/, label: '~지 못하다', hint: 'long-form inability. <stem> + 지 못하다 = "cannot do"' },
    { re: /(?:^|\s|[.,?!])안\s+[가-힣]/, label: '안 + V/A', hint: 'short-form negation. 안 + verb/adjective = "not"' },
    { re: /(?:^|\s|[.,?!])못\s+[가-힣]/, label: '못 + V', hint: 'short-form inability. 못 + verb = "cannot"' },

    // ── Tense (sentence enders, past first since most specific) ─
    { re: /했어요(?=[^가-힣]|$)/, label: '했어요 (하다 past polite)', hint: '하다 verb past polite. 하다 → 했어요' },
    { re: /[가-힣](았|었|였)어요(?=[^가-힣]|$)/, label: '~았/었/였어요 (past polite)', hint: 'past polite ending. <stem> + 았/었/였어요. Vowel harmony: ㅏ/ㅗ → 았; else → 었; 하 → 했/하였. Vowel contraction: 보+았→봤, 오+았→왔, 되+었→됐, 마시+었→마셨' },
    { _check: function(t) { return _hasContractedPastEnding(t, '어요'); }, label: '~았/었/였어요 (past polite)', hint: 'past polite (vowel-contracted form). 보다→봤어요, 오다→왔어요, 되다→됐어요, 마시다→마셨어요. Stem vowel + 았/었 collapses into one syllable with ㅆ batchim.' },
    { re: /[가-힣](았|었|였)습니다(?=[^가-힣]|$)/, label: '~았/었/였습니다 (past formal)', hint: 'past formal-polite ending' },
    { _check: function(t) { return _hasContractedPastEnding(t, '습니다'); }, label: '~았/었/였습니다 (past formal)', hint: 'past formal-polite (vowel-contracted form). 보+았+습니다→봤습니다' },
    { re: /[가-힣](았|었)었/, label: '~았/었었 (past perfect)', hint: 'past perfect / earlier past. doubled past for "had done"' },
    { re: /[가-힣]ㄹ\s*거예요|[가-힣](을|ㄹ)\s*거예요/, label: '~ㄹ/을 거예요 (future)', hint: 'future tense polite. <stem> + ㄹ/을 거예요 = "will"' },
    { re: /[가-힣]겠(어요|습니다|네요|구나|지)/, label: '~겠 (intention/conjecture)', hint: 'intention or conjecture. "I will / probably is"' },
    { re: /[가-힣](아|어|여)요(?=[^가-힣]|$)/, label: '~아/어/여요 (present polite)', hint: 'present polite informal ending' },
    { re: /[가-힣](ㅂ니다|습니다)(?=[^가-힣]|$)/, label: '~ㅂ/습니다 (present formal)', hint: 'present formal-polite ending' },
    { re: /[가-힣]네요(?=[^가-힣]|$)/, label: '~네요 (discovery)', hint: 'realization / mild surprise. "oh, it is"' },
    { re: /[가-힣]군요(?=[^가-힣]|$)|[가-힣]구나(?=[^가-힣]|$)/, label: '~군요/~구나 (realization)', hint: 'realization / acknowledgement' },
    { re: /[가-힣]잖아요?(?=[^가-힣]|$)/, label: '~잖아(요) (as you know)', hint: 'asserting shared knowledge. "you know / obviously"' },
    { re: /[가-힣]지요?(?=[^가-힣]|$)|[가-힣]죠(?=[^가-힣]|$)/, label: '~지요/~죠 (confirming)', hint: 'seeking agreement / soft confirmation' },
    { re: /[가-힣]ㄹ까요\?|[가-힣]을까요\?/, label: '~ㄹ까요? (shall we / I wonder)', hint: 'suggestion or wondering. "shall we / do you think"' },
    { re: /[가-힣]ㄹ게요(?=[^가-힣]|$)|[가-힣]을게요(?=[^가-힣]|$)/, label: '~ㄹ게요 (I will, intent to listener)', hint: 'speaker promise / intention with listener awareness' },
    { re: /[가-힣]나요\?/, label: '~나요? (gentle question)', hint: 'soft polite question form' },
    { re: /[가-힣](으세요|세요)(?=[^가-힣]|$)/, label: '~(으)세요 (polite imperative/honorific)', hint: 'polite request OR subject honorific present' },

    // ── Auxiliary verbs (보조용언) ────────────────────────────────
    { re: /기\s*시작(했|해|하)/, label: '~기 시작하다 (start V-ing)', hint: 'begin doing. <stem> + 기 시작하다' },
    { re: /고\s*있(어|었|는|다|네|습)/, label: '~고 있다 (continuous)', hint: 'progressive aspect. "is V-ing"' },
    { re: /(아|어|여)\s*있(어|었|는|다|네|습)/, label: '~아/어 있다 (resultant state)', hint: 'resulting state from completed action. "remains V-ed"' },
    { re: /게\s*되(었|어|네|는|었어요|었습니다)/, label: '~게 되다 (come to / passive)', hint: 'become so / circumstance change. "comes to / ends up"' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*보(았|았어요|아|아요|세요|니|는|기|면|면서)/, label: '~아/어 보다 (try doing)', hint: 'attempt or experience. "try V-ing / have done". Includes vowel-contracted: 고려하다→고려해 보다, 보다→봐 보다, 가다→가 보다' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*주(었|어|어요|세요|시|니|는|기)/, label: '~아/어 주다 (do for)', hint: 'do as a favor for someone. Includes contracted: 도와주다→도와줘요, 해 주다' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*버리(었|어|네|기|어요)/, label: '~아/어 버리다 (do completely / regret)', hint: 'finish off / end up doing (often regret)' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*놓(았|아|네|아요|기|는다)/, label: '~아/어 놓다 (do in advance)', hint: 'do and leave the result for later' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*두(었|어|네|기|어요)/, label: '~아/어 두다 (do for later)', hint: 'do and store the result' },
    { re: /(아야|어야|여야|봐야|와야|줘야|둬야|매야|깨야|떼야|째야|쳐야|쪄야|져야|돼야|해야|펴야|켜야|셔야|쒀야|폐야)\s*(하|되|돼|한다|했|해|됐|됨|함)/, label: '~아/어야 하다/되다 (must)', hint: 'obligation. "have to / must". Includes vowel-contracted forms: 꿰매다→꿰매야 했어요, 하다→해야 해요, 되다→돼야 해요' },
    { re: /기로\s*하(다|기로\s*했|었|기로\s*해)/, label: '~기로 하다 (decide to)', hint: 'decide to do. "plan / decide"' },
    { re: /ㄴ\s*적(이|이\s*있|이\s*없)|은\s*적(이|이\s*있|이\s*없)/, label: '~ㄴ/은 적이 있다/없다 (have done before)', hint: 'experiential past. "have V-ed / never V-ed"' },
    { re: /[가-힣]\s*수\s*(있|없)/, label: '~(으)ㄹ 수 있다/없다 (ability/possibility)', hint: 'ability or possibility. <stem> + ㄹ/을 수 있다 = "can"; 없다 = "cannot". 옮기다 → 옮길 수 없다 = "cannot transmit"' },

    // ── Connectives ─────────────────────────────────────────────
    { re: /(아서|어서|여서|봐서|와서|줘서|둬서|매서|깨서|떼서|째서|쳐서|쪄서|져서|돼서|해서|펴서|켜서|셔서|쒀서|폐서)/, label: '~아/어서 (cause / sequence)', hint: 'reason or sequence. "because / and then". Includes vowel-contracted forms: 넘어지다→넘어져서, 보다→봐서, 되다→돼서, 하다→해서' },
    { re: /(니까|으니까)/, label: '~(으)니까 (reason)', hint: 'reason (more conversational than ~아서)' },
    { re: /기\s*때문(에|이|이다)/, label: '~기 때문에 (because)', hint: 'because. <stem> + 기 때문에' },
    { re: /(?<!기)[가-힣]\s*때문(에|이|이다)/, label: '~ 때문에 (because of N)', hint: 'because of (noun). <noun> + 때문에 = "because of / due to". 세균 때문에 = "because of the bacteria"' },
    // ~(으)면 must NOT swallow ~(으)면서 — the 서 alternative used to
    // be in the lookahead, which made every "가면서" / "들어가면서" fire
    // both ~(으)면 AND ~(으)면서. Now require the next char to be end-
    // of-string, whitespace, or punctuation (any continuation Hangul
    // including 서 lets the dedicated ~(으)면서 pattern win instead).
    { re: /(?:^|[가-힣])면(?:$|\s|[.,?!])/, label: '~(으)면 (if/when)', hint: 'conditional. "if / when"' },
    { re: /(다면)/, label: '~다면 (hypothetical if)', hint: 'hypothetical conditional. "if it were that"' },
    { re: /(면서|으면서)/, label: '~(으)면서 (while)', hint: 'simultaneous action. "while / as"' },
    { re: /다가(?=[^가-힣]|$)/, label: '~다가 (mid-action shift)', hint: 'doing X then Y / interrupted action' },
    { re: /(거나)/, label: '~거나 (or)', hint: 'alternative connective. "or"' },
    { re: /(려고|으려고)/, label: '~(으)려고 (intention)', hint: 'in order to / intending to' },
    { re: /기\s*위해서?/, label: '~기 위해(서) (in order to)', hint: 'purpose. "in order to / for the sake of"' },
    { re: /(러|으러)\s*(가|오|와|왔|갔|간|온|갈|올|갑|옵|감|옴|다니|다녔|다녀)/, label: '~(으)러 (purpose with movement)', hint: 'purpose verb + movement verb. <stem> + 러/으러 + 가다/오다 = "go/come to do". 보다 → 보러 가다, 보러 와요' },
    { re: /도록(?=[^가-힣]|$)/, label: '~도록 (so that / until)', hint: 'so that / extent / until' },
    { re: /[가-힣]지만(?=[^가-힣]|$)/, label: '~지만 (but)', hint: 'contrast. "but / however"' },
    { re: /(는데|ㄴ데|은데)(?=[^가-힣]|$)/, label: '~ㄴ/는데 (background/contrast)', hint: 'background or mild contrast (sets up next clause)' },
    { re: /(아도|어도|여도)(?=[^가-힣]|$)/, label: '~아/어도 (even if/though)', hint: 'concessive. "even if / even though"' },
    { re: /기는커녕/, label: '~기는커녕 (far from)', hint: 'far from doing. emphatic negation' },
    { re: /ㄹ수록|을수록/, label: '~(으)ㄹ수록 (the more)', hint: 'comparative correlation. "the more X, the more Y"' },
    { re: /고도(?=[^가-힣]|$)|면서도(?=[^가-힣]|$)/, label: '~고도 / ~면서도 (despite)', hint: 'despite doing / while still being' },

    // ── Modifiers (관형형) ───────────────────────────────────────
    // Labels intentionally do NOT include "+ N" — the AI was copying
    // the placeholder verbatim and emitting labels like "~는 개" or
    // "~ㄴ 동물" with the actual noun stuck on. Now labels are pure
    // morphemes; the prompt instructs the model to copy them as-is.
    { re: /[가-힣](하|되|이|아|어)는\s+[가-힣]/, label: '~는 (present verb modifier)', hint: 'verb modifying a noun (present). 하다 → 하는 + 책 = "the (book) that one does"' },
    { re: /[가-힣](ㄴ|은)\s+[가-힣]/, label: '~ㄴ/은 (past verb / present adj modifier)', hint: 'verb past OR adjective present modifying a noun. 보다 → 본; 작다 → 작은' },
    // Note: ~ㄹ/을 (future modifier) intentionally NOT detected by
    // regex. The pattern collides with object-particle 을/를 in
    // surface forms like "일을 하다" — both would match the same
    // chunk and the AI ends up labeling "일을" as future modifier
    // when it's really a noun + object particle. The ~을/를 object
    // detection below covers that case; AI can identify the rare
    // true future-modifier case from context.
    { re: /[가-힣]던\s+[가-힣]/, label: '~던 (retrospective modifier)', hint: 'past habitual / unfinished action modifying a noun. "the (X) that used to / was being"' },
    // ~게 (adverbializer) — converts adjective to adverb. Regex is intentionally
    // loose (any 게 followed by whitespace + Korean continuation) since adjective
    // stems are too varied to enumerate. False positives with the noun 게 (crab)
    // are rare in news copy. The hint deliberately spells out morpheme-role +
    // dictionary→surface chain so enforce-injected entries don't show up as
    // a bare chunk translation ("easily") — that's the bug class the AI keeps
    // hitting on its own.
    { re: /[가-힣]게(?=\s+[가-힣]|[.,!?])/, label: '~게 (adverbializer suffix)', hint: 'forms adverbs from adjectives. <adj-stem> + 게 = adverb. 쉽다 (easy) → 쉽게 (easily); 다르다 (different) → 다르게 (differently); 빠르다 → 빠르게 (quickly). NEVER write exp as just the English meaning of the chunk — explain the morpheme + show the dictionary→surface chain.' },

    // ── Derivational suffixes (sibling family of ~게) ───────────
    // Same exp-policy as ~게: explain the morpheme role and show a
    // dictionary→surface chain. The AI keeps defaulting to "translate
    // the chunk" for these short suffixes, so the canonical hint here
    // serves as the ground truth when enforce auto-injects them.
    { re: /[가-힣]히(?=\s|[.,!?]|$)/, label: '~히 (adverb suffix, Sino-Korean)', hint: 'adverbializer for Sino-Korean and a few native bases. 정확하다 → 정확히 (accurately); 조용하다 → 조용히 (quietly); 천천히 (slowly); 분명히 (clearly); 충분히 (sufficiently). Sibling of ~게 — different surface but same role.' },
    { re: /[가-힣](답다|답게|답고|답다고|답습니다|다워|다워요|다웠)/, label: '~답다 (befits / characteristic of)', hint: 'noun → adjective: <noun> + 답다 = "befits / acts like the role of". 학생답다 → 학생답게 (in a student-like way); 사람답다 (humanly); 봄답다 (spring-like).' },
    { re: /[가-힣](롭다|롭게|로워|로워요|로웠|로운)/, label: '~롭다 (-ous / adjective formative)', hint: 'noun → adjective for abstract qualities. 자유 → 자유롭다 → 자유롭게 (freely); 새 → 새롭다 → 새롭게 (newly); 여유롭다 (relaxed); 평화롭다 (peaceful).' },
    { re: /[가-힣](스럽다|스럽게|스러워|스러워요|스러웠|스러운)/, label: '~스럽다 (seems / has the quality of)', hint: 'noun/stem → adjective for evident qualities. 자연 → 자연스럽다 → 자연스럽게 (naturally); 조심 → 조심스럽다 → 조심스럽게 (carefully); 사랑스럽다 (lovely).' },
    { re: /[가-힣]적(이다|이에요|입니다|이|인|으로|으로\s)/, label: '~적 (-ic / -al adjective suffix)', hint: 'Sino-Korean noun → adjective. <noun> + 적 = "-ic / -al / -ive". Forms: 적이다 (predicate), 적인 N (modifier), 적으로 (adverb). 일반적 (general); 효과적 (effective); 경제적 (economic).' },
    { re: /[가-힣]화(되|하|된|한|돼|됨|함|되었|되었어|되어|됩니다|합니다)/, label: '~화하다/~화되다 (-ization / -ize)', hint: 'Sino-Korean noun → verb. <noun> + 화 = "-ization"; + 하다/되다 = "-ize / become -ized". 디지털화 (digitalization), 산업화 (industrialization), 자동화하다 (automate).' },

    // ── Modal / aspectual collocations ──────────────────────────
    { re: /[가-힣]게\s*(하|했|해|한|함|할|한다|만들|만든|만드|만들었|만들어|만들고|만들면|만들기|시키|시킨|시켜|시켰|시킬)/, label: '~게 하다 (causative)', hint: 'periphrastic causative. <stem> + 게 하다 / 게 만들다 / 게 시키다 = "make / cause X to". 알게 하다 (let know); 가게 하다 (make go); 슬프게 하다 (make sad); 약하게 만들다 (make weak); 약하게 만든다 (makes weak — declarative). Different from morphological causatives like 알리다, 보이다.' },
    { _check: function(t) { var c = _hasJongFollowedBy(t, 8, ['만하', '만한', '만했', '만해']); if (c) return c; var m = t.match(/[가-힣]을\s*만(하|한|했|해)/); return m ? m[0] : ''; }, label: '~(으)ㄹ 만하다 (worth doing)', hint: 'value/possibility. <stem> + ㄹ/을 만하다 = "worth -ing / can manage". 볼 만하다 (worth seeing); 살 만하다 (livable); 먹을 만하다 (edible).' },
    { _check: function(t) { var c = _hasJongFollowedBy(t, 8, ['뻔']); if (c) return c; var m = t.match(/[가-힣]을\s*뻔/); return m ? m[0] : ''; }, label: '~(으)ㄹ 뻔하다 (almost did)', hint: 'near-miss. <stem> + ㄹ/을 뻔했다 = "almost V-ed / nearly". 죽을 뻔했어요 (almost died); 넘어질 뻔했어요 (almost fell).' },
    { re: /[가-힣](는|은)\s*척\s*(하|한|했|해요)/, label: '~ㄴ/는 척하다 (pretend to)', hint: 'feigning. <stem> + ㄴ/는 척하다 = "pretend to / act as if". 모르는 척하다 (pretend not to know); 자는 척하다 (pretend to sleep).' },
    { _check: function(t) { return _hasJongFollowedBy(t, 4, ['척하', '척한', '척했']); }, label: '~ㄴ/는 척하다 (pretend to)', hint: 'feigning (ㄴ-batchim modifier form). 안 그런 척하다 (pretend not to be).' },
    { _check: function(t) { var c = _hasJongFollowedBy(t, 8, ['까 봐', '까봐', '까봤', '까 봤']); if (c) return c; var m = t.match(/[가-힣]을까\s*(봐|봐서|봤)/); return m ? m[0] : ''; }, label: '~(으)ㄹ까 봐 (worry that / lest)', hint: 'apprehension. <stem> + ㄹ/을까 봐 = "worried that / in case". 늦을까 봐 (afraid of being late); 비가 올까 봐 (in case it rains).' },
    { _check: function(t) { var c = _hasJongFollowedBy(t, 8, ['줄 알', '줄 모르', '줄 아', '줄 몰라', '줄알', '줄모르']); if (c) return c; var m = t.match(/[가-힣]을\s*줄\s*(알|모르|아|몰라)/); return m ? m[0] : ''; }, label: '~(으)ㄹ 줄 알다/모르다 (know how / expect)', hint: 'skill or expectation. <stem> + ㄹ/을 줄 알다 = "know how to / think that". 운전할 줄 알다 (know how to drive); 올 줄 알았어요 (I thought you\'d come).' },
    { re: /[가-힣](듯이|듯)(?=\s|[.,!?]|$)/, label: '~듯이 / ~듯 (as if / like)', hint: 'simile. <stem> + 듯이 = "as if / just like". 비가 오듯이 (as if it\'s raining); 알듯이 (as you know); 흐르듯 (as if flowing).' },
    { re: /[가-힣](는|을)\s*듯(하|한|해|했|해요)/, label: '~ㄴ/는/(으)ㄹ 듯하다 (seems)', hint: 'conjecture, softer than ~것 같다. 비가 오는 듯해요 (seems to be raining); 어려울 듯해요 (will likely be hard).' },
    { _check: function(t) { return _hasJongFollowedBy(t, 4, ['듯하', '듯한', '듯해']) || _hasJongFollowedBy(t, 8, ['듯하', '듯한', '듯해']); }, label: '~ㄴ/는/(으)ㄹ 듯하다 (seems)', hint: 'conjecture (ㄴ/ㄹ-batchim modifier forms). 끝난 듯해요 (seems to have ended); 어려울 듯해요.' },
    { re: /[가-힣]기\s*(쉽|쉬|어렵|어려|좋아|좋|싫어|싫|편하|편해|불편하|불편해)/, label: '~기 쉽다/어렵다/좋다 (easy/hard/good to V)', hint: 'evaluation collocation. <stem> + 기 + 쉽다/어렵다/좋다/싫다 = "easy/hard/good/unpleasant to V". Includes ㅂ-irregular forms (쉬워요, 어려워요). 배우기 쉽다 (easy to learn); 알기 어렵다 (hard to know); 보기 좋다 (looks good).' },
    { _check: function(t) { var c = _hasJongFollowedBy(t, 8, ['텐데']); if (c) return c; var m = t.match(/[가-힣]을\s*텐데/); return m ? m[0] : ''; }, label: '~(으)ㄹ 텐데 (would be / probably)', hint: 'speaker conjecture with follow-up clause. <stem> + ㄹ/을 텐데 = "probably / I imagine... but". 힘들 텐데 (must be tough); 비쌀 텐데 (would be expensive).' },
    { re: /[가-힣](ㄴ가|은가|나)\s*(보|봐|봤|봅니다)/, label: '~ㄴ/은가 보다, ~나 보다 (seems / I guess)', hint: 'inferential. <stem> + ㄴ가/나 보다 = "I guess / seems". 좋은가 봐요 (seems good); 가나 봐요 (I guess he\'s going).' },

    // ── Additional connectives ──────────────────────────────────
    { re: /[가-힣]던지(?=[^가-힣]|$)/, label: '~던지 (whether / however)', hint: 'past indirect question / concessive. 어떻던지 (however it is); 가든지 말든지 (whether to go or not).' },
    { re: /[가-힣]다가는(?=[^가-힣]|$)/, label: '~다가는 (if you keep V-ing → bad)', hint: 'warning. <stem> + 다가는 = "if you keep V-ing (bad outcome)". 그렇게 먹다가는 살쪄요 (if you keep eating like that, you\'ll gain weight).' },
    { re: /[가-힣](는|은)\s*데다(가)?(?=[^가-힣]|$)/, label: '~ㄴ/는 데다(가) (in addition)', hint: 'addition. <stem> + ㄴ/는 데다(가) = "on top of / and what\'s more". 비싼 데다 맛도 없어요 (expensive AND not tasty).' },
    { _check: function(t) { return _hasJongFollowedBy(t, 4, ['데다', '데다가']); }, label: '~ㄴ/는 데다(가) (in addition)', hint: 'addition (ㄴ-batchim modifier form). 비싼 데다 (on top of being expensive).' },
    { re: /[가-힣](는|은)\s*김에/, label: '~ㄴ/는 김에 (while at it)', hint: 'opportunistic. <stem> + ㄴ/는 김에 = "since / while you\'re at it". 가는 김에 (while you\'re going); 일어난 김에 (since I\'m up).' },
    { _check: function(t) { return _hasJongFollowedBy(t, 4, ['김에']); }, label: '~ㄴ/는 김에 (while at it)', hint: 'opportunistic (ㄴ-batchim modifier form). 일어난 김에 (since I\'m up).' },

    // ── Additional particles ────────────────────────────────────
    { re: /[가-힣]조차(?=[^가-힣]|$)/, label: '~조차 (even — emphasis)', hint: 'emphatic inclusion, often negative. <noun> + 조차 = "even / not even". 너조차 (even you); 나조차 모른다 (even I don\'t know).' },
    { re: /[가-힣]마저(?=[^가-힣]|$)/, label: '~마저 (even / the last)', hint: 'inclusive of the last/least expected. <noun> + 마저 = "even / on top of all that". 너마저 (even you of all people).' },
    { re: /[가-힣]밖에(?=[^가-힣]|$)/, label: '~밖에 (only / nothing but) [+negative]', hint: 'exclusive — pairs with negative verb (안/없/모르). <noun> + 밖에 + neg = "only / nothing but". 천 원밖에 없어요 (I only have 1000 won).' },
    { re: /[가-힣]씩(?=[^가-힣]|$)/, label: '~씩 (each / per)', hint: 'distributive. <number/amount> + 씩 = "each / per". 한 명씩 (one by one); 매일 한 시간씩 (an hour each day).' },
    { _check: function(t) {
      var m = t.match(/[가-힣]이나(?=\s|[.,!?])/);
      if (m) return m[0];
      // Bare ~나 after a vowel-ending syllable (no batchim, jong=0) followed
      // by space/punct. The vowel-ending requirement excludes verb stems like
      // 만나, 혼나, 가나(요). Also explicitly skip "하나" (the cardinal number
      // "one") — 하 ends in vowel + 나 + space matches the pattern but in
      // surface form 하나 is almost always the numeral, not the ~(이)나
      // particle. False-positive carrier especially for "X 중 하나" / "한 개".
      for (var i = 0; i < t.length - 1; i++) {
        if (_jong(t.charAt(i)) !== 0) continue;
        if (t.charAt(i + 1) !== '나') continue;
        var nxt = t.charAt(i + 2) || '';
        if (!(nxt === '' || /[\s.,!?]/.test(nxt))) continue;
        var pair = t.charAt(i) + '나';
        if (pair === '하나') continue; // numeral, not particle
        // Skip when preceded by 중/한/한두/두/세/네/몇 + space — these mark
        // "one of N" / counting contexts where 나 is the numeral suffix,
        // not the particle. e.g. "중 하나", "한 개나 두 개나" — the latter
        // actually IS the particle but rare; favouring precision over recall.
        var prevWord = t.substr(Math.max(0, i - 3), 3);
        if (/(중|한|두|세|네|몇)\s$/.test(prevWord)) continue;
        return pair;
      }
      return '';
    }, label: '~(이)나 (or / about / as much as)', hint: 'alternation, approximation, or surprising quantity. After consonant-ending nouns: 이나 (책이나). After vowel-ending nouns: 나 (커피나, 차나). 커피나 차 (coffee or tea); 열 명이나 (as many as 10); 하루나 이틀 (a day or two).' },
    { re: /[가-힣]라도(?=[^가-힣]|$)|[가-힣]이라도(?=[^가-힣]|$)/, label: '~(이)라도 (even / at least)', hint: 'concessive selection. <noun> + (이)라도 = "even / at least / something like". 물이라도 (at least water); 누구라도 (anyone).' },

    // ── Particles ─────────────────────────────────────────────
    { re: /[가-힣](을|를)(?:\s|[가-힣])/, label: '~을/를 (object marker)', hint: 'direct object particle. attaches to noun' },
    { re: /[가-힣](이|가)\s/, label: '~이/가 (subject marker)', hint: 'subject particle. attaches to noun' },
    { re: /[가-힣](은|는)\s/, label: '~은/는 (topic marker)', hint: 'topic particle. attaches to noun (contrastive or topical)' },
    { re: /[가-힣]에서(?=[^가-힣]|$)/, label: '~에서 (location/source)', hint: 'at/in (location of action) or from (source)' },
    { re: /[가-힣]에게(?=[^가-힣]|$)|[가-힣]한테(?=[^가-힣]|$)/, label: '~에게/한테 (to person)', hint: 'indirect object marker for animate' },
    { re: /[가-힣]께(?:서)?(?=[^가-힣]|$)/, label: '~께(서) (honorific dative/subject)', hint: 'honorific marker for elders/superiors' },
    { re: /[가-힣]에\s/, label: '~에 (location/time)', hint: 'static location / time / direction' },
    { re: /[가-힣](으로|로)\s/, label: '~(으)로 (means/direction)', hint: 'instrument / direction / means' },
    { re: /[가-힣](과|와)\s/, label: '~과/와 (with/and)', hint: 'with / and (formal)' },
    { re: /[가-힣]하고\s/, label: '~하고 (with/and, conv)', hint: 'with / and (conversational)' },
    { re: /[가-힣]부터(?=[^가-힣]|$)/, label: '~부터 (from)', hint: 'starting from (time / sequence)' },
    { re: /[가-힣]까지(?=[^가-힣]|$)/, label: '~까지 (until)', hint: 'up to / until' },
    { re: /[가-힣]만\s|[가-힣]만\.|[가-힣]만$/, label: '~만 (only)', hint: 'limiter. "only / just"' },
    { re: /[가-힣]도\s|[가-힣]도\.|[가-힣]도$/, label: '~도 (also)', hint: 'inclusive. "also / too"' },
    { re: /[가-힣]의\s/, label: '~의 (possessive)', hint: 'possessive / attributive' },
    { re: /[가-힣]보다(?=[^가-힣]|$)/, label: '~보다 (comparison)', hint: 'comparative. "than / more than"' },

    // ── Quoted speech ───────────────────────────────────────────
    { re: /(다고|ㄴ다고|는다고)\s*(하|했|해|말|알려|전해|보도|밝혀|밝혔|밝히|강조|지적|주장|발표|언급|덧붙|평가|설명|판단|진단|분석|예측|전망|호소|토로|항변|반박|시인|부인)/, label: '~다고 하다 / ~다고 밝히다 / ~다고 강조하다 (indirect declarative + news reporting verbs)', hint: 'reported speech (declarative) — the news-paper "(X) said / stated / emphasized / pointed out / argued / announced / revealed / explained / analyzed / projected (that)" frame. <quote> + 다고 + {하다 / 밝히다 / 강조하다 / 지적하다 / 주장하다 / 발표하다 / 언급하다 / 덧붙이다 / 평가하다 / 설명하다 / 분석하다 / 전망하다}. Polite: ~다고 해요 / ~다고 밝혔어요. 만든다고 해요 = "they say it makes …"; 발표할 것이라고 밝혔다 = "(they) revealed that they will announce".' },
    { re: /라고\s*(하|했|해|말|불|부|알려|전해|밝혀|밝혔|밝히|강조|지적|주장|발표|언급|덧붙|평가|설명)/, label: '~(이)라고 하다 / ~(이)라고 밝히다 (indirect copula/name + news reporting)', hint: 'reported identification, naming, or stated quote. <noun/quote> + (이)라고 + {하다 / 밝히다 / 강조하다 / 발표하다 / 알려지다}. 학생이라고 해요 = "(they) say (he) is a student"; 사실이라고 밝혔다 = "(they) revealed that it\'s true".' },
    // ~(이)라고 / ~(ㄴ)다고 할 수 있다 — "can be called / can be said to be".
    // Distinct from plain ~(이)라고 하다 (just naming/quoting). This is a
    // hedged classification ("X may be considered Y / X qualifies as Y"),
    // very common in academic and formal Korean. Same pattern family
    // covers ~라고 볼 수 있다 (can be seen as) and ~라고 말할 수 있다.
    { re: /(라고|다고|ㄴ다고|는다고)\s*(할|볼|말할|얘기할|일컬을)\s*수\s*(있|없)/, label: '~(이)라고 / ~(ㄴ)다고 할 수 있다 (can be called / can be said to be)', hint: 'hedged classification or qualified assertion. <noun/quote> + (이)라고/(ㄴ)다고 + {할 / 볼 / 말할 / 얘기할 / 일컬을} + 수 있다 = "can be called / may be considered / can be said to be / can be seen as". Different from plain ~(이)라고 하다 (just naming) — this version softens to a tentative classification often seen in news, op-eds, and academic prose. 주민들이라고 할 수 있다 = "can be called residents"; 성공이라고 볼 수 있다 = "can be seen as a success"; 새로운 시대라고 말할 수 있다.' },
    // ~(이)라고 해도 과언이 아니다 — emphatic "no exaggeration to say".
    { re: /(라고|다고|ㄴ다고|는다고)\s*해도\s*과언이?\s*(아니|아닙)/, label: '~(이)라고 해도 과언이 아니다 (it\'s no exaggeration to say)', hint: 'emphatic assertion via litotes. <quote> + 라고/다고 + 해도 과언이 아니다 = "it\'s no exaggeration to say (that)". Common rhetorical device in op-eds. 혁명이라고 해도 과언이 아니다 = "it\'s no exaggeration to call it a revolution".' },
    { re: /냐고\s*(하|했|해|물|여쭤)/, label: '~냐고 하다 / ~냐고 해요 (indirect question)', hint: 'reported question. Polite: 냐고 해요 / 물어봐요. 가냐고 해요 = "(they) are asking whether (X) goes".' },
    { re: /자고\s*(하|했|해|제안|권유)/, label: '~자고 하다 / ~자고 해요 (indirect proposal)', hint: 'reported suggestion / let\'s. 가자고 해요 = "(they) suggest going / say let\'s go".' },
    { re: /달라고(?=[^가-힣]|$)|주라고(?=[^가-힣]|$)/, label: '~달라고/주라고 (request)', hint: 'reported request / asking for something' },
    // Contracted reported speech — ~다고 해요 → ~대요, ~라고 해요 → ~래요,
    // ~냐고 해요 → ~냬요, ~자고 해요 → ~재요. Very common in news/casual
    // Korean. ~ㄴ대요 / ~는대요 require ㄴ-jongseong on the prior syllable
    // (한대요 = 하 + ㄴ-jong + 대요), so use _check + _hasJongFollowedBy.
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 4, ['대요', '대.', '대,', '대?', '대!', '답니다', '답니까', '대네', '대네요', '대지', '대지요']);
        if (c) return c;
        var m = t.match(/[가-힣](랍니다|랍니까|래요|래\.|래,|래\?|랜다|냬요|냬\.|냬\?|쟤요|쟤\.|쟤\?)/);
        return m ? m[0] : '';
      }, label: '~다고 해(요) → ~대(요) (contracted reported speech)', hint: 'contracted reported speech (extremely common in news headlines and casual Korean). ~ㄴ다고 해요 → ~ㄴ대요 (한다고 해요 → 한대요), ~ㄴ다고 합니다 → ~ㄴ답니다, ~라고 해요 → ~래요 (학생이라고 해요 → 학생이래요), ~냐고 해요 → ~냬요, ~자고 해요 → ~재요. Always relays what someone else said. 만든대요 = 만든다고 해요 ("they say it makes"); 한답니다 = 한다고 합니다.' },

    // ── Nominalizers ───────────────────────────────────────────
    { re: /[가-힣]는\s*것(?=[^가-힣]|$)/, label: '~는 것 (the thing of V-ing)', hint: 'verbal nominalizer (present). makes verb a noun phrase' },
    { re: /[가-힣]ㄴ\s*것(?=[^가-힣]|$)|[가-힣]은\s*것(?=[^가-힣]|$)/, label: '~ㄴ/은 것 (the thing V-ed)', hint: 'past verbal noun phrase' },
    { re: /[가-힣](ㄴ|는|을)\s*것\s*같(다|아|네|군)/, label: '~ㄴ/는/을 것 같다 (seems)', hint: 'conjecture. "seems like"' },
    { re: /[가-힣]기\s*(가|를|에|로|보다|쉽|어렵|좋|싫)/, label: '~기 (nominalizer)', hint: 'verbal noun. <stem> + 기 used as noun' },

    // ── Common fixed expressions ────────────────────────────────
    { re: /에\s*따르면(?=[^가-힣]|$)/, label: '~에 따르면 (according to)', hint: 'evidential. "according to"' },
    { re: /에\s*대해서?(?=[^가-힣]|$)|에\s*대한(?=[^가-힣]|$)/, label: '~에 대해(서)/대한 (about)', hint: 'topical. "about / regarding"' },
    { re: /에\s*의해서?(?=[^가-힣]|$)|에\s*의한(?=[^가-힣]|$)/, label: '~에 의해(서)/의한 (by, passive)', hint: 'passive agent. "by / by means of"' },
    { re: /을\s*통해서?(?=[^가-힣]|$)|를\s*통해서?(?=[^가-힣]|$)/, label: '~을/를 통해(서) (through)', hint: 'medium / channel. "through / by way of"' },
    { re: /을\s*위해서?(?=[^가-힣]|$)|를\s*위해서?(?=[^가-힣]|$)/, label: '~을/를 위해(서) (for the sake of)', hint: 'beneficiary / purpose' },
    { re: /을\s*위한(?=[^가-힣]|\s)|를\s*위한(?=[^가-힣]|\s)/, label: '~을/를 위한 (for) [adnominal]', hint: 'attributive form of ~을 위해. modifies a following noun. "for the sake of N". 학생들을 위한 책 = "books for students"' },
    { re: /(으로|로)\s*이어(지|졌|진|져)/, label: '~(으)로 이어지다 (lead to / result in)', hint: 'causation/result. <noun> + (으)로 이어지다 = "lead to / result in / be linked to". 노력이 결과로 이어졌어요 = "efforts led to results"' },
    { re: /(으로|로)\s*인(해|한|하여)/, label: '~(으)로 인해/인한 (due to)', hint: 'causation. <noun> + (으)로 인해 = "due to / because of"' },
    { re: /에\s*대한\s*[가-힣]/, label: '~에 대한 N (about/regarding N) [adnominal]', hint: 'attributive form. <noun> + 에 대한 + <noun> = "the X about Y". ~에 대한 관심 = "interest in"' },
    { re: /을\s*비롯한(?=[^가-힣]|$)|를\s*비롯한(?=[^가-힣]|$)/, label: '~을/를 비롯한 (including)', hint: 'inclusive listing. "including / starting with"' },
    { re: /과\s*관련(된|하여|해서)(?=[^가-힣]|$)|와\s*관련(된|하여|해서)(?=[^가-힣]|$)/, label: '~과/와 관련된 (related to)', hint: 'connection. "related to / regarding"' },
    { re: /의\s*경우(?=[^가-힣]|$)/, label: '~의 경우 (in the case of)', hint: 'case-specifying. "in the case of"' },
    { re: /만에(?=[^가-힣]|$)/, label: '~만에 (after a duration)', hint: 'time-elapsed pattern. "after X time"' },
    { re: /(ㄴ|은)\s*채(로)?(?=[^가-힣]|$)/, label: '~ㄴ/은 채(로) (while in state)', hint: 'remaining state. "while still / leaving as"' },
    { re: /에도\s*불구하고(?=[^가-힣]|$)/, label: '~에도 불구하고 (despite)', hint: 'concession. "despite / in spite of"' },
    { re: /에\s*따라서?(?=[^가-힣]|$)/, label: '~에 따라(서) (depending on / as)', hint: 'variation/dependence. "depending on / according to"' },
    { re: /(ㄴ|는)\s*가운데(?=[^가-힣]|$)/, label: '~ㄴ/는 가운데 (amid)', hint: 'background context. "amid / while"' },
    { re: /(ㄴ|는)\s*반면(에)?(?=[^가-힣]|$)/, label: '~ㄴ/는 반면(에) (on the other hand)', hint: 'contrast clause. "whereas / on the other hand"' },
    { re: /(ㄴ|는)\s*한(?=[^가-힣]|$)/, label: '~ㄴ/는 한 (as long as)', hint: 'conditional limit. "as long as"' },
    { re: /기\s*마련이/, label: '~기 마련이다 (bound to)', hint: 'inevitability. "is bound to / naturally"' },
    { re: /(중|중에)\s*(하나|한\s*명|한\s*가지|두|세|몇)/, label: '~ 중 하나 (one of)', hint: 'one of (a group). <group> + 중 하나 = "one of the". 비싼 나라 중 하나예요 = "is one of the expensive countries"' },
    { re: /(는|ㄴ|은|을|ㄹ)\s*것이?\s*좋(다|아|아요|겠|겠어요|겠습니다)/, label: '~는 것이 좋다/좋겠다 (it would be good to)', hint: 'recommendation/advice. <stem> + 는 것이 좋다/좋겠다 = "it is/would be good to V". 고려해 보는 것이 좋겠어요 = "it would be good to consider"' },
    { re: /(는|ㄴ|은|을|ㄹ)\s*편이/, label: '~는 편이다 (tend to)', hint: 'tendency. "tends to be / is rather"' },
    // ~ㄴ/는/던 대로 / 만큼. The original regex missed ~던 대로
    // ("원했던 대로 / 들었던 만큼"), which is one of the most common
    // retrospective forms in news copy. Optional leading Hangul pulls
    // the verb stem into the example chunk so learners see "했던 대로"
    // instead of just "던 대로".
    { re: /[가-힣]?(는|ㄴ|은|던)\s*(대로|만큼)/, label: '~ㄴ/는/던 대로 / ~만큼 (as / according to / to the extent)', hint: 'manner or extent. <stem> + ㄴ/는/던 대로 = "as / according to what (was)"; <stem> + ㄴ/는/던 만큼 = "as much as". 원했던 대로 ("just as one wished"); 들은 대로 ("as one heard"); 노력한 만큼 ("as much as one tried").' },
    { re: /ㄴ\s*셈이|은\s*셈이/, label: '~ㄴ/은 셈이다 (amounts to)', hint: 'roughly equivalent to. "amounts to / can be counted as"' },

    // ── Passive / change-of-state ───────────────────────────────
    // ~아/어지다 (passive, "becomes") attaches to action verbs to form
    // a passive, and to adjectives to mean "becomes X". Extremely common
    // in news and academic Korean. Vowel-contracted forms covered by the
    // ~아/어 alternation list mirroring ~아/어 보다.
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*지(다|는|었|어|어요|었어요|면|면서|기|ㄴ|ㄹ|니|니까|고)/, label: '~아/어지다 (passive / become)', hint: 'passive or change-of-state. <action-stem> + 아/어지다 = passive ("gets V-ed"); <adj-stem> + 아/어지다 = "becomes <adj>". 만들어지다 (be made / get made); 좋아지다 (become good / improve); 약해지다 (weaken — get weak). Includes contracted: 보다 → 보아지다 → 봐져요.' },

    // ── News-register patterns (TOPIK 3-5, very high frequency in
    // articles). These are the patterns that surface every paragraph
    // of any news/op-ed copy — passives of evaluation verbs, future-
    // expectation forms, scope quantifiers, news reporting frame
    // verbs, and a handful of high-value TOPIK 3-4 connectives that
    // were missing from the earlier "textbook fundamentals" focus.
    // Each entry is news-validated; conservative regexes keep false-
    // positive risk low.

    // Evaluative passives (X로 보이다 / 추정되다 / 분석되다 / 평가되다 /
    // 드러나다 / 나타나다 / 판단되다)
    { re: /(으로|로)\s*(보이|보였|보인다|추정되|추정됐|추정된|추정될|분석되|분석됐|분석된|분석될|판단되|판단됐|판단된|판단될|평가되|평가됐|평가된|평가될|드러나|드러났|드러난|나타나|나타났|나타난|확인되|확인됐|확인된|확인될|관측되|관측됐|관측된)/, label: '~(으)로 보이다 / 추정되다 / 분석되다 / 평가되다 (news evaluative passives)', hint: 'news-register evaluative passives. <noun/clause> + (으)로 + 보이다 / 추정되다 / 분석되다 / 판단되다 / 평가되다 / 드러나다 / 나타나다 / 확인되다 / 관측되다 = "appears to be / is estimated / is analyzed / is judged / is evaluated as / turns out to be / is confirmed". Pervasive in news copy.' },

    // ~로 알려지다 / 알려져 있다
    { re: /(으로|로)\s*알려(져|졌|진|지|집|짐)/, label: '~(으)로 알려지다 / 알려져 있다 (be known as)', hint: 'passive of 알리다. <noun/clause> + (으)로 알려지다 = "is known / reported / understood as". 명소로 알려져 있다 = "is known as a famous place"; 사실로 알려졌다 = "was revealed to be true".' },

    // ~ㄹ 전망이다 / 계획이다 / 방침이다 / 예정이다 — formal future intent
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['전망', '계획', '방침', '예정']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*(전망|계획|방침|예정)/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 전망이다 / 계획이다 / 방침이다 / 예정이다 (is expected / planned to)', hint: 'formal news-register future intent. <stem> + (으)ㄹ {전망 / 계획 / 방침 / 예정}이다 = "is expected / is planning / is policy / is scheduled to". 발표할 전망이다 (is expected to announce); 추진할 계획이다 (plans to push forward); 시행될 예정이다 (is scheduled to take effect).' },

    // ~ㄹ 것으로 보이다 / 예상되다 / 기대되다 / 관측되다
    { re: /(ㄹ|을)\s*것으로\s*(보이|보였|보인다|예상되|예상됐|예상된|예상될|기대되|기대됐|기대된|기대될|관측되|관측됐|관측된|관측될|전망되|전망됐|전망된)/, label: '~(으)ㄹ 것으로 보이다 / 예상되다 / 기대되다 (is expected / projected to)', hint: 'projected outcome in news. <stem> + (으)ㄹ 것으로 + {보이다 / 예상되다 / 기대되다 / 관측되다 / 전망되다} = "is expected / anticipated / projected to". 증가할 것으로 보입니다 (is expected to increase); 회복될 것으로 예상됩니다.' },

    // ~에 그치다 / ~에 달하다 (statistic floor/ceiling)
    { re: /[가-힣]에\s*(그치|그쳤|그칠|그친|그친다|그칩)/, label: '~에 그치다 (only / merely reaches)', hint: 'limitation. <amount/state> + 에 그치다 = "only reaches / stops at / is limited to". Common with statistics: 5%에 그쳤다 (only reached 5%); 권고에 그쳤다 (was limited to a recommendation).' },
    { re: /[가-힣]에\s*(달하|달했|달할|달한|달한다|달합)/, label: '~에 달하다 (reach / amount to)', hint: 'attainment of a level. <amount/state> + 에 달하다 = "reaches / amounts to". 100억 원에 달한다 = "amounts to 10 billion won".' },

    // ~을 둘러싸고 / 둘러싼 (the topic of a dispute or focus)
    { re: /(을|를)\s*둘러싸?(고|ㄴ|싸인|싼|싸고는)/, label: '~을/를 둘러싸고 / ~을/를 둘러싼 (over / surrounding)', hint: 'topic of dispute or focus. <noun> + 을/를 둘러싸고 = "over / surrounding / regarding (the issue of)"; ~을/를 둘러싼 + N = "surrounding the …". 정책을 둘러싼 논란 (controversy surrounding the policy).' },

    // ~을 비롯해(서) / ~을 비롯하여 — the verbal cousin of the existing
    // 비롯한 (line for adjective-modifier form). Both surface in news.
    { re: /(을|를)\s*비롯(해|하여|해서)(?=[^가-힣]|$)/, label: '~을/를 비롯해(서) / 비롯하여 (including / starting with)', hint: 'inclusive listing — verbal form. <head-noun> + 을/를 비롯해(서) + <other items> = "including X (along with Y, Z)". 한국을 비롯해 일본, 중국 (Korea, along with Japan and China).' },

    // ~기보다(는/도) — preference comparison
    { re: /기보다(는|도)?(?=[^가-힣]|$)/, label: '~기보다(는) (rather than)', hint: 'comparison preference. <stem> + 기보다(는) = "rather than V-ing". 가기보다는 머무르고 싶어요 = "I\'d rather stay than go"; 비판하기보다 응원하다 = "to support rather than criticize".' },

    // ~ㄹ 뿐(이다) — exclusive limitation
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['뿐']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*뿐/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 뿐(이다) (only / merely)', hint: 'exclusive limitation. <stem> + (으)ㄹ 뿐(이다) = "only / merely / nothing more than". 노력할 뿐이다 (only does (one\'s) best); 듣고 있을 뿐 (just listening).' },

    // ~ㄹ 따름이다 — emphatic limitation
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['따름']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*따름/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 따름이다 (nothing but / can only)', hint: 'emphatic limitation, slightly more formal than ~ㄹ 뿐이다. <stem> + (으)ㄹ 따름이다 = "nothing more than / merely / can only". 감사할 따름입니다 (I can only be grateful).' },

    // ~ㄹ 뿐(만) 아니라 — additive emphasis (in prompt floor list, no regex)
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['뿐만 아니라', '뿐 아니라', '뿐만아니라', '뿐아니라']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*뿐(만)?\s*아니라/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 뿐(만) 아니라 (not only / on top of)', hint: 'addition emphasis. <stem> + (으)ㄹ 뿐만 아니라 = "not only X (but also Y)". 빠를 뿐만 아니라 정확하다 (not only fast but also accurate); 비싼 뿐만 아니라 맛도 없다.' },

    // ~ㄴ/는/(으)ㄹ 대신(에) — substitution
    { re: /(는|ㄴ|은|을|ㄹ)\s*대신(에)?(?=[^가-힣]|$)/, label: '~ㄴ/는/(으)ㄹ 대신(에) (instead of / in exchange for)', hint: 'substitution. <stem> + ㄴ/는/(으)ㄹ 대신(에) = "instead of / in exchange for". 가는 대신에 (instead of going); 일찍 일어난 대신 일찍 자다 (in exchange for waking early, sleeps early).' },

    // ~지 않을 수 없다 — cannot but
    { re: /지\s*않을\s*수\s*없/, label: '~지 않을 수 없다 (cannot but)', hint: 'double negation = strong assertion. <stem> + 지 않을 수 없다 = "cannot help but / must necessarily". 인정하지 않을 수 없다 (cannot but admit); 감동하지 않을 수 없다 (cannot help being moved).' },

    // ~(으)려던 참이다 — was just about to
    { re: /(려던|으려던)\s*참이/, label: '~(으)려던 참이다 (was just about to)', hint: 'imminent past intention. <stem> + (으)려던 참이다 = "was just about to V". 나가려던 참이었어요 (I was just about to leave); 전화하려던 참이다.' },

    // ~게 마련이다 — variant of ~기 마련이다 (existing line catches only 기)
    { re: /게\s*마련이/, label: '~게 마련이다 (bound to / naturally)', hint: 'inevitability variant. <adverb> + 게 마련이다 = "is naturally / is bound to be". 시간이 가게 마련이다 = "time is bound to pass".' },

    // ~(으)ㄹ 정도(이다/로) — degree marker (in prompt floor, no regex)
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['정도', '정도로', '정도이', '정도였']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*정도/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 정도(이다/로) (to the extent)', hint: 'degree marker. <stem> + (으)ㄹ 정도로 = "to the extent that"; ~ㄹ 정도이다 = "is to the degree of". 울 정도로 슬프다 (sad enough to cry); 믿기 어려울 정도이다 (is to the point of being hard to believe).' },

    // ~기 십상이다 — likely / prone to (often negative outcome)
    { re: /기\s*십상이/, label: '~기 십상이다 (likely / prone to)', hint: 'likelihood, often of a negative outcome. <stem> + 기 십상이다 = "easily ends up / is likely to". 잊어버리기 십상이다 (easily ends up forgotten); 다치기 십상이다 (is prone to getting hurt).' },

    // ~다는 / ~ㄴ다는 / ~는다는 / ~라는 + N — quoted attributive
    { re: /(ㄴ다는|는다는|다는|라는)\s+[가-힣]/, label: '~ㄴ/는다는 / ~라는 + N (the claim/fact/idea that)', hint: 'attributive of reported speech — turns a quoted clause into a noun-modifier. <quote> + ㄴ/는다는 / 라는 + <noun> = "the (idea/fact/claim/news) that …". 그렇게 한다는 사실 (the fact that (he) does so); 학생이라는 점 (the point that he\'s a student); 회복된다는 소식 (the news that (X) recovers).' },

    // ~ㄴ/는 점(에서/이/도) — aspect introducer (in prompt floor, no regex)
    { re: /(ㄴ|는|은|을)\s*점(에서|이|도|만|을|은|에|마저|조차)?(?=[^가-힣]|\s|[,.!?])/, label: '~ㄴ/는 점(에서) (in the point that / aspect)', hint: 'aspect / point introducer. <clause> + ㄴ/는 점(에서) = "in the aspect/point that". 환경을 보호한다는 점에서 = "in the respect that it protects the environment"; 가능하다는 점이 (the point that it\'s possible).' },

    // ~기를 바라다 / 원하다 — hope/desire
    { re: /기를?\s*(바라|바랐|바랍|바람|원하|원했|원합|원한|원함|희망)/, label: '~기(를) 바라다 / 원하다 (hope / want to)', hint: 'desire. <stem> + 기를 + {바라다 / 원하다 / 희망하다} = "hopes / wants / wishes to V". 성공하기를 바랍니다 (I hope (you) succeed); 가기를 원해요 (wants to go).' },

    // ~ㄹ 수밖에 없다 — already at line 71 covers ~ㄹ 수 있/없; this is
    // the inevitability sense. Existing ~지 않을 수 없다 above is its
    // double-negation cousin.
    { re: /[가-힣]\s*수밖에\s*없/, label: '~(으)ㄹ 수밖에 없다 (have no choice but)', hint: 'inevitability / no alternative. <stem> + (으)ㄹ 수밖에 없다 = "have no choice but to / cannot help but". 받아들일 수밖에 없다 (have no choice but to accept); 인정할 수밖에 없었다.' },

    // ~로 이루어지다 / 구성되다 — structural composition
    { re: /(으로|로)\s*(이루어|이루어져|이루어진|이루어졌|구성되|구성된|구성됐|구성될|구성)/, label: '~(으)로 이루어지다 / 구성되다 (be made up of / consist of)', hint: 'composition. <noun(s)> + (으)로 이루어지다 / 구성되다 = "is made up of / consists of". 5개 위원회로 구성되었다 (consisted of 5 committees); 학생들로 이루어진 모임 (a gathering made up of students).' },

    // ── TOPIK 3-5 comprehensive sweep (60+ patterns) ────────────
    // Audit pass after the news-register block. Goal: stop forcing
    // the user to flag patterns one-by-one. Grouped by category;
    // each entry tested for false-positive risk before commit.

    // ── Time / sequence connectives ─────────────────────────────
    { re: /(는|ㄴ|은)\s*동안(에)?(?=[^가-힣]|$)/, label: '~ㄴ/는 동안(에) (while / during)', hint: 'duration during which something happens. <stem> + ㄴ/는 동안(에) = "while / during the time that". 자는 동안에 (while sleeping); 회의가 진행되는 동안 (during the meeting).' },
    { re: /기\s*전에(?=[^가-힣]|$)/, label: '~기 전에 (before V-ing)', hint: 'time-before. <stem> + 기 전에 = "before V-ing". 떠나기 전에 (before leaving); 식사하기 전에 (before eating).' },
    { re: /(ㄴ|은)\s*(후에|뒤에)(?=[^가-힣]|$)/, label: '~ㄴ/은 후에 / 뒤에 (after V-ing)', hint: 'time-after. <stem> + ㄴ/은 + 후에/뒤에 = "after having V-ed". 떠난 후에 (after leaving); 끝난 뒤에.' },
    { re: /(는|ㄴ|은)\s*사이(에)?(?=[^가-힣]|$)/, label: '~ㄴ/는 사이(에) (in the time between / while)', hint: 'time-during span. <stem> + ㄴ/는 사이(에) = "during / while / in the time between". 잠깐 자는 사이에 (in the brief time of sleeping); 부재중인 사이에 (during my absence).' },
    { re: /(는|ㄴ|은)\s*동시에(?=[^가-힣]|$)/, label: '~ㄴ/는 동시에 (at the same time as)', hint: 'simultaneity. <stem> + ㄴ/는 동시에 = "at the same time as / simultaneously with". 발표하는 동시에 (simultaneously with announcing); 결정된 동시에 시행됐다.' },
    { re: /(는|ㄴ|은)\s*한편(?=[^가-힣]|\s|[,.])/, label: '~ㄴ/는 한편 (meanwhile / on the other hand)', hint: 'parallel/contrast clause. <stem> + ㄴ/는 한편 = "meanwhile / while on the other hand". 회복되는 한편 (recovering on the other hand); 비판하는 한편 응원하다.' },
    { re: /(는|ㄴ|은)\s*와중에(?=[^가-힣]|$)/, label: '~ㄴ/는 와중에 (in the midst of)', hint: 'in the middle of (often chaotic) something. <stem> + ㄴ/는 와중에 = "in the midst of / amid". 사고가 일어난 와중에 (in the midst of the accident).' },
    { re: /고\s*나서(?=[^가-힣]|$)/, label: '~고 나서 (after V-ing)', hint: 'sequence after completion. <stem> + 고 나서 = "after V-ing (and completing it)". 식사하고 나서 (after eating); 끝내고 나서 가자.' },
    { re: /[가-힣]고서(?=[^가-힣]|\s|[,.])/, label: '~고서 (having V-ed)', hint: 'sequence with completion emphasis. <stem> + 고서 = "having V-ed (then)". 듣고서 결정했다 (decided after hearing).' },
    { re: /고서야(?=[^가-힣]|\s|[,.])/, label: '~고서야 (only after V-ing)', hint: 'only-after-completion. <stem> + 고서야 = "only after V-ing (does/did) …". 다 듣고서야 이해했다 (understood only after hearing it all).' },
    { re: /곤\s*(하|했|해|한)/, label: '~곤 하다 (used to / repeatedly does)', hint: 'habitual past or repeated action. <stem> + 곤 하다 = "used to / would often". 만나곤 했다 (used to meet); 가곤 한다 (often goes).' },

    // ── Cause / blame / credit ──────────────────────────────────
    { re: /(는|ㄴ|은)\s*통에(?=[^가-힣]|$)/, label: '~ㄴ/는 통에 (because of — negative)', hint: 'negative-outcome cause (often blamed). <stem> + ㄴ/는 통에 = "because of (the disturbance/bother of)". 비가 오는 통에 늦었다 (was late because of the rain).' },
    { re: /(는|ㄴ|은)\s*탓(에|이|이다|으로)?(?=[^가-힣]|$)/, label: '~ㄴ/는 탓에 / ~ㄴ/은 탓이다 (because of / fault of)', hint: 'negative cause attribution. <stem> + ㄴ/는 탓에 = "because of / due to (the fault of)"; ~탓이다 = "is the fault of". 늦은 탓에 (because (he) was late); 환경 탓이다 (is the environment\'s fault).' },
    { re: /(ㄴ|은)\s*덕(분에|분이다|으로|택에)?(?=[^가-힣]|$)/, label: '~ㄴ/은 덕분에 / 덕분이다 (thanks to)', hint: 'positive cause attribution. <stem> + ㄴ/은 덕분에 = "thanks to / owing to". 도와준 덕분에 (thanks to (your) help); 노력한 덕분이다 (is thanks to (one\'s) efforts).' },
    { re: /(ㄴ|은)\s*끝에(?=[^가-힣]|$)/, label: '~ㄴ/은 끝에 (after / finally as a result)', hint: 'culmination after extended effort. <stem> + ㄴ/은 끝에 = "after (finally) / at the end of". 고민한 끝에 (after long deliberation); 토론한 끝에 결정됐다.' },
    { re: /(ㄴ|은)\s*결과(?=[^가-힣]|\s|[,.])/, label: '~ㄴ/은 결과 (as a result)', hint: 'outcome of action. <stem> + ㄴ/은 결과 = "as a result of having V-ed". 조사한 결과 (as a result of investigating); 노력한 결과 성공했다.' },
    { re: /(ㄴ|은)\s*나머지(?=[^가-힣]|$)/, label: '~ㄴ/은 나머지 (as a consequence of being so)', hint: 'extreme-state consequence. <stem> + ㄴ/은 나머지 = "as a result of being so / so X that …". 흥분한 나머지 (in his excitement); 놀란 나머지 말을 잃었다.' },
    { re: /[가-힣]기에\s+[가-힣]/, label: '~기에 (formal because — written register)', hint: 'formal cause connector. <stem> + 기에 = "because / since (formal)". 학생이기에 (because he\'s a student); 비싸기에 사지 않았다.' },
    { re: /[가-힣]길래(?=[^가-힣]|\s|[,.])/, label: '~길래 (because — colloquial / spoken)', hint: 'spoken/informal cause connector, often after observing something. <stem> + 길래 = "since / because (I saw/heard)". 비가 오길래 (since it was raining); 맛있다길래 사봤다.' },

    // ── Concession / contrast ───────────────────────────────────
    { re: /[가-힣]으나(?=\s+[가-힣]|[,])/, label: '~(으)나 (but / however — formal)', hint: 'formal contrast connector. <stem> + (으)나 = "but / however / yet". 노력했으나 실패했다 (tried but failed); 비싸나 좋다.' },
    { re: /(는데도|ㄴ데도|은데도)(?=[^가-힣]|\s|[,.])/, label: '~ㄴ/는데도 (even though)', hint: 'concession. <stem> + ㄴ/는데도 = "even though / despite". 비가 오는데도 갔다 (went even though it was raining); 늦은데도 와줬다.' },
    { re: /(다고|ㄴ다고|는다고|라고)\s*(해도|치더라도)/, label: '~다고/라고 해도 (even if / supposing)', hint: 'concession via reported clause. <quote> + 다고 해도 = "even if (one says/assumes) that". 비싸다고 해도 (even if it\'s expensive); 사실이라고 해도.' },

    // ── Combined / parallel purpose ─────────────────────────────
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['겸']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*겸/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 겸 (combined purpose)', hint: 'combined purposes. <stem₁> + (으)ㄹ 겸 + <stem₂> + (으)ㄹ 겸 = "to V₁ and also V₂ / serving both purposes". 산책할 겸 운동할 겸 (both for a walk and for exercise); 점심 먹을 겸 만나자.' },

    // ── Aspectual / progressive ─────────────────────────────────
    { re: /[가-힣](중이|중인|중에는|중에|중입|중)\s/, label: '~중이다 / ~중인 (in the middle of / ongoing)', hint: 'aspectual "in the middle of". <noun-V> + 중이다 = "is in the middle of"; 중인 + N = "X-ing (modifier)". 회의 중이다 (is in a meeting); 진행 중인 사업 (an ongoing project).' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['작정']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*작정/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 작정이다 (intend / plan to)', hint: 'firm intention. <stem> + (으)ㄹ 작정이다 = "intend / plan / am set on V-ing". 떠날 작정이다 (intends to leave); 끝낼 작정이었다.' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['모양이', '모양인']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*모양이/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 모양이다 (seems like / looks like)', hint: 'inferred conjecture. <stem> + (으)ㄹ 모양이다 = "seems like / looks like (will V)". 비가 올 모양이다 (looks like it\'ll rain); 화난 모양이다 (seems angry).' },

    // ── Auxiliary attempt / futility / extreme ──────────────────
    { re: /(아|어|여|봐|와|줘|둬|매|쳐|져|돼|해|펴|켜|셔|가|사|자|차|타|서|짜|패|배)\s*봐야(?=[^가-힣]|\s)/, label: '~아/어 봐야 (no matter how / even if you V)', hint: 'futility despite trying. <stem> + 아/어 봐야 = "no matter how V / even if (you) V (it doesn\'t help)". 노력해 봐야 (no matter how hard you try); 가 봐야 소용없다 (no point even going); 사 봐야 (even if you buy).' },
    { re: /(아|어|여|봐|와|줘|둬|매|쳐|져|돼|해|펴|켜|셔|가|사|자|차|타|서|짜|패|배)\s*봤자(?=[^가-힣]|\s)/, label: '~아/어 봤자 (no point in / even if)', hint: 'futility marker (stronger than 봐야). <stem> + 아/어 봤자 = "no point V-ing / even if you V". 가 봤자 (no point going); 말해 봤자 소용없다.' },
    { re: /(아|어|여|봐|와|줘|매|쳐|져|돼|해|펴|켜|셔)\s*죽(겠|을|겠어|겠습)/, label: '~아/어 죽겠다 (dying to / extremely — colloquial)', hint: 'colloquial extreme-degree. <stem> + 아/어 죽겠다 = "dying of / extremely / can\'t stand X". 배고파 죽겠다 (starving to death); 보고 싶어 죽겠다 (dying to see).' },
    { re: /(아야지|어야지|여야지|해야지|돼야지|봐야지|와야지)(요)?(?=[^가-힣]|\s|[.!?]|$)/, label: '~아/어야지(요) (should / will (resolve))', hint: 'self-resolve or gentle obligation. <stem> + 아/어야지(요) = "should / will (definitely) V / oughta V". 해야지요 (you really should); 가야지 (I should go).' },
    { re: /기는\s*(하|했|해|한)/, label: '~기는 하다 (do indeed but)', hint: 'concessive admission. <stem₁> + 기는 + <stem₁> + 다 = "(does) V₁ indeed (but)". 알기는 안다 (I know but); 가기는 가지만 (will go, but).' },
    { re: /기로\s*(결정|약속|마음|예정|확정|결심|선언|합의)/, label: '~기로 결정/약속/마음먹다/합의하다 (decide/promise/resolve to)', hint: 'firm choice expressed via 기로 + commitment verb. <stem> + 기로 + 결정하다 / 약속하다 / 마음먹다 / 예정이다 / 확정하다 / 합의하다 = "decide/promise/resolve/agree to V". 가기로 결정했다; 만나기로 약속했다; 폐지하기로 합의했다.' },

    // ── Habitual / quality predicates ───────────────────────────
    { re: /기\s*일쑤이/, label: '~기 일쑤이다 (often does — habitual)', hint: 'habitual (often unwanted) frequency. <stem> + 기 일쑤이다 = "is in the habit of V-ing (often)". 잊어버리기 일쑤이다 (often forgets); 늦기 일쑤이다.' },
    { re: /기\s*나름이/, label: '~기 나름이다 (depends on how V)', hint: 'outcome depends on the manner of V-ing. <stem> + 기 나름이다 = "depends on how (one) V-s". 생각하기 나름이다 (depends on how you think about it); 하기 나름이다 (depends on how you do it).' },
    { re: /기\s*짝이\s*없/, label: '~기 짝이 없다 (extremely / unparalleled)', hint: 'extreme-degree (often negative). <stem> + 기 짝이 없다 = "is V to no compare / extremely". 안타깝기 짝이 없다 (extremely regrettable); 부끄럽기 짝이 없다.' },
    { re: /기\s*그지없/, label: '~기 그지없다 (boundlessly / endlessly)', hint: 'unlimited-degree marker. <stem> + 기 그지없다 = "is boundlessly / endlessly V". 안타깝기 그지없다 (endlessly regrettable); 기쁘기 그지없다.' },

    // ── Suggestion / obligation / prohibition ───────────────────
    { re: /지\s*그래(요)?(?=[^가-힣]|\s|\?)/, label: '~지 그래(요)? (why don\'t you?)', hint: 'soft suggestion. <stem> + 지 그래(요)? = "why don\'t you V?". 한번 가지 그래요? (why don\'t you go once?); 쉬지 그래?' },
    { re: /(으면|면)\s*안\s*(되|돼|된|됐|돼요|됩)/, label: '~(으)면 안 되다 (must not / shouldn\'t)', hint: 'prohibition. <stem> + (으)면 안 되다 = "must not / it\'s not OK to V". 늦으면 안 돼요 (you mustn\'t be late); 만지면 안 됩니다.' },
    { re: /지\s*않으면\s*안\s*(되|돼|된|됐|돼요|됩)/, label: '~지 않으면 안 되다 (must / have to)', hint: 'double-negative obligation = "must". <stem> + 지 않으면 안 되다 = "(I) must / have no choice but to V". 가지 않으면 안 된다 (have to go).' },

    // ── Wish / hypothetical ─────────────────────────────────────
    // ~았/었으면 좋겠다. Generic ㅆ-jongseong + 으면 좋겠 catch covers
    // every contracted past form (했으면, 됐으면, 봤으면, 갔으면, 왔으면,
    // 쳤으면, 졌으면, 컸으면, 썼으면, etc.) without enumerating each verb.
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, JONG_SS, ['으면 좋겠', '으면좋겠', '으면 좋', '으면좋']);
        if (c) return c;
        var m = t.match(/(았|었|였)으면\s*좋(겠|을|아)/);
        return m ? m[0] : '';
      }, label: '~았/었으면 좋겠다 (would like / I wish)', hint: 'wish or desire (counterfactual softener). <stem> + 았/었으면 좋겠다 = "would be nice if / I wish". 비가 왔으면 좋겠다 (I wish it would rain); 빨리 그쳤으면 좋겠어요 (I wish it would stop quickly).' },

    // ── Sentence enders ─────────────────────────────────────────
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['걸요', '걸.', '걸,', '걸?', '걸!']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*걸(요)?(?=[^가-힣]|\s|[.!?]|$)/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ걸(요) (probably / I bet)', hint: 'soft conjecture. <stem> + (으)ㄹ걸(요) = "probably / I bet (X)". 비가 올걸요 (it\'ll probably rain); 알고 있을걸 (he probably knows).' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['걸 그랬', '걸 그래']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*걸\s*(그랬|그래)/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ걸 그랬다 (should have / regret)', hint: 'past regret. <stem> + (으)ㄹ걸 그랬다 = "should have V-ed (regret not doing)". 갈걸 그랬다 (I should have gone); 미리 알릴걸 그랬어요.' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['까 하', '까하']);
        if (c) return c;
        var m = t.match(/[가-힣]을까\s*(하|했|해|한)/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ까 하다 (think about V-ing)', hint: 'tentative consideration. <stem> + (으)ㄹ까 하다 = "thinking about V-ing / considering (V)". 갈까 해요 (thinking of going); 그만둘까 했다 (thought about quitting).' },
    { re: /(다지요?|라지요?)(?=[^가-힣]|\s|[.?!]|$)/, label: '~다지(요) / ~라지(요) (I hear / they say)', hint: 'reported information softener. <quote> + 다지요 / 라지요 = "I hear that / they say (right?)". 곧 도착한다지요 (I hear they\'re arriving soon).' },
    { re: /(다네|다더라|라더라|라네)(?=[^가-힣]|\s|[.!?]|$)/, label: '~다네 / ~다더라 / ~라더라 (I hear — informal)', hint: 'casual informational hearsay. <quote> + 다네 / 다더라 / 라더라 = "I hear / heard that (informal)". 결혼한다네 (I hear (he\'s) getting married); 비가 온다더라.' },
    { re: /다잖(아|아요|니|니까|소)/, label: '~다잖아(요) (I told you / they\'re saying)', hint: 'reminder via reported speech. <quote> + 다잖아(요) = "I told you / they ARE saying that". 못 한다잖아 (he\'s saying he can\'t); 비싸다잖아요.' },
    { re: /(다고요|라고요|냐고요|자고요)(\?|!|\.|$|\s)/, label: '~다고요? / ~라고요? (you say?)', hint: 'echo question / disbelief. <quote> + 다고요 / 라고요 + ? = "(you\'re saying) X?". 진짜로 간다고요? (you\'re really going?).' },
    { re: /[가-힣](ㅂ니까|습니까)(?=[^가-힣]|\s|[?.])/, label: '~ㅂ/습니까? (formal question)', hint: 'highly formal question. <stem> + ㅂ/습니까? = "(do/are) you V?". 가십니까? (are you going?); 알고 있습니까?' },

    // ── Particles ───────────────────────────────────────────────
    { re: /[가-힣](로서|으로서)(?=[^가-힣]|\s|[,.])/, label: '~(으)로서 (as a role / qualification)', hint: 'role/status marker. <noun> + (으)로서 = "as a / in the role/capacity of". 학생으로서 (as a student); 의장으로서 발언했다 (spoke as the chair). Distinct from ~(으)로써.' },
    { re: /[가-힣](로써|으로써)(?=[^가-힣]|\s|[,.])/, label: '~(으)로써 (by means of / by V-ing)', hint: 'means/instrument marker (formal, narrower than ~(으)로). <noun> + (으)로써 = "by means of / using"; <stem> + ㅁ으로써 = "by V-ing". 노력으로써 (by means of effort); 함으로써 (by doing).' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 16, ['으로써']);
        if (c) return c;
        var m = t.match(/[가-힣]ㅁ으로써|[가-힣]음으로써/);
        return m ? m[0] : '';
      }, label: '~(으)ㅁ으로써 (by V-ing — formal)', hint: 'formal nominalized "by V-ing". <stem> + (으)ㅁ으로써 = "by V-ing / through V-ing". 참여함으로써 (by participating); 시행됨으로써 (by being implemented).' },
    { re: /만\s*해도(?=[^가-힣]|\s|[,.])/, label: '~만 해도 (just considering / X alone)', hint: 'singling-out emphasis. <noun> + 만 해도 = "X alone is enough / just considering X". 어제만 해도 (just yesterday alone); 한 사람만 해도 (just one person alone).' },
    { re: /(는|ㄴ|은)\s*데(에)?(?=\s+[가-힣]|[,.])/, label: '~ㄴ/는 데(에) (in V-ing / for V-ing)', hint: 'purpose/situation marker. <stem> + ㄴ/는 데(에) = "in V-ing / for V-ing". 공부하는 데 도움이 된다 (helps in studying); 사는 데 어려움이 있다 (has trouble in living).' },
    { re: /[가-힣]\s*따위(?=[^가-힣]|\s|[,.])/, label: '~따위 (such as / things like — often disparaging)', hint: 'enumerative or disparaging "things like". <noun> + 따위 = "things like / such as (often dismissive)". 너 따위가 (someone like you); 책 따위는 안 봐.' },
    { re: /에\s*한(해|해서|한)(?=[^가-힣]|\s|[,.])/, label: '~에 한해(서) (limited to)', hint: 'restriction marker. <noun> + 에 한해(서) = "limited to / only in the case of". 회원에 한해 (only for members); 오늘에 한해서.' },
    { re: /에\s*상관없이(?=[^가-힣]|\s|[,.])/, label: '~에 상관없이 (regardless of)', hint: 'irrespective-of marker. <noun> + 에 상관없이 = "regardless of / irrespective of". 나이에 상관없이 (regardless of age); 결과에 상관없이.' },

    // ── Fixed expressions / news (additional) ───────────────────
    { re: /(을|를)\s*향(해|해서|한)(?=[^가-힣]|\s|[,.])/, label: '~을/를 향해(서) / 향한 (toward / aimed at)', hint: 'direction or aim. <noun> + 을/를 향해(서) = "toward / heading to"; ~을/를 향한 + N = "X aimed at". 미래를 향해 (toward the future); 평화를 향한 노력.' },
    { re: /(을|를)\s*막론(하고|한)(?=[^가-힣]|\s|[,.])/, label: '~을/를 막론하고 (regardless of)', hint: 'all-encompassing inclusion. <noun> + 을/를 막론하고 = "regardless of / no matter what". 남녀노소를 막론하고 (regardless of age or gender).' },
    { re: /(을|를)\s*무릅쓰(고|면|는|ㄴ|ㄹ)/, label: '~을/를 무릅쓰고 (despite the risk / braving)', hint: 'braving difficulty. <noun> + 을/를 무릅쓰고 = "despite / braving (the risk of)". 위험을 무릅쓰고 (braving the danger); 비를 무릅쓰고.' },
    { re: /(을|를)\s*가지고(?=[^가-힣]|\s|[,.])/, label: '~을/를 가지고 (with / using / about)', hint: 'instrumental or topical marker. <noun> + 을/를 가지고 = "with / using / about". 그것을 가지고 (with that / about that); 돈을 가지고 뭐 할까?' },
    { re: /(을|를)\s*두고(?=[^가-힣]|\s|[,.])/, label: '~을/를 두고 (over / regarding)', hint: 'topic-of-discussion marker. <noun> + 을/를 두고 = "over / regarding / about (the matter of)". 정책을 두고 논쟁이 벌어졌다 (debate broke out over the policy).' },
    { re: /(을|를)\s*거치(다|는|ㄴ|었|어|면|면서|고|기|는데)/, label: '~을/를 거치다 (go through / via)', hint: 'transit / process marker. <noun> + 을/를 거치다 = "go through / pass via". 검토를 거치다 (go through review); 일본을 거쳐 (via Japan).' },
    { re: /(을|를)\s*차지(하|한|했|할|함|해)/, label: '~을/를 차지하다 (account for / occupy)', hint: 'occupy/take-up marker. <noun> + 을/를 차지하다 = "accounts for / occupies / takes up". 절반을 차지하다 (accounts for half); 1위를 차지했다 (took 1st place).' },
    { re: /(다는|라는)\s*입장(이|이다|입니다|을|에서)/, label: '~다는/라는 입장이다 (the position that)', hint: 'stated stance via reported speech. <quote> + 다는/라는 입장이다 = "(holds the) position that". 반대한다는 입장이다 (holds the position of opposing); 문제없다는 입장입니다.' },
    { re: /(으로|로)\s*전해(져|졌|진|지)/, label: '~(으)로 전해지다 (be reported / passed down)', hint: 'passive of 전하다 — informational passive. <noun/clause> + (으)로 전해지다 = "is reported / handed down as". 사실로 전해진다 (is reported as fact).' },
    { re: /[가-힣]\s*기록(하|되|된|될|했|됐|할|함)/, label: '기록하다 / 기록되다 (record / be recorded)', hint: 'news-statistic verb. <noun> + 기록하다 / 기록되다 = "(X) records / is recorded as". 신기록을 기록하다 (sets a new record); 역대 최고로 기록됐다 (was recorded as the highest ever).' },
    { re: /의\s*일종(이|이다|입니다|으로|이라)/, label: '~의 일종이다 (is a kind / type of)', hint: 'classification marker. <noun> + 의 일종이다 = "is a kind / type of (X)". 운동의 일종이다 (is a kind of exercise); 사기의 일종으로 분류된다 (is classified as a kind of fraud).' },

    // ── Honorifics ──────────────────────────────────────────────
    { re: /(으셨|셨)(어요|습니다|네|군|는)/, label: '~(으)셨 (honorific past)', hint: 'subject honorific past tense' },
    { re: /(으십시오|십시오)(?=[^가-힣]|$)/, label: '~(으)십시오 (formal imperative)', hint: 'highly formal command' },

    // ── Irregular conjugations ──────────────────────────────────
    { re: /(들었|들어|들으|걸었|걸어|걸으|물었|물어|물으|실었|실어|실으|깨달았|깨달아|깨달으|일컬었|일컬어|일컬으|불었|불어|불으|싣었|싣어|싣으)/, label: 'ㄷ 불규칙 (ㄷ → ㄹ before vowel)', hint: 'ㄷ-irregular: 듣다→들어/들었/들으면, 걷다→걸어/걸으면, 묻다→물어/물으면' },
    { re: /(도와|도왔|추워|추웠|더워|더웠|즐거워|어려워|쉬워|매워|차가워|뜨거워)/, label: 'ㅂ 불규칙 (ㅂ → 우/오)', hint: 'ㅂ-irregular: 돕다→도와, 춥다→추워, 덥다→더워' },
    { re: /(예뻐|바빠|기뻐|슬퍼|아파|커|꺼|모아|써)\s|예뻤|바빴|기뻤|슬펐|아팠|컸|껐|모았|썼/, label: 'ㅡ 탈락 (ㅡ drops before 아/어)', hint: 'ㅡ-deletion: 예쁘다→예뻐, 바쁘다→바빠, 슬프다→슬퍼' },
    { re: /(몰라|몰랐|달라|달랐|빨라|빨랐|불러|불렀|올라|올랐)/, label: '르 불규칙 (르 → ㄹㄹ)', hint: '르-irregular: 모르다→몰라, 다르다→달라, 부르다→불러' },
    { re: /(사니|사세요|만드세요|만드니|머시|머세요|아니|아세요|노세요|드세요)/, label: 'ㄹ 탈락 (ㄹ drops before ㄴ/ㅅ/ㅂ)', hint: 'ㄹ-deletion: 살다→사니/사세요, 만들다→만드세요, 알다→아세요' },
    { re: /(파래|파랬|하얘|하얬|까매|까맸|노래|노랬|빨개|빨갰)/, label: 'ㅎ 불규칙 (ㅎ-color adjectives)', hint: 'ㅎ-irregular for color/shape adjs: 파랗다→파래, 하얗다→하얘' },
  ];

  // Strip whitespace for relaxed regex matching — lets patterns like
  // "~지 않다" hit "보이지않았어요" too.
  function _strip(s) { return String(s || '').replace(/\s+/g, ''); }

  // Hangul jongseong (final consonant) extractor. Returns -1 for non-Hangul,
  // 20 for ㅆ (used to detect contracted past forms like 봤/왔/갔/됐). The
  // jongseong table indexes ㅆ at 20 (not 19 — common off-by-one trap).
  function _jong(c) {
    if (!c) return -1;
    var code = c.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return -1;
    return (code - 0xAC00) % 28;
  }
  var JONG_SS = 20;

  // Detect contracted past-polite forms that the regex can't catch because
  // the past marker (았/었/였) merged into the verb stem (보+았→봤, 오+았→왔,
  // 되+었→됐, 마시+었→마셨, etc). Any syllable with ㅆ jongseong immediately
  // followed by a past-tense ending is a contracted past form. Exceptions:
  // 있 (present existential) and 겠 (intention/conjecture) also carry ㅆ
  // jongseong but aren't past markers — their own patterns catch them.
  // Generic helper: returns true iff some syllable in `text` has the given
  // jongseong (final consonant) AND is followed (optionally across whitespace)
  // by any string in `endings`. Used for patterns where the trigger is "an
  // ㄹ-batchim syllable + 텐데" / "an ㄴ-batchim syllable + 듯하다" — those
  // can't be expressed with [가-힣]ㄹ since the ㄹ is buried in the syllable.
  // Jongseong table indices used here:
  //   4 = ㄴ, 8 = ㄹ, 16 = ㅁ, 17 = ㅂ, 20 = ㅆ
  function _hasJongFollowedBy(text, jong, endings) {
    if (!text) return '';
    for (var i = 0; i < text.length - 1; i++) {
      if (_jong(text.charAt(i)) !== jong) continue;
      var afterRaw = text.substr(i + 1);
      var afterStripped = afterRaw.replace(/^\s+/, '');
      var leadingSpaces = afterRaw.length - afterStripped.length;
      for (var j = 0; j < endings.length; j++) {
        if (afterStripped.indexOf(endings[j]) === 0) {
          return text.substr(i, 1 + leadingSpaces + endings[j].length);
        }
      }
    }
    return '';
  }

  function _hasContractedPastEnding(text, ending) {
    if (!text || !ending) return '';
    for (var i = 0; i + ending.length < text.length + 1; i++) {
      var ch = text.charAt(i);
      if (ch === '있' || ch === '겠') continue;
      if (_jong(ch) !== JONG_SS) continue;
      if (text.substr(i + 1, ending.length) === ending) {
        return ch + ending;
      }
    }
    return '';
  }

  function detect(sentenceText) {
    if (!sentenceText) return [];
    var stripped = _strip(sentenceText);
    var seen = {};
    var hits = [];
    PATTERNS.forEach(function(p) {
      // Test against both raw and whitespace-stripped forms so we tolerate
      // "보이지 않았어요" vs "보이지않았어요" without writing each pattern twice.
      // Patterns can declare either a regex (p.re) or a custom code check
      // (p._check) — the latter handles Hangul vowel contractions that
      // can't be expressed as a simple character-class regex.
      var matched = false;
      if (p.re) matched = p.re.test(sentenceText) || p.re.test(stripped);
      else if (p._check) matched = !!p._check(sentenceText) || !!p._check(stripped);
      if (matched) {
        if (seen[p.label]) return;
        seen[p.label] = true;
        hits.push({ label: p.label, hint: p.hint });
      }
    });
    return hits;
  }

  // Format detected patterns as a numbered MUST-INCLUDE list to drop
  // straight into the analysis prompt. Returns '' when no patterns
  // detected so we don't pollute the prompt with empty headers.
  function formatPromptList(patterns) {
    if (!patterns || !patterns.length) return '';
    return patterns.map(function(p, i) {
      return '  ' + (i + 1) + '. ' + p.label + ' — ' + p.hint;
    }).join('\n');
  }

  // Trivial particles + basic enders + basic modifiers are detected by
  // KH_GRAMMAR but would be noise to repeat per-sentence for Intermediate+
  // learners (they'd appear in nearly every sentence panel and flood the
  // Grammar tab). Past-polite stays IN — users explicitly want to see it
  // even when it's the only finite verb on the sentence.
  var INTERMEDIATE_SKIP_LABELS = {
    '~을/를 (object marker)': 1,
    '~이/가 (subject marker)': 1,
    '~은/는 (topic marker)': 1,
    '~의 (possessive)': 1,
    '~에 (location/time)': 1,
    '~아/어/여요 (present polite)': 1,
    '~ㅂ/습니다 (present formal)': 1,
    '~는 (present verb modifier)': 1,
    '~ㄴ/은 (past verb / present adj modifier)': 1,
  };

  // Level-aware variant of detect — strips trivial labels so the
  // MUST-INCLUDE prompt list and post-process enforcement don't drown
  // Intermediate/Advanced learners in noise.
  function detectForLevel(sentenceText, level) {
    var hits = detect(sentenceText);
    var isBasic = level === 'Starter' || level === 'Beginner';
    if (isBasic) return hits;
    return hits.filter(function(p) { return !INTERMEDIATE_SKIP_LABELS[p.label]; });
  }

  // Extract Korean morpheme tokens from a pattern label — mirror of the
  // renderer's _patternMarkers in korehan-shared.js. Used as a fallback
  // example_in_sentence for _check-only patterns where there's no regex
  // match string to lift verbatim.
  function _labelMarkers(label) {
    var out = [];
    String(label || '').split(/[\/,]/).forEach(function(piece) {
      var stripped = piece.replace(/[~()\s\-.?!+]/g, '');
      var re = /[가-힣]+/g, m;
      while ((m = re.exec(stripped))) {
        var token = m[0];
        if (token.length > 1 && /다$/.test(token)) token = token.slice(0, -1);
        if (token) out.push(token);
      }
    });
    return out;
  }

  // Find the actual chunk in `text` that triggered pattern `p`. Used by
  // enforce to produce a non-empty example_in_sentence — without it the
  // article renderer's filter (sentNoWs.indexOf(ex) < 0) drops the entry,
  // which made every enforce-injected pattern silently invisible to users.
  function _extractExample(text, p) {
    if (!text) return '';
    if (p.re) {
      var m = text.match(p.re);
      if (m && m[0]) return m[0];
      var stripped = text.replace(/\s+/g, '');
      m = stripped.match(p.re);
      if (m && m[0]) return m[0];
    } else if (p._check) {
      // _check callbacks return the matched chunk string when matched, ''
      // otherwise. Use the chunk directly so example_in_sentence reflects
      // the actual surface form that triggered detection.
      var chunk = p._check(text);
      if (typeof chunk === 'string' && chunk) return chunk;
      var stripped2 = text.replace(/\s+/g, '');
      chunk = p._check(stripped2);
      if (typeof chunk === 'string' && chunk) return chunk;
    }
    // Fall back to a label-derived marker that actually appears in the
    // sentence — covers older _check callbacks that still return bool.
    var markers = _labelMarkers(p.label);
    var sentNoWs = text.replace(/\s+/g, '');
    for (var i = 0; i < markers.length; i++) {
      if (sentNoWs.indexOf(markers[i]) >= 0) return markers[i];
    }
    return '';
  }

  // Post-process gate: every detected pattern that the AI omitted gets
  // added back to s.analysis with the canonical hint as the explanation
  // and a real chunk as example_in_sentence (so the article renderer's
  // marker-check filter actually keeps it). Mutates sentFinal in place.
  function enforceDetectedPatterns(sentFinal, level) {
    if (!Array.isArray(sentFinal)) return sentFinal;
    var isBasic = level === 'Starter' || level === 'Beginner';
    sentFinal.forEach(function(s) {
      if (!s || !s.text) return;
      var existing = {};
      (s.analysis || []).forEach(function(a) {
        if (a && a.label) existing[String(a.label).trim()] = true;
      });
      if (!Array.isArray(s.analysis)) s.analysis = [];
      var seenLabels = {};
      var stripped = s.text.replace(/\s+/g, '');
      PATTERNS.forEach(function(p) {
        if (seenLabels[p.label]) return;
        var matched = false;
        if (p.re) matched = p.re.test(s.text) || p.re.test(stripped);
        else if (p._check) matched = !!p._check(s.text) || !!p._check(stripped);
        if (!matched) return;
        seenLabels[p.label] = true;
        if (!isBasic && INTERMEDIATE_SKIP_LABELS[p.label]) return;
        if (existing[p.label]) return;
        var example = _extractExample(s.text, p);
        if (!example) return;  // no chunk → renderer would drop it anyway
        s.analysis.push({
          type: 'grammar',
          label: p.label,
          exp: p.hint,
          example_in_sentence: example,
        });
      });
    });
    return sentFinal;
  }

  // Full catalog dump for prompt injection. Use this when you want to
  // prime the AI with EVERY pattern it should look for (vs detect()
  // which returns only the patterns matching a specific sentence).
  // Output format is a flat numbered list "label — hint" per line so
  // the model can scan it as a checklist while it analyzes. Used by
  // article-generation prompts where the body doesn't exist yet, so
  // we can't pre-detect — we instead prime the model with the whole
  // dictionary up front and let enforce backfill any slips after.
  function formatFullCatalog() {
    return PATTERNS.map(function(p, i) {
      return (i + 1) + '. ' + p.label + ' — ' + (p.hint || '');
    }).join('\n');
  }

  window.KH_GRAMMAR = {
    detect: detect,
    detectForLevel: detectForLevel,
    enforceDetectedPatterns: enforceDetectedPatterns,
    formatPromptList: formatPromptList,
    formatFullCatalog: formatFullCatalog,
    _PATTERNS: PATTERNS,  // exposed for testing only
  };
})();
