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
    { re: /(?:^|[가-힣])면(?:서|$|\s|[.,])/, label: '~(으)면 (if/when)', hint: 'conditional. "if / when"' },
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
    { re: /(다고|ㄴ다고|는다고)\s*(하|했|해|말)/, label: '~다고 하다 (indirect declarative)', hint: 'reported speech. "says/said that"' },
    { re: /라고\s*(하|했|해|말|불|부)/, label: '~(이)라고 하다 (indirect copula/name)', hint: 'reported identification or naming' },
    { re: /냐고\s*(하|했|해|물)/, label: '~냐고 하다 (indirect question)', hint: 'reported question' },
    { re: /자고\s*(하|했|해|제안)/, label: '~자고 하다 (indirect proposal)', hint: 'reported suggestion' },
    { re: /달라고(?=[^가-힣]|$)|주라고(?=[^가-힣]|$)/, label: '~달라고/주라고 (request)', hint: 'reported request / asking for something' },

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
    { re: /(는|ㄴ|은)\s*(대로|만큼)/, label: '~는 대로/만큼 (as / to the extent)', hint: 'manner or extent. "as / according to / as much as"' },
    { re: /ㄴ\s*셈이|은\s*셈이/, label: '~ㄴ/은 셈이다 (amounts to)', hint: 'roughly equivalent to. "amounts to / can be counted as"' },

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
  function _hasContractedPastEnding(text, ending) {
    if (!text || !ending) return false;
    for (var i = 0; i + ending.length < text.length + 1; i++) {
      var ch = text.charAt(i);
      if (ch === '있' || ch === '겠') continue;
      if (_jong(ch) !== JONG_SS) continue;
      if (text.substr(i + 1, ending.length) === ending) return true;
    }
    return false;
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

  // Post-process gate: every detected pattern that the AI omitted gets
  // added back to s.analysis with the canonical hint as the explanation.
  // The shared per-sentence renderer already handles dedup via label
  // string so an enforced entry never collides with a richer AI entry.
  // Mutates sentFinal in place AND returns it for convenience.
  function enforceDetectedPatterns(sentFinal, level) {
    if (!Array.isArray(sentFinal)) return sentFinal;
    sentFinal.forEach(function(s) {
      if (!s || !s.text) return;
      var detected = detectForLevel(s.text, level);
      if (!detected.length) return;
      var existing = {};
      (s.analysis || []).forEach(function(a) {
        if (a && a.label) existing[String(a.label).trim()] = true;
      });
      if (!Array.isArray(s.analysis)) s.analysis = [];
      detected.forEach(function(p) {
        if (existing[p.label]) return;
        s.analysis.push({
          type: 'grammar',
          label: p.label,
          exp: p.hint,
          example_in_sentence: '',
        });
      });
    });
    return sentFinal;
  }

  window.KH_GRAMMAR = {
    detect: detect,
    detectForLevel: detectForLevel,
    enforceDetectedPatterns: enforceDetectedPatterns,
    formatPromptList: formatPromptList,
    _PATTERNS: PATTERNS,  // exposed for testing only
  };
})();
