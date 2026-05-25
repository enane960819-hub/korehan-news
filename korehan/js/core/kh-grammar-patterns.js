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
    { re: /지\s*않(았|아|아요|았어요|았습니다|네|군|는|아도)/, label: '~지 않다', hint: 'long-form negation. <stem> + 지 않다 = "do not / be not". 가다 → 가지 않다 (don\'t go), 좋다 → 좋지 않다 (not good), 예쁘다 → 예쁘지 않아요 (not pretty). More formal / emphatic than the short ~안 + V form (안 가다); also handles long stems and ㅂ/ㄷ-irregular verbs that get awkward with 안.' },
    { re: /지\s*못(했|해|해요|했어요|했습니다|하)/, label: '~지 못하다', hint: 'long-form inability. <stem> + 지 못하다 = "cannot do"' },
    { re: /(?:^|\s|[.,?!])안\s+[가-힣]/, label: '안 + V/A', hint: 'short-form negation. 안 + verb/adjective = "not"' },
    { re: /(?:^|\s|[.,?!])못\s+[가-힣]/, label: '못 + V', hint: 'short-form inability. 못 + verb = "cannot"' },

    // ── Tense (sentence enders, past first since most specific) ─
    // NOTE: no separate `했어요 (하다 past polite)` entry. 했어요 is just
    // 하 + 였 contracted to 했, and the contracted-past _check on line 41
    // already catches it (했 carries ㅆ batchim, followed by 어요). The
    // story_gen and article-gen prompts explicitly say "list ONLY the
    // canonical ~았/었/였어요 entry, never 했어요 alongside it" — having
    // the back-fill emit the duplicate label was the bug that surfaced
    // 했어요 and ~았/었/였어요 as two separate cards on the same paragraph.
    { re: /[가-힣](았|었|였)어요(?=[^가-힣]|$)/, label: '~았/었/였어요 (past polite)', hint: 'past polite ending. <stem> + 았/었/였어요. Vowel harmony: ㅏ/ㅗ → 았; else → 었; 하 → 했/하였. Vowel contraction: 보+았→봤, 오+았→왔, 되+았→됐, 마시+었→마셨' },
    // Plain-style present indicative (평어체) — verbs only, not adjectives.
    // Vowel-stem verbs add ㄴ as batchim of the stem syllable (가다 → 간다,
    // 오다 → 온다, 하다 → 한다, 보다 → 본다). Consonant-stem verbs insert
    // 는 (먹다 → 먹는다, 읽다 → 읽는다). Critical for story narration —
    // without it 평어체 sentences had NO finite-verb pattern detected.
    // Adjectives use the bare dict form (좋다, 빠르다) in 평어체 — so a
    // matching word like 좋다 should NOT trigger this pattern. We avoid
    // this by requiring ㄴ-batchim on the stem syllable (verb 간다 fires
    // via _hasJongFollowedBy; adjective 좋다 doesn't, since 좋 has ㅎ).
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 4, ['다', '다.', '다,', '다!', '다?']);
        if (c) return c;
        var m = t.match(/[가-힣]는다(?=[^가-힣]|$)/);
        return m ? m[0] : '';
      }, label: '~ㄴ다/~는다 (plain present indicative — verbs only)', hint: 'plain-style present-tense ending for verbs (평어체, narration register). Vowel-stem verbs: 가다→간다, 오다→온다, 하다→한다, 보다→본다 (ㄴ becomes the stem batchim). Consonant-stem verbs: 먹다→먹는다, 읽다→읽는다, 받는다 (는 inserted before 다). Adjectives use the bare 다 form (좋다, 빠르다), NOT ~ㄴ다.' },
    { _check: function(t) { return _hasContractedPastEnding(t, '어요'); }, label: '~았/었/였어요 (past polite)', hint: 'past polite (vowel-contracted form). 보다→봤어요, 오다→왔어요, 되다→됐어요, 마시다→마셨어요. Stem vowel + 았/었 collapses into one syllable with ㅆ batchim.' },
    { re: /[가-힣](았|었|였)습니다(?=[^가-힣]|$)/, label: '~았/었/였습니다 (past formal)', hint: 'past formal-polite ending' },
    { _check: function(t) { return _hasContractedPastEnding(t, '습니다'); }, label: '~았/었/였습니다 (past formal)', hint: 'past formal-polite (vowel-contracted form). 보+았+습니다→봤습니다' },
    { re: /[가-힣](았|었)었/, label: '~았/었었 (past perfect)', hint: 'past perfect / earlier past. doubled past for "had done"' },
    { re: /[가-힣]ㄹ\s*거예요|[가-힣](을|ㄹ)\s*거예요/, label: '~ㄹ/을 거예요 (future)', hint: 'future tense polite. <stem> + ㄹ/을 거예요 = "will"' },
    { re: /[가-힣]겠(어요|습니다|네요|구나|지)/, label: '~겠 (intention/conjecture)', hint: 'THREE uses depending on context. (a) SPEAKER INTENTION — 가겠다 / 가겠습니다 (I will go), 알겠습니다 (understood). (b) CONJECTURE about others/things — 좋겠다 (must be nice), 비가 오겠어요 (it\'ll probably rain), 힘들겠어요 (must be hard). (c) POLITE softening / formal "I will" — 잘 모르겠어요 (I don\'t really know), 그렇게 하겠습니다 (will do so). Context + subject determine which.' },
    // ~아/어/여요 present polite — must NOT match past-contracted X요
    // forms (갔어요 / 봤어요 / 했어요 / 됐어요 / 마셨어요), where the
    // preceding syllable X carries ㅆ jongseong = past tense already.
    // Without this exclusion every past-polite sentence in the corpus
    // surfaced BOTH "~아/어/여요 (present polite)" AND "~았/었/였어요
    // (past polite)" as duplicate cards on the same chunk.
    { _check: function(t) {
        if (!t) return '';
        // 있다 / 없다 are stative verbs whose stem carries ㅆ batchim in
        // the LEMMA (not from past contraction). 있어요 / 없어요 ARE
        // present polite and must still fire here — exempt them from
        // the ㅆ-batchim exclusion below.
        var STATIVE_SS = { '있': 1, '없': 1 };
        var re = /[가-힣](아|어|여)요(?=[^가-힣]|$)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var x = t.charAt(m.index);
          if (STATIVE_SS[x]) return m[0];
          var pc = x.charCodeAt(0);
          if (pc >= 0xAC00 && pc <= 0xD7A3) {
            if ((pc - 0xAC00) % 28 === 20) continue; // ㅆ jongseong = past contraction, not present
          }
          return m[0];
        }
        return '';
      }, label: '~아/어/여요 (present polite)', hint: 'present polite informal ending. <stem> + 아/어/여요. 먹다→먹어요, 있다→있어요, 없다→없어요, 받다→받아요, 좋다→좋아요. Vowel harmony picks 아 (after ㅏ/ㅗ stems) vs 어 (after others). Contracted vowel-merger forms (가요, 와요, 봐요, 해요, 줘요, 마셔요, 돼요) are covered by the separate "present polite — contracted" entry.' },
    // Contracted present polite — covers stems whose vowel merges with
    // 아/어/여 into a single syllable (오 + 아 → 와, 보 + 아 → 봐, 하 +
    // 여 → 해, etc.). The bare [가-힣](아|어|여)요 regex above can\'t
    // see these because the contracted syllable isn\'t literal 아/어/여.
    // Whitelist of syllables that genuinely arise from this contraction
    // — restricted to unambiguously verbal forms to avoid noun + 요
    // false positives (e.g. 가요 as music genre, 자요 ambiguous with
    // 남자요). 가요/사요/자요 etc. accepted as a coverage gap.
    { _check: function(t) {
        if (!t) return '';
        var SYL = { '와':1, '봐':1, '해':1, '줘':1, '둬':1, '셔':1, '켜':1, '펴':1, '매':1, '깨':1, '떼':1, '째':1, '쳐':1, '쪄':1, '져':1, '돼':1, '꿔':1, '쒀':1 };
        for (var i = 0; i + 1 < t.length; i++) {
          if (t.charAt(i + 1) !== '요') continue;
          if (!SYL[t.charAt(i)]) continue;
          // Boundary: 요 must be at end OR followed by non-hangul / space / punct
          var nxt = t.charAt(i + 2) || '';
          if (nxt !== '' && /[가-힣]/.test(nxt)) continue;
          // Also skip if preceded by another hangul that would make this
          // a different morpheme boundary (e.g. avoiding mid-word matches).
          return t.charAt(i) + '요';
        }
        return '';
      }, label: '~아/어/여요 (present polite — contracted)', hint: 'present polite for stems whose vowel contracts with 아/어/여 into one syllable. 오다 → 오아요 → 와요; 보다 → 보아요 → 봐요; 하다 → 하여요 → 해요; 주다 → 주어요 → 줘요; 마시다 → 마시어요 → 마셔요; 되다 → 되어요 → 돼요. Same meaning as the uncontracted ~아/어/여요 — just merged form.' },
    { re: /[가-힣](ㅂ니다|습니다)(?=[^가-힣]|$)/, label: '~ㅂ/습니다 (present formal)', hint: 'present formal-polite ending' },
    { re: /[가-힣]네요(?=[^가-힣]|$)/, label: '~네요 (discovery)', hint: 'discovery / mild surprise on noticing something new — speaker realizes for the first time. 예쁘네요 (oh, it\'s pretty), 비가 오네요 (oh, it\'s raining), 정말이네요 (it really is). Common when seeing/hearing something fresh. Banmal variant: ~네 (우리 집에 오네 = "huh, coming to our house").' },
    { re: /[가-힣]군요(?=[^가-힣]|$)|[가-힣]구나(?=[^가-힣]|$)/, label: '~군요/~구나 (realization)', hint: 'realization / acknowledgement of new info. ~군요 (polite) / ~구나 (banmal). Different from ~네요: ~네요 is fresh surprise, ~군요/~구나 is "aha, NOW I get it" — accepting info just given. 그렇군요 (oh, I see), 그랬구나 (oh, so that\'s what happened), 맛있구나 (so it\'s tasty).' },
    { re: /[가-힣]잖아요?(?=[^가-힣]|$)/, label: '~잖아(요) (you know / obviously)', hint: 'asserting shared/obvious info — speaker presents the clause as something the listener should already know or accept. Tone varies. (a) FRIENDLY reminder: 비가 오잖아요 (it\'s raining, you know!), 우리 친구잖아 (we\'re friends, right). (b) MILD accusation / "but obviously": 내가 말했잖아 (I told you!), 그렇게 하면 안 되잖아요 (you can\'t do it that way, obviously). Always relies on a shared frame; never used for brand-new info.' },
    { re: /[가-힣]지요?(?=[^가-힣]|$)|[가-힣]죠(?=[^가-힣]|$)/, label: '~지요/~죠 (confirming/asserting)', hint: 'tone determines meaning. (a) RISING (?) = seeking agreement — 맛있죠? (tasty, right?), 그렇지요? (isn\'t it?). (b) FALLING (.) = asserting shared knowledge / "of course" — 당연하지요 (of course it is), 그렇죠 (that\'s right). Very common conversational ending; speaker assumes listener already knows or will agree.' },
    { re: /[가-힣]ㄹ까요\?|[가-힣]을까요\?/, label: '~ㄹ까요? (shall we / I wonder)', hint: 'suggestion or wondering. "shall we / do you think"' },
    { re: /[가-힣]ㄹ게요(?=[^가-힣]|$)|[가-힣]을게요(?=[^가-힣]|$)/, label: '~ㄹ게요 (I will, intent to listener)', hint: 'speaker promise / intention with listener awareness' },
    { re: /[가-힣]나요\?/, label: '~나요? (gentle question)', hint: 'soft polite question form' },
    { re: /[가-힣](으세요|세요)(?=[^가-힣]|$)/, label: '~(으)세요 (polite imperative / honorific present)', hint: 'TWO uses, distinguished by context. (a) POLITE IMPERATIVE (request / command): 가세요 (please go), 드세요 (please eat), 여기 앉으세요 (please sit here). (b) HONORIFIC PRESENT — describing what an elder/superior does (often as question): 할머니는 어디 가세요? (where is grandma going?), 선생님 오세요 (the teacher is coming). Same surface form — verb subject + intonation distinguish.' },

    // ── Auxiliary verbs (보조용언) ────────────────────────────────
    { re: /기\s*시작(했|해|하)/, label: '~기 시작하다 (start V-ing)', hint: 'begin doing. <stem> + 기 시작하다' },
    { re: /고\s*있(어|었|는|다|네|습)/, label: '~고 있다 (continuous)', hint: 'progressive aspect. "is V-ing"' },
    { re: /(아|어|여)\s*있(어|었|는|다|네|습)/, label: '~아/어 있다 (resultant state)', hint: 'resulting state from completed action. "remains V-ed"' },
    { re: /게\s*되(었|어|네|는|었어요|었습니다)/, label: '~게 되다 (come to / passive)', hint: 'become so / circumstance change. "comes to / ends up"' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*보(았|았어요|아|아요|세요|니|는|기|면|면서)/, label: '~아/어 보다 (try doing)', hint: 'attempt or experience. "try V-ing / have done". Includes vowel-contracted: 고려하다→고려해 보다, 보다→봐 보다, 가다→가 보다' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*주(었|어|어요|세요|시|니|는|기)/, label: '~아/어 주다 (do for)', hint: 'do as a favor for someone. Includes contracted: 도와주다→도와줘요, 해 주다' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*버리(었|어|네|기|어요)/, label: '~아/어 버리다 (do completely / regret / clean finish)', hint: 'completion auxiliary with TWO emotional shades depending on context. (a) NEUTRAL clean completion — finished entirely, nothing left: 다 먹어 버렸어요 (ate it all up), 끝나 버렸다 (it\'s totally over). (b) REGRET / unintended — happened despite the speaker\'s wish: 잊어버렸어요 (I forgot — oops), 가 버렸어요 (he just left, and I miss him), 깨져 버렸다 (it broke, dammit). Negative-affect verbs (잊다/깨다/도망가다) usually lean (b); achievement verbs (끝내다/먹다) usually lean (a).' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*놓(았|아|네|아요|기|는다)/, label: '~아/어 놓다 (do in advance)', hint: 'do and leave the result for later' },
    { re: /(아|어|여|봐|와|줘|둬|매|깨|떼|째|쳐|쪄|져|돼|해|펴|켜|셔|쒀|폐)\s*두(었|어|네|기|어요)/, label: '~아/어 두다 (do for later)', hint: 'do and store the result' },
    // ~아/어야 하다/되다 — needs to match (a) 2-syllable contracted
    // forms in the alternation list (해야, 봐야, 와야 …) AND (b) bare
    // X+야 for verbs whose stem ends in vowel ㅏ that absorbs the 아
    // (가야 / 사야 / 만나야). Plus the trailing 하/되 conjugation can
    // be ANY common form including ~ㅂ니다/~습니다 (가야 합니다, 해야
    // 됩니다). Switched to a broader second alternation covering all
    // common 하다/되다 conjugations.
    { re: /(?:야|아야|어야|여야|봐야|와야|줘야|둬야|매야|깨야|떼야|째야|쳐야|쪄야|져야|돼야|해야|펴야|켜야|셔야|쒀야|폐야)\s+(하다|한다|할|해|해요|해서|해야|함|합|합니다|합니까|했|했다|했어|했어요|했습니다|되다|된다|되|돼|돼요|돼서|돼야|됐|됐다|됐어|됐어요|됐습니다|됨|됩|됩니다|됩니까)/, label: '~아/어야 하다/되다 (must)', hint: 'obligation. <stem> + 아/어야 하다/되다 = "have to / must". 가야 합니다 / 가야 한다 / 가야 해요 / 해야 됩니다 / 받아야 한다. Includes vowel-contracted forms (해야, 봐야, 와야, 돼야, 줘야, 둬야 …) and the bare X+야 form for vowel-stem verbs (가야, 사야, 만나야).' },
    // ~기로 하다 — previous regex `기로\s*하(다|기로\s*했|었|기로\s*해)`
    // missed the contracted past 했/했다/했어요 (하+았 collapses to 했).
    // Broader alternation that lists each common follow-on directly.
    { re: /기로\s*(하다|한다|할|하기|하면|하고|했|했다|했어|했어요|했습니다|해서|해야|해|해라|함|합)/, label: '~기로 하다 (decide to)', hint: 'decide to do. <stem> + 기로 하다 = "decide / plan to". 가기로 하다 (decide to go); 만나기로 했어요 (decided to meet); 결혼하기로 했다 (decided to marry). The 기로 chunk is fixed; only the trailing 하다 conjugates.' },
    // ~ㄴ/은 적이 있다/없다 — previous regex required literal ㄴ jamo
    // (U+3134) which only appears as a separate character in rare
    // pedagogical contexts. Real Korean uses ㄴ as the batchim of the
    // preceding syllable (한 적, 본 적, 간 적). Use _hasJongFollowedBy
    // with jong=4 (ㄴ) for vowel-stem verbs; keep the literal 은 branch
    // for consonant-stem verbs (받은 적, 먹은 적).
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 4, ['적']);
        if (c) return c;
        var m = t.match(/[가-힣]은\s*적/);
        return m ? m[0] : '';
      }, label: '~ㄴ/은 적이 있다/없다 (have done before)', hint: 'experiential past. <stem> + ㄴ/은 적이 있다 / 없다 = "have V-ed before / never V-ed". 가다 → 간 적이 있다 (have been); 먹다 → 먹은 적이 없다 (never eaten); 한 적이 있어요 (I have done that).' },
    { re: /[가-힣]\s*수\s*(있|없)/, label: '~(으)ㄹ 수 있다/없다 (ability/possibility)', hint: 'ability or possibility. <stem> + ㄹ/을 수 있다 = "can"; 없다 = "cannot". 옮기다 → 옮길 수 없다 = "cannot transmit"' },

    // ── Connectives ─────────────────────────────────────────────
    { re: /(아서|어서|여서|봐서|와서|줘서|둬서|매서|깨서|떼서|째서|쳐서|쪄서|져서|돼서|해서|펴서|켜서|셔서|쒀서|폐서)/, label: '~아/어서 (cause / sequence)', hint: 'reason or sequence. "because / and then". Includes vowel-contracted forms: 넘어지다→넘어져서, 보다→봐서, 되다→돼서, 하다→해서' },
    { re: /(니까|으니까)/, label: '~(으)니까 (reason / temporal discovery)', hint: 'TWO uses. (a) REASON (more conversational than ~아서): 시간이 없으니까 빨리 가요 (no time, so hurry), 비가 오니까 우산을 챙겨 (it\'s raining, so bring an umbrella). (b) TEMPORAL DISCOVERY — finding out the result of doing X: 문을 여니까 친구가 있었다 (when I opened the door, the friend was there). Often pairs with past tense in (b). Different from ~아서 — ~(으)니까 can carry honorifics; ~아서 cannot.' },
    { re: /기\s*때문(에|이|이다)/, label: '~기 때문에 (because)', hint: 'because. <stem> + 기 때문에' },
    // Noun + 때문에. Codex P2: previous lookbehind `(?<!기)` checked
    // the char BEFORE the matched [가-힣], but in 먹기 때문에 the
    // matched char IS 기 (with 먹 before it). So 기 itself was
    // matched as the noun. Fix: lookbehind ON the matched char,
    // i.e. assert the matched [가-힣] isn't 기.
    { re: /[가-힣](?<!기)\s*때문(에|이|이다)/, label: '~ 때문에 (because of N)', hint: 'because of (noun). <noun> + 때문에 = "because of / due to". 세균 때문에 = "because of the bacteria"' },
    // ~(으)면 must NOT swallow ~(으)면서 — the 서 alternative used to
    // be in the lookahead, which made every "가면서" / "들어가면서" fire
    // both ~(으)면 AND ~(으)면서. Now require the next char to be end-
    // of-string, whitespace, or punctuation (any continuation Hangul
    // including 서 lets the dedicated ~(으)면서 pattern win instead).
    { re: /(?:^|[가-힣])면(?:$|\s|[.,?!])/, label: '~(으)면 (if / when / whenever)', hint: 'TWO uses. (a) CONDITIONAL "if": 비가 오면 안 가요 (if it rains, I won\'t go), 시간이 없으면 다음에 (if no time, next time). (b) TEMPORAL HABIT "when / whenever": 시간이 있으면 책을 읽어요 (when I have time, I read), 봄이 오면 꽃이 핀다 (when spring comes, flowers bloom). Context: hypothetical vs recurring habit.' },
    { re: /(다면)/, label: '~다면 (hypothetical if)', hint: 'hypothetical conditional. "if it were that"' },
    { re: /(면서|으면서)/, label: '~(으)면서 (while / and at the same time / yet)', hint: 'TWO uses. (a) SIMULTANEOUS — same speaker does X and Y at once: 먹으면서 이야기하다 (talk while eating), 음악을 들으면서 공부한다 (study while listening to music). (b) CONTRAST / "yet, even though" — same subject has two seemingly contradictory states: 학생이면서도 일한다 (works although a student), 알면서 모르는 척한다 (pretends not to know even though he does). Reading (b) usually adds 도 (~면서도) for stronger contrast.' },
    { re: /다가(?=[^가-힣]|$)/, label: '~다가 (mid-action shift)', hint: 'doing X then Y / interrupted action' },
    { re: /(거나)/, label: '~거나 (or)', hint: 'alternative connective. "or"' },
    { re: /(려고|으려고)/, label: '~(으)려고 (intention)', hint: 'in order to / intending to' },
    { re: /기\s*위해서?/, label: '~기 위해(서) (in order to)', hint: 'purpose. "in order to / for the sake of"' },
    { re: /(러|으러)\s*(가|오|와|왔|갔|간|온|갈|올|갑|옵|감|옴|다니|다녔|다녀)/, label: '~(으)러 (purpose with movement)', hint: 'purpose verb + movement verb. <stem> + 러/으러 + 가다/오다 = "go/come to do". 보다 → 보러 가다, 보러 와요' },
    { re: /도록(?=[^가-힣]|$)/, label: '~도록 (so that / until)', hint: 'so that / extent / until' },
    { re: /[가-힣]지만(?=[^가-힣]|$)/, label: '~지만 (but)', hint: 'contrast. "but / however"' },
    { re: /(는데|ㄴ데|은데)(?=[^가-힣]|$)/, label: '~ㄴ/는데 (background / contrast / softening)', hint: 'THREE uses depending on what follows. (a) BACKGROUND for next clause: 학교에 가는데 우산이 없어요 (I\'m going to school but I have no umbrella). (b) CONTRAST: 좋은데 비싸요 (it\'s good, but expensive). (c) EXPLANATION / softening (often trailing): 배가 고픈데… (I\'m hungry…), 좀 모르는데요 (I kinda don\'t know). The same morpheme — clause that follows determines which sense.' },
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
    //
    // Negative lookbehind for 에 — the dative particle 에게 ("to <person>")
    // ends in 게 and was getting flagged as the adverbializer ("그녀에게"
    // surfaced as `~게 (adverbializer suffix)` with chunk "그녀에게").
    // Similarly exclude 께 / 한테(게) edge cases by anchoring on the
    // exact 에게 sequence.
    // Codex P2: previous match fired on '가게 되었어요' / '~게 되다'
    // patterns (verb stem + 게 + 되/하다/만들다 causative) which
    // aren't the adverbializer. Negative lookaheads exclude:
    //   ~게 되<korean>   (became / happened to)
    //   ~게 하다         (caused to)
    //   ~게 만들<korean> (made to)
    // Active forms like '쉽게 했다' (조 was active) still match
    // since '했' starts with 했 not '하다'.
    //
    // Fossil demonstratives — 그렇게 / 이렇게 / 저렇게 / 어떻게 — surface in
    // virtually every story and article. Technically derived from
    // 그렇다/이렇다/저렇다/어떻다 + 게, but they're so fossilized that
    // surfacing "~게 (adverbializer)" on every one floods the Grammar
    // tab with a card the learner has already seen. Skip them via the
    // same widen-then-fossil-check approach as ~히.
    { _check: function(t) {
        if (!t) return '';
        var FOSSIL = { '그렇게': 1, '이렇게': 1, '저렇게': 1, '어떻게': 1 };
        var re = /(?<!에)[가-힣]게(?=\s+(?!되[가-힣]|하다|만들[가-힣])[가-힣]|[.,!?])/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var ws = m.index;
          while (ws > 0 && /[가-힣]/.test(t.charAt(ws - 1))) ws--;
          var word = t.substring(ws, m.index + 2);
          if (FOSSIL[word]) continue;
          return word;
        }
        return '';
      }, label: '~게 (adverbializer suffix)', hint: 'forms adverbs from adjectives. <adj-stem> + 게 = adverb. 쉽다 (easy) → 쉽게 (easily); 다르다 (different) → 다르게 (differently); 빠르다 → 빠르게 (quickly).' },

    // ── Derivational suffixes (sibling family of ~게) ───────────
    // Same exp-policy as ~게: explain the morpheme role and show a
    // dictionary→surface chain. The AI keeps defaulting to "translate
    // the chunk" for these short suffixes, so the canonical hint here
    // serves as the ground truth when enforce auto-injects them.
    // ~히 adverbializer. Standalone fossil adverbs (감히, …) are NOT
    // derived from a 하다-stem and shouldn't surface as a ~히 pattern.
    // Widen each regex hit to the full Korean word boundary and skip
    // when the resulting word is on the fossil list — that way
    // "감히 잠을 깨우다니" no longer emits a spurious ~히 card while
    // "용감히" / "정확히" / "천천히" still register normally.
    { _check: function(t) {
        if (!t) return '';
        var FOSSIL_STANDALONE = { '감히': 1 };
        var re = /[가-힣]히(?=\s|[.,!?]|$)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var ws = m.index;
          while (ws > 0 && /[가-힣]/.test(t.charAt(ws - 1))) ws--;
          var word = t.substring(ws, m.index + 2);
          if (FOSSIL_STANDALONE[word]) continue;
          return word;
        }
        return '';
      }, label: '~히 (adverb suffix, Sino-Korean)', hint: 'adverbializer for Sino-Korean and a few native bases. 정확하다 → 정확히 (accurately); 조용하다 → 조용히 (quietly); 천천히 (slowly); 분명히 (clearly); 충분히 (sufficiently). Sibling of ~게 — different surface but same role.' },
    // ~답다 — skip 아름다 family. 아름 isn't a productive modern Korean
    // noun (frozen archaic root), so 아름답다/아름다워요/아름다웠다 are
    // base-form adjectives, not 아름+답다 derivations. We check the 2
    // chars at [m.index-1, m.index+1] for "아름" — this works for both
    // raw text AND whitespace-stripped text (where the widen-leftward
    // approach would over-walk into the previous word).
    { _check: function(t) {
        if (!t) return '';
        var re = /[가-힣](답다|답게|답고|답다고|답습니다|다워|다워요|다웠)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var ctx = t.substring(Math.max(0, m.index - 1), m.index + 1);
          if (ctx === '아름') continue;
          return m[0];
        }
        return '';
      }, label: '~답다 (befits / characteristic of)', hint: 'noun → adjective: <noun> + 답다 = "befits / acts like the role of". 학생답다 → 학생답게 (in a student-like way); 사람답다 (humanly); 봄답다 (spring-like).' },
    // ~롭다 — skip the high-frequency frozen adjective base-forms
    // (괴롭다, 외롭다, 날카롭다). Check chars immediately before the
    // matched [가-힣] (which is X in X + 롭다). For 1-char prefix
    // fossils (괴, 외), X itself IS the fossil. For 2-char (날카),
    // X='카' AND chars[m.index-1]='날'. Works in stripped text too.
    { _check: function(t) {
        if (!t) return '';
        var ONE = { '괴': 1, '외': 1 };
        var re = /[가-힣](롭다|롭게|로워|로워요|로웠|로운)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var x = t.charAt(m.index);
          if (ONE[x]) continue;
          if (x === '카' && t.charAt(m.index - 1) === '날') continue;
          return m[0];
        }
        return '';
      }, label: '~롭다 (-ous / adjective formative)', hint: 'noun → adjective for abstract qualities. 자유 → 자유롭다 → 자유롭게 (freely); 새 → 새롭다 → 새롭게 (newly); 여유롭다 (relaxed); 평화롭다 (peaceful).' },
    { re: /[가-힣](스럽다|스럽게|스러워|스러워요|스러웠|스러운)/, label: '~스럽다 (seems / has the quality of)', hint: 'noun/stem → adjective for evident qualities. 자연 → 자연스럽다 → 자연스럽게 (naturally); 조심 → 조심스럽다 → 조심스럽게 (carefully); 사랑스럽다 (lovely).' },
    // Dropped the bare `이` alternative — it caused 정적이 / 흔적이 / 인적이
    // (noun + 이 subject particle) to surface as `~적 (-ic/-al adj suffix)`.
    // 정적/흔적/인적/행적/사적/자취/적 are NOUNS not -적 adjectives. The
    // remaining alternatives (이다 / 이에요 / 입니다 / 인 / 으로) all carry the
    // adjective predicate or modifier shape, so we only fire when the
    // surface form genuinely uses 적 as the adj-suffix.
    { re: /[가-힣]적(이다|이에요|입니다|인|으로|으로\s)/, label: '~적 (-ic / -al adjective suffix)', hint: 'Sino-Korean noun → adjective. <noun> + 적 = "-ic / -al / -ive". Forms: 적이다 (predicate), 적인 N (modifier), 적으로 (adverb). 일반적 (general); 효과적 (effective); 경제적 (economic).' },
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
      var m = t.match(/[가-힣]이나(?=\s|[.,!])/);
      if (m) return m[0];
      // Bare ~나 after a vowel-ending syllable (no batchim, jong=0) followed
      // by space/punct. The vowel-ending requirement excludes verb stems like
      // 만나, 혼나, 가나(요). Also explicitly skip "하나" (the cardinal number
      // "one") — 하 ends in vowel + 나 + space matches the pattern but in
      // surface form 하나 is almost always the numeral, not the ~(이)나
      // particle. False-positive carrier especially for "X 중 하나" / "한 개".
      // Codex P2: also drop '?' from terminators. A vowel-stem + 나 + ?
      // pattern is almost always a verb question ending (가나?, 하나?,
      // 오나?), not the alternation particle (which connects to another
      // noun, not a sentence-final ?).
      for (var i = 0; i < t.length - 1; i++) {
        if (_jong(t.charAt(i)) !== 0) continue;
        if (t.charAt(i + 1) !== '나') continue;
        var nxt = t.charAt(i + 2) || '';
        if (!(nxt === '' || /[\s.,!]/.test(nxt))) continue;
        var pair = t.charAt(i) + '나';
        if (pair === '하나') continue; // numeral, not particle
        // 구나 at end-of-sentence or before ! is the realization marker
        // (맛있구나!, 좋구나!, 슬프구나!) — covered by the separate
        // ~군요/~구나 pattern. Without this skip the bare ~나 branch fires
        // alongside ~구나 and surfaces two grammar cards on one trigger.
        if (pair === '구나' && (nxt === '' || nxt === '!' || nxt === '.')) continue;
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
    // ~이/가 subject marker. Excludes common adverbial -이 suffix forms
    // (많이, 같이, 깊이, 높이, 길이, 일찍이, 굳이, 곰곰이) — those are
    // adverbs derived from adjective stems + 이, not noun + 이 subject.
    { _check: function(t) {
        if (!t) return '';
        var FOSSIL_ADV = { '많이': 1, '같이': 1, '깊이': 1, '높이': 1, '길이': 1, '일찍이': 1, '굳이': 1, '곰곰이': 1, '일일이': 1, '낱낱이': 1 };
        var re = /[가-힣](이|가)\s/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          // Widen leftward to find the full 2-3 syllable word that hits 이/가
          var endIdx = m.index + 2;
          var ws = m.index;
          while (ws > 0 && /[가-힣]/.test(t.charAt(ws - 1))) ws--;
          var word = t.substring(ws, endIdx);
          if (FOSSIL_ADV[word]) continue;
          return m[0];
        }
        return '';
      }, label: '~이/가 (subject marker)', hint: 'subject particle. attaches to noun' },
    { re: /[가-힣](은|는)\s/, label: '~은/는 (topic marker)', hint: 'topic particle. attaches to noun (contrastive or topical)' },
    { re: /[가-힣]에서(?=[^가-힣]|$)/, label: '~에서 (action-location / source / starting point)', hint: 'THREE uses. (a) LOCATION OF AN ACTION (NOT static existence — ~에 covers that): 학교에서 공부해요 (study AT school), 한국에서 일해요 (work IN Korea). The verb is dynamic, not 있다/없다. (b) SOURCE / origin: 미국에서 왔다 (came FROM America), 사장에서 회장으로 (from CEO to chairman). (c) STARTING POINT in time (less common, paired with 부터 or alone in news): 9시에서 11시까지 (from 9 to 11). Distinguish carefully from ~에 — ~에서 needs an action verb; ~에 takes 있다/가다/오다.' },
    { re: /[가-힣]에게(?=[^가-힣]|$)|[가-힣]한테(?=[^가-힣]|$)/, label: '~에게/한테 (to person)', hint: 'indirect object marker for animate' },
    { re: /[가-힣]께(?:서)?(?=[^가-힣]|$)/, label: '~께(서) (honorific dative/subject)', hint: 'honorific marker for elders/superiors' },
    { re: /[가-힣]에\s/, label: '~에 (location / time / direction / target)', hint: 'MULTIPLE uses with one surface form — pick based on context. (a) STATIC LOCATION: 학교에 있다 (at school). (b) TIME POINT: 3시에 만나요 (at 3), 월요일에 (on Monday). (c) DIRECTION / destination: 학교에 가다 (to school), 위에 올려라 (up onto). (d) TARGET of effect: 건강에 좋다 (good for health), 사람에게 (to a person — animate uses ~에게/한테). (e) RATE / PER (rare): 100원에 (per 100 won). Pick the one that matches the verb / context.' },
    { re: /[가-힣](으로|로)\s/, label: '~(으)로 (means / direction / transformation)', hint: 'MANY uses with one form — pick based on context. (a) INSTRUMENT / TOOL: 연필로 쓰다 (write with a pencil), 칼로 자르다 (cut with a knife). (b) METHOD / MANNER: 한국어로 말하다 (speak in Korean), 큰 소리로 (loudly). (c) DIRECTION / destination: 서울로 가다 (go toward Seoul), 위로 (upward). (d) TRANSFORMATION / CATEGORY: 학생에서 의사로 (from student into doctor), 영어로 번역 (translate INTO English). (e) MATERIAL: 나무로 만든 (made OF wood), 쌀로 만든 (made FROM rice). Specialised collocations (~로 인해 / ~로 이어지다 / ~로 보이다 / ~로 알려지다) are handled by their own entries.' },
    { re: /[가-힣](과|와)\s/, label: '~과/와 (with — comitative / and — listing)', hint: 'TWO uses (formal register). Same form, different role determined by following clause. (a) WITH (comitative — accompaniment): 친구와 같이 (together with friend), 너와 결혼하다 (marry you), 부모님과 의논하다 (discuss with parents). (b) AND (listing — connects noun phrases): 사과와 배 (apple and pear), 한국과 일본 (Korea and Japan), 학생과 교사 (students and teachers). If a following verb implies togetherness (같이, 함께, 만나다, 결혼하다) it\'s (a); if it just connects nouns in a list it\'s (b). After consonant: 과; after vowel: 와.' },
    { re: /[가-힣]하고\s/, label: '~하고 (with — comitative / and — listing, conversational)', hint: 'colloquial equivalent of ~과/와 — same TWO uses. (a) WITH: 친구하고 갔어 (went with a friend). (b) AND: 사과하고 배 (apple and pear). Used freely with any noun (no consonant/vowel agreement needed). More common in spoken Korean than 과/와.' },
    // ~부터 vs ~(으)로부터 — both end in "부터" so the bare `[가-힣]부터`
    // regex matched the "로부터" tail of 지금으로부터 / 친구로부터 with
    // X=로, then the AI got the canonical label "~부터" injected and
    // wrote an explanation about ~(으)로부터 anyway, producing cards
    // where the label / exp / example don't match. Exclude X=로 here;
    // the next entry covers ~(으)로부터 with its own canonical label.
    { _check: function(t) {
        if (!t) return '';
        var re = /[가-힣]부터(?=[^가-힣]|$)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          if (t.charAt(m.index) === '로') continue;
          return m[0];
        }
        return '';
      }, label: '~부터 (from)', hint: 'starting point in time or sequence. <noun> + 부터 = "from / starting from". 지금부터 (from now); 월요일부터 (from Monday); 처음부터 (from the start). Different from ~(으)로부터 — bare 부터 marks the start of a range, (으)로부터 emphasises origin/source.' },
    { re: /[가-힣](으로부터|로부터)(?=[^가-힣]|$)/, label: '~(으)로부터 (from / from origin)', hint: 'origin/source marker. <noun> + (으)로부터 = "from the source / received from". After consonant: 지금으로부터 (from now), 학생으로부터 (from the student). After vowel: 친구로부터 (from a friend). Different from bare ~부터 — (으)로부터 stresses provenance/source rather than a sequence start.' },
    { re: /[가-힣]까지(?=[^가-힣]|$)/, label: '~까지 (until / even / as much as)', hint: 'TWO uses. (a) ENDPOINT — temporal or spatial "until / up to": 5시까지 기다려요 (wait until 5), 서울까지 가요 (go all the way to Seoul). (b) EMPHATIC "even / as much as" — pushes a quantity / time / scope to its extreme: 저까지도 알아요 (even I know), 30년까지 걸렸다 (took as much as 30 years), 너까지 그러니? (even you?!). When the chunk expresses an unexpected extreme, it\'s reading (b), not (a).' },
    { re: /[가-힣]만\s|[가-힣]만\.|[가-힣]만$/, label: '~만 (only / just)', hint: 'limiter / restriction. <noun> + 만 = "only / just". 한 명만 왔다 (only one came), 너만 있으면 돼 (I only need you), 오늘만 (today only — exclusive emphasis), 저만 모릅니다 (only I don\'t know). Distinct from ~만에 (after a duration — "after X time gap"), ~만 해도 (X alone is enough), and ~다 만 (almost but not quite). Pure ~만 is the simple "only" / "just" reading.' },
    // ~도 has TWO uses — explain BOTH so the AI doesn't force-fit
    // the wrong reading onto a temporal/emphatic example:
    //   (a) inclusive "also/too": 나도 갈게요, 책도 샀어요
    //   (b) emphatic "even": 한 번도 못 들었어요, 100년도 훨씬 이전, 천 원도 없다
    // Without (b) the AI was writing "100년 + 도 = 'even 100 years'" on
    // examples that clearly use the emphatic reading, producing cards
    // whose hint and example didn't match.
    { re: /[가-힣]도\s|[가-힣]도\.|[가-힣]도$/, label: '~도 (also / even)', hint: 'inclusive particle with TWO uses depending on context. (a) ADDITIVE "also/too" — A도 B도, listing or adding items: 나도 갈게요 (I\'ll go too); 친구도 왔다 (the friend also came). (b) EMPHATIC "even/as much as" — used with extremes, negation, or temporal/quantity contrasts: 한 번도 못 들었어요 (haven\'t heard even once); 천 원도 없다 (don\'t even have 1000 won); 100년도 훨씬 이전 (way more than even 100 years ago). When the example shows a quantity / time pushed to an extreme, it\'s reading (b), not (a) — explain it as "even" not "also".' },
    { re: /[가-힣]의\s/, label: '~의 (possessive / relational)', hint: 'genitive marker — multiple uses with one form. (a) POSSESSION: 나의 책 (my book), 그의 차 (his car). (b) RELATION / origin: 한국의 수도 (the capital OF Korea), 그 문제의 원인 (the cause of that problem). (c) DESCRIPTIVE attribution: 사랑의 의미 (meaning of love), 미래의 꿈 (dream of/for the future). Note: often dropped in casual Korean (나 책 = my book). Pronunciation: usually [에] not [의].' },
    { re: /[가-힣]보다(?=[^가-힣]|$)/, label: '~보다 (comparison: than)', hint: 'comparative particle. <noun> + 보다 = "than / more than X". 친구보다 키가 크다 (taller than friend), 어제보다 추워요 (colder than yesterday), 다른 곳보다 비싸요 (more expensive than other places). ⚠️ Distinct from the verb 보다 (to see) — comparative 보다 attaches directly to a noun without conjugation and is followed by an adjective/state.' },

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
        // 그래 / 이래 / 저래 are fossil from 그러하다/이러하다/저러하다 →
        // 그렇다 → 그래 etc. NOT contracted reported speech. But only
        // when STANDALONE — "학생이래요" is the legit contracted reported
        // speech (학생이라고 해요), where 이래요 follows a noun.
        // detect() calls _check twice (raw text + whitespace-stripped),
        // which would let 그래 sneak through on the stripped pass because
        // the preceding space is gone — "왜그래?" matches with prev='왜'
        // (hangul) and the fossil check falsely lets it fire. Defensive:
        // when t has NO whitespace at all, treat it as the stripped retry
        // and skip ALL 그/이/저+래 entries (legit cases like 학생이래요
        // already matched on the raw pass, which detect() prefers first).
        var re = /([가-힣])(랍니다|랍니까|래요|래\.|래,|래\?|랜다|냬요|냬\.|냬\?|쟤요|쟤\.|쟤\?)/g;
        var isStrippedRetry = !/\s/.test(t);
        var m;
        while ((m = re.exec(t)) !== null) {
          var x = m[1];
          if ((x === '그' || x === '이' || x === '저') && m[2].charAt(0) === '래') {
            if (isStrippedRetry) continue;
            var prev = m.index > 0 ? t.charAt(m.index - 1) : '';
            if (!/[가-힣]/.test(prev)) continue;
          }
          return m[0];
        }
        return '';
      }, label: '~다고 해(요) → ~대(요) (contracted reported speech)', hint: 'contracted reported speech (extremely common in news headlines and casual Korean). ~ㄴ다고 해요 → ~ㄴ대요 (한다고 해요 → 한대요), ~ㄴ다고 합니다 → ~ㄴ답니다, ~라고 해요 → ~래요 (학생이라고 해요 → 학생이래요), ~냐고 해요 → ~냬요, ~자고 해요 → ~재요. Always relays what someone else said. 만든대요 = 만든다고 해요 ("they say it makes"); 한답니다 = 한다고 합니다.' },

    // ── Nominalizers ───────────────────────────────────────────
    { re: /[가-힣]는\s*것(?=[^가-힣]|$)/, label: '~는 것 (the thing of V-ing)', hint: 'verbal nominalizer (present). makes verb a noun phrase' },
    { re: /[가-힣]ㄴ\s*것(?=[^가-힣]|$)|[가-힣]은\s*것(?=[^가-힣]|$)/, label: '~ㄴ/은 것 (the thing V-ed)', hint: 'past verbal noun phrase' },
    { re: /[가-힣](ㄴ|는|을)\s*것\s*같(다|아|네|군)/, label: '~ㄴ/는/을 것 같다 (seems)', hint: 'conjecture. "seems like"' },
    { _check: function(t) {
        // ~기 nominalizer is indistinguishable from noun-ending 기 by
        // regex alone — both surface as "X기 + particle". Common
        // single-syllable nouns that end in 기 (모기 mosquito, 일기
        // diary, 시기 timing, 향기 scent, 학기 semester, 인기
        // popularity, 자기 oneself, 잡기 grasping, 무기 weapon, etc.)
        // were trigger-happy false-positive carriers. Blacklist those
        // 1-syllable starters; legitimate verb-기 forms (먹기, 가기,
        // 하기, 살기) still match because their starter isn't in the
        // blacklist.
        var m = t.match(/([가-힣])기\s*(가|를|에|로|보다|쉽|어렵|좋|싫)/);
        if (!m) return '';
        var prev = m[1];
        // Single hangul chars that, when followed by 기, make a fossil
        // NOUN (모기, 일기, 시기, 향기, 학기, 인기, …) instead of a
        // verb-stem + 기 nominalizer. Including 여/거/저 here covers
        // the fossil place adverbs 여기/거기/저기 (here/there).
        var NOUN_KI_STARTERS = '모일시향학인단식자토사정장무부호용연세야분후초위공동우만환임여거저';
        if (NOUN_KI_STARTERS.indexOf(prev) >= 0) return '';
        return m[0];
      }, label: '~기 (nominalizer)', hint: 'verbal noun. <stem> + 기 used as noun' },

    // ── Common fixed expressions ────────────────────────────────
    { re: /에\s*따르면(?=[^가-힣]|$)/, label: '~에 따르면 (according to)', hint: 'evidential. "according to"' },
    { re: /에\s*대해서?(?=[^가-힣]|$)|에\s*대한(?=[^가-힣]|$)/, label: '~에 대해(서)/대한 (about)', hint: 'topical. "about / regarding"' },
    { re: /에\s*의해서?(?=[^가-힣]|$)|에\s*의한(?=[^가-힣]|$)/, label: '~에 의해(서)/의한 (by, passive)', hint: 'passive agent. "by / by means of"' },
    { re: /을\s*통해서?(?=[^가-힣]|$)|를\s*통해서?(?=[^가-힣]|$)/, label: '~을/를 통해(서) (through)', hint: 'medium / channel. "through / by way of"' },
    { re: /을\s*위해서?(?=[^가-힣]|$)|를\s*위해서?(?=[^가-힣]|$)/, label: '~을/를 위해(서) (for the sake of)', hint: 'beneficiary / purpose' },
    { re: /을\s*위한(?=[^가-힣]|\s)|를\s*위한(?=[^가-힣]|\s)/, label: '~을/를 위한 (for) [adnominal]', hint: 'attributive form of ~을 위해. modifies a following noun. "for the sake of N". 학생들을 위한 책 = "books for students"' },

    // ── High-value collocation expressions (added 2026-05-24) ────────
    // These are news/article-register chunks that the AI consistently
    // skips when they\'re NOT in MUST-INCLUDE. Adding them via regex
    // forces every analysis run to surface them with the canonical
    // explanation below, instead of relying on AI to spot them.

    // POSSIBILITY / EXPECTATION — must catch BOTH the "X을 가능성" form
    // (consonant-batchim stem + 을: 먹을 가능성) AND the "Xㄹ 가능성" form
    // (vowel-stem with ㄹ-batchim collapsed onto stem syllable: 갈/할/볼/
    // 될 가능성). _hasJongFollowedBy with jong=8 catches the ㄹ-batchim
    // case; the literal-regex 을 branch catches the other.
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['가능성']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*가능성/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 가능성이 있다 / 높다 (possibility)', hint: 'modal expression of possibility. <stem> + ㄹ/을 가능성이 있다 = "there is a possibility that". 가능성이 높다 / 낮다 / 크다 vary the degree. 치료될 가능성이 있다 (there is a possibility of being treated); 비가 올 가능성이 높다 (likely to rain).' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['우려']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*우려/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 우려가 있다 (concern that / fear of)', hint: 'modal expression of concern / negative possibility. <stem> + ㄹ/을 우려가 있다 = "there is a concern / fear that". 부작용이 발생할 우려가 있다 (there is a concern about side effects); 우려가 제기되다 / 우려가 커지다 (concerns are raised / grow).' },
    { _check: function(t) {
        var c = _hasJongFollowedBy(t, 8, ['필요']);
        if (c) return c;
        var m = t.match(/[가-힣]을\s*필요/);
        return m ? m[0] : '';
      }, label: '~(으)ㄹ 필요(가) 있다 / 없다 (need to)', hint: 'necessity. <stem> + ㄹ/을 필요가 있다 = "need to" / 없다 = "no need to". 검토할 필요가 있다 (need to review); 걱정할 필요가 없다 (no need to worry); 필요성이 제기되다 (need is being raised).' },
    // (Note: ~(으)ㄹ 전망이다 was added separately, but the broader
    // ~(으)ㄹ 전망이다 / 계획이다 / 방침이다 / 예정이다 below already
    // covers it via _hasJongFollowedBy + 전망/계획/방침/예정.)

    // METHOD / MEANS (이용/사용/활용/바탕/토대)
    { re: /을\s*이용(해|해서|하여|한|하)|를\s*이용(해|해서|하여|한|하)/, label: '~을/를 이용해(서) (using / by means of)', hint: 'utilization. <noun> + 을/를 이용해(서) = "using / by means of / through the use of". 인터넷을 이용해서 검색한다 (search by using the internet); 이러한 원리를 이용해 (utilizing this principle). Strong news/article register.' },
    { re: /을\s*사용(해|해서|하여|한|하)|를\s*사용(해|해서|하여|한|하)/, label: '~을/를 사용해(서) (using)', hint: 'usage. <noun> + 을/를 사용해(서) = "using / with". 한국어를 사용해서 쓰다 (write using Korean); 신용카드를 사용해 결제 (pay using a credit card). Slightly less formal than 이용해.' },
    { re: /을\s*활용(해|해서|하여|한|하)|를\s*활용(해|해서|하여|한|하)/, label: '~을/를 활용해(서) (utilizing / leveraging)', hint: 'leverage / put to use. <noun> + 을/를 활용해(서) = "by utilizing / leveraging". 자원을 활용하여 (leveraging resources); 데이터를 활용해서 분석한다. Stronger than ~이용해 — implies strategic / creative use.' },
    { re: /(으로|로)\s*활용(되|된|될|되었|되어|돼|됨|됩|하|함)/, label: '~(으)로 활용되다 (be utilized as)', hint: 'passive of 활용하다. <noun> + (으)로 활용되다 = "be utilized / used as / put to use as". 치료에 활용되다 (be utilized in treatment); 교재로 활용되어 왔다 (has been used as teaching material).' },
    { re: /을\s*바탕(으로|으로\s*한|으로\s*하)|를\s*바탕(으로|으로\s*한|으로\s*하)/, label: '~을/를 바탕으로 (based on / on the basis of)', hint: 'basis / foundation. <noun> + 을/를 바탕으로 = "based on / on the basis of / drawing on". 연구를 바탕으로 (based on the research); 경험을 바탕으로 한 조언 (advice based on experience).' },
    { re: /을\s*토대(로|로\s*한|로\s*하)|를\s*토대(로|로\s*한|로\s*하)/, label: '~을/를 토대로 (on the basis of)', hint: 'foundation / underpinning. <noun> + 을/를 토대로 = "on the basis of / built on / underpinned by". 자료를 토대로 분석한다 (analyse on the basis of data). Near-synonym of ~을 바탕으로 — both work in most contexts.' },

    // INFLUENCE / EFFECT / CAUSE
    // Loosened to match the noun "영향" + any common particle, since
    // 영향과 받다/끼치다/미치다 are often separated by adverbs in real
    // sentences (영향을 많이 받는다, 영향을 크게 미치다). Renders as the
    // same card explaining the full collocation family.
    { re: /영향(을|이|으로|에\s*따라)/, label: '~의 영향 (influence / effect)', hint: 'effect / impact collocation. ~의 영향을 받다 = "be influenced/affected by"; ~의 영향을 끼치다 / 미치다 = "have an influence/effect on"; ~의 영향으로 = "due to the influence of". 환경의 영향을 많이 받는다 (greatly influenced by environment); 경제에 영향을 미치다 (has an effect on the economy).' },
    { re: /을\s*야기(하|한|할|했|함)|를\s*야기(하|한|할|했|함)|을\s*초래(하|한|할|했|함)|를\s*초래(하|한|할|했|함)/, label: '~을/를 야기하다 / 초래하다 (cause / give rise to)', hint: 'causation verb collocation (formal / written register). <noun> + 을/를 야기하다 / 초래하다 = "cause / give rise to / bring about". 문제를 야기하다 (cause a problem); 갈등을 초래하다 (give rise to conflict).' },

    // REFERENCE / DEFINITION
    { re: /을\s*가리키(는|다|어|며|기|ㄴ다|ㅂ니다)|를\s*가리키(는|다|어|며|기|ㄴ다|ㅂ니다)/, label: '~을/를 가리키다 (refer to / point to / denote)', hint: 'reference verb. <noun/clause> + 을/를 가리키다 = "refers to / points to / denotes". X를 가리키는 표현이다 = "is an expression that refers to X". 이 단어는 ~를 가리킨다 (this word refers to ~). Almost always followed by 표현/말/용어 in definitions.' },
    { re: /을\s*의미(하|한|할|했|함|함이|합니다)|를\s*의미(하|한|할|했|함|함이|합니다)/, label: '~을/를 의미하다 (mean / signify)', hint: 'semantic equivalence. <noun/clause> + 을/를 의미하다 = "means / signifies / denotes". 이는 ~을 의미한다 (this means ~). Same register as 가리키다 but for abstract meaning rather than physical pointing.' },
    { re: /(이라고|라고)\s*(부르|불리|불렀|불렀다|부른다|부릅니다|불린다|불립니다)/, label: '~(이)라고 부르다 / 불리다 (be called)', hint: 'naming. <noun> + (이)라고 부르다 = "call X as Y" (active); 불리다 = "be called as" (passive). 이 현상을 ~라고 부른다 (this phenomenon is called ~); ~라고 불리는 작품 (the work called ~).' },

    // TARGET / SUBJECT / DEMOGRAPHIC
    { re: /을\s*대상(으로|으로\s*한|으로\s*하)|를\s*대상(으로|으로\s*한|으로\s*하)/, label: '~을/를 대상으로 (targeting / aimed at)', hint: 'target population / scope. <noun> + 을/를 대상으로 = "targeting / aimed at / with X as the subject". 청소년을 대상으로 한 조사 (survey targeting teenagers); 직장인을 대상으로 (aimed at office workers). Common in survey / policy / marketing news.' },
    { re: /을\s*상대(로|로\s*한|로\s*하)|를\s*상대(로|로\s*한|로\s*하)/, label: '~을/를 상대로 (against / vis-à-vis)', hint: 'opponent / counterparty. <noun> + 을/를 상대로 = "against / facing / vis-à-vis". 정부를 상대로 소송 (lawsuit against the government); 외국인을 상대로 한 사업 (business aimed at foreigners). Often confrontational.' },

    // SUITABILITY / FIT
    { re: /에\s*적합(하|한|할|했|합니다|함)/, label: '~에 적합하다 (suitable for / appropriate to)', hint: 'fit / appropriateness. <noun> + 에 적합하다 = "suitable for / appropriate to / right for". 어린이에 적합한 콘텐츠 (content suitable for children); 이 일에 적합하다 (suited for this job). Common in product / education contexts.' },
    { re: /에\s*어울리(는|다|어|어서|며|기|ㄴ다)/, label: '~에 어울리다 (match / go well with)', hint: 'aesthetic / functional fit. <noun> + 에 어울리다 = "matches / goes well with / suits". 옷이 너에게 잘 어울린다 (those clothes suit you well); 분위기에 어울리는 음악 (music that matches the mood).' },
    { re: /에\s*알맞(는|은|다|아|아서|게)/, label: '~에 알맞다 (appropriate for / right for)', hint: 'right amount / right kind. <noun> + 에 알맞다 = "appropriate for / right for / fitting". 수준에 알맞은 책 (a book appropriate for the level); 계절에 알맞은 옷 (clothes appropriate for the season).' },

    // STATUS / POSITION ESTABLISHMENT
    { re: /(으로|로)\s*자리(잡|잡았|잡은|잡을|잡고|잡는|잡혔|잡혀|매김)/, label: '~(으)로 자리잡다 / 자리매김하다 (establish itself as)', hint: 'become established / take root as. <noun> + (으)로 자리잡다 / 자리매김하다 = "establish itself as / take root as / become known as". 명품으로 자리잡았다 (has established itself as a luxury brand); 새 표준으로 자리매김하다 (set itself as the new standard).' },
    { re: /(으로|로)\s*손꼽(히|혀|혔|히는|힌|힐)/, label: '~(으)로 손꼽히다 (be counted among / be regarded as)', hint: 'be ranked / counted among the best of a category. <noun> + (으)로 손꼽히다 = "be counted as / be regarded as one of". 명소로 손꼽히는 곳 (a place counted among famous spots); 최고로 손꼽힌다 (is regarded as the best). News-register superlative.' },

    // QUANTITY DYNAMICS
    { re: /이\s*늘어(나|났|난|날|남|납니다|나는|나고)|가\s*늘어(나|났|난|날|남|납니다|나는|나고)/, label: '~이/가 늘어나다 (increase / grow)', hint: 'trend verb — quantity rises. <subj> + 이/가 늘어나다 = "increases / grows". 인구가 늘어났다 (the population grew); 관심이 늘어나고 있다 (interest is growing). Pairs with 줄어들다 (decrease) for contrast.' },
    { re: /이\s*줄어(들|들었|든|들|듭니다|드는|들고)|가\s*줄어(들|들었|든|들|듭니다|드는|들고)/, label: '~이/가 줄어들다 (decrease / shrink)', hint: 'trend verb — quantity falls. <subj> + 이/가 줄어들다 = "decreases / shrinks / drops". 매출이 줄어들었다 (sales dropped); 인구가 줄어들고 있다 (population is shrinking).' },

    // ACTION COLLOCATIONS (news verbs)
    { re: /을\s*추진(하|한|할|했|함|합니다|중)|를\s*추진(하|한|할|했|함|합니다|중)/, label: '~을/를 추진하다 (push forward / drive)', hint: 'agenda verb. <noun> + 을/를 추진하다 = "push forward / drive / promote". 정책을 추진하다 (push a policy forward); 사업을 추진 중이다 (is in the process of driving the business). Very common in policy/business news.' },
    { re: /을\s*시사(하|한|할|했|함|합니다)|를\s*시사(하|한|할|했|함|합니다)/, label: '~을/를 시사하다 (suggest / imply / hint at)', hint: 'inferential reporting verb. <noun/clause> + 을/를 시사하다 = "suggest / imply / hint at". 변화를 시사하는 결과 (a result that suggests change); 정책 전환을 시사했다 (hinted at a policy shift). Formal news register.' },
    { re: /(으로|로)\s*분류(되|된|될|됐|되어|돼|됩|함|하)/, label: '~(으)로 분류되다 (be classified as)', hint: 'taxonomic placement. <noun> + (으)로 분류되다 = "is classified / categorized as". 1급 발암물질로 분류되다 (classified as a Group 1 carcinogen); 멸종위기종으로 분류된다 (is classified as endangered).' },
    { re: /(으로|로)\s*판단(되|된|될|됐|되어|돼|됩|함|하)/, label: '~(으)로 판단되다 (be judged / determined as)', hint: 'official judgement passive. <noun/clause> + (으)로 판단되다 = "is judged / determined / assessed as". 적절한 조치로 판단된다 (is judged to be an appropriate measure); 사실로 판단되다 (is determined to be true). Formal / legal / news register.' },

    // EVALUATIVE / FRAMING
    { re: /(이|가)\s*돋보(이|여|이는|인다|입니다|이며|이고|였)/, label: '~이/가 돋보이다 (stand out)', hint: 'visual / qualitative prominence. <subj> + 이/가 돋보이다 = "stands out / is striking / is noticeable". 디자인이 돋보인다 (the design stands out); 그의 활약이 돋보였다 (his performance was striking).' },
    { re: /(이|가)\s*눈에\s*띄(다|어|었|는|네|며|고)/, label: '~이/가 눈에 띄다 (catch the eye / be noticeable)', hint: 'idiomatic "catches the eye". <subj> + 이/가 눈에 띄다 = "catches the eye / is noticeable / stands out". 변화가 눈에 띈다 (the change is noticeable); 눈에 띄게 늘었다 (increased noticeably).' },
    { re: /(이|가)\s*화제(다|이다|가\s*되|를\s*모|를\s*불러)/, label: '~이/가 화제이다 / 화제가 되다 (be a hot topic)', hint: 'buzz / trending. <subj> + 이/가 화제이다 / 화제가 되다 / 화제를 모으다 = "is a hot topic / is going viral / is drawing attention". 신곡이 화제다 (the new song is the talk of the town); 화제를 모으고 있다 (is drawing attention).' },

    // ── Round 2 collocations (added 2026-05-24, big batch) ───────────

    // PUBLIC REACTION / ATTENTION
    { re: /(을|를)\s*받(다|아|아서|았|는|네|으면|으니|으며|고|으세|아요)/, label: '~을/를 받다 (receive — generic collocation host)', hint: 'extremely common host verb. Specific collocations: 사랑을 받다 (be loved), 관심을 받다 (get attention), 인기를 받다, 도움을 받다 (receive help), 영향을 받다 (be influenced), 치료를 받다 (receive treatment), 진단을 받다 (be diagnosed), 비판을 받다 (be criticized). Always pair the noun + 받다 mentally as one unit.' },
    { re: /관심(을|이)\s*(끌|모|많|높|높아|보이|받)/, label: '~관심을 끌다 / 관심이 높다 (draw attention / be of high interest)', hint: 'attention collocations. 관심을 끌다 = "draw attention"; 관심을 모으다 = "gather attention"; 관심이 높다 / 많다 = "interest is high / abundant"; 관심이 높아지다 = "interest is rising". 새 정책이 큰 관심을 끌고 있다 (the new policy is drawing big attention).' },
    { re: /인기(가|를)\s*(많|높|좋|끌|얻|모|있)/, label: '~인기가 많다 / 인기를 얻다 (be popular / gain popularity)', hint: 'popularity collocations. 인기가 많다 / 높다 / 좋다 = "is popular"; 인기를 얻다 / 끌다 / 모으다 = "gain / draw popularity"; 인기가 있다 = "has popularity". K팝이 세계적인 인기를 얻고 있다 (K-pop is gaining worldwide popularity).' },
    { re: /주목(을|이|받)/, label: '~주목을 받다 / 주목을 끌다 (draw attention / be noted)', hint: '주목 = focused attention (stronger than 관심). 주목을 받다 / 끌다 / 모으다 = "be in the spotlight / be noted". 새 발견이 학계의 주목을 받고 있다 (the new discovery is being noted by academia). News-register; signals importance.' },
    { re: /충격(을\s*주|을\s*받|을\s*안|이\s*크|적이|적인)/, label: '~충격을 주다 / 충격을 받다 (give / receive a shock)', hint: 'impact collocation. 충격을 주다 = "give / deal a shock"; 충격을 받다 = "be shocked"; 충격이 크다 = "shock is great"; 충격적이다 = "is shocking". 사건이 큰 충격을 주었다 (the incident caused a big shock).' },

    // EVALUATION / OPINION
    { re: /(을|를)\s*평가(하|한|할|했|함|받|받았)/, label: '~을/를 평가하다 / 평가받다 (evaluate / be evaluated)', hint: 'judgement verb. <noun> + 을/를 평가하다 = "evaluates / judges / rates"; 평가받다 = "be rated as". 높이 평가하다 (rate highly); 긍정적으로 평가되고 있다 (is being evaluated positively).' },
    { re: /(을|를)\s*비판(하|한|할|했|함|받|받았)/, label: '~을/를 비판하다 / 비판을 받다 (criticize / be criticized)', hint: 'critique verb. 비판하다 / 비판받다 / 비판이 거세지다 / 비판이 일다 = "criticize / be criticized / criticism intensifies / criticism arises". 정부 정책을 비판하다 (criticize gov policy); 비판이 거세지고 있다.' },
    { re: /(을|를)\s*칭찬(하|한|할|했|함|받|받았)/, label: '~을/를 칭찬하다 / 칭찬을 받다 (praise / be praised)', hint: 'praise verb. <noun> + 을/를 칭찬하다 = "praises"; 칭찬을 받다 = "be praised". 노력을 칭찬받았다 (was praised for the effort). Often paired with a description: 따뜻한 마음을 칭찬받다.' },
    { re: /(을|를)\s*지지(하|한|할|했|함|받|받았)/, label: '~을/를 지지하다 / 지지를 받다 (support / be supported)', hint: 'endorsement verb. 지지하다 = "support / endorse"; 지지받다 = "be supported"; 지지율이 오르다 / 떨어지다 = "approval rating rises/falls". Political and policy news pervasive.' },
    { re: /(을|를)\s*반대(하|한|할|했|함)/, label: '~을/를 반대하다 (oppose)', hint: 'opposition verb. <noun> + 을/를 반대하다 = "oppose / object to". 정책을 반대하다 (oppose the policy); 반대 의견을 표명하다 (express opposing opinion). Often paired with 찬성하다 (support).' },

    // ACHIEVEMENT / RESULT
    { re: /(을|를)\s*달성(하|한|할|했|함|되|된)/, label: '~을/를 달성하다 (achieve / attain)', hint: 'goal-achievement verb. <noun> + 을/를 달성하다 = "achieve / attain / reach". 목표를 달성하다 (achieve the goal); 매출 1조 원을 달성했다 (attained 1 trillion won in sales). Business and policy news.' },
    { re: /(을|를)\s*이루(다|어|었|는|어\s*내|며|어서|어\s*낸|어\s*낼)/, label: '~을/를 이루다 / 이루어 내다 (achieve / accomplish)', hint: 'accomplishment verb. <noun> + 을/를 이루다 = "achieve / form / realize". 꿈을 이루다 (realize a dream); 합의를 이루다 (reach an agreement); 성과를 이루어 냈다 (achieved a notable result).' },
    { re: /(을|를)\s*거두(다|어|었|는|어들|며|어서|었\s*다)/, label: '~을/를 거두다 (attain / harvest / reap)', hint: 'attainment verb (results, victories). <noun> + 을/를 거두다 = "attain / reap / harvest". 좋은 성적을 거두다 (attain good grades); 우승을 거두다 (win the championship); 큰 성과를 거두었다 (reaped great results).' },
    // (~을/를 기록하다 — earlier removed as lexical-not-grammar. Keep
    // out: 기록 is just a vocab word, surfaces via vocab[] naturally.)
    { re: /(이|가)\s*증가(하|한|할|했|함)|(이|가)\s*감소(하|한|할|했|함)/, label: '~이/가 증가하다 / 감소하다 (increase / decrease — formal)', hint: 'formal trend verbs (vs colloquial 늘어나다/줄어들다). <subj> + 이/가 증가하다 = "increases" / 감소하다 = "decreases". 매출이 증가하고 있다 (sales are increasing); 인구가 감소하는 추세다 (population is on a decreasing trend). News/business register.' },

    // STRUGGLE / DIFFICULTY
    { re: /어려움(을|이)\s*(겪|겪다|겪었|겪는|있|있다)/, label: '어려움을 겪다 (face / undergo difficulty)', hint: 'hardship collocation. 어려움을 겪다 = "face / undergo / experience hardship". 경영 어려움을 겪고 있다 (is facing managerial difficulty); 어려움이 있지만 (although there are difficulties).' },
    { re: /위기(에|를|가)\s*(처|맞|봉착|닥|있)/, label: '위기에 처하다 / 위기를 맞다 (face a crisis)', hint: 'crisis collocation. 위기에 처하다 / 위기를 맞다 / 위기에 봉착하다 / 위기가 닥치다 = "face / encounter / be in a crisis". 회사가 위기에 처했다 (the company is in crisis); 경제 위기를 맞다 (face an economic crisis).' },
    { re: /피해(를|가)\s*(입|입었|입는|보|발생|커|크)/, label: '피해를 입다 / 피해가 발생하다 (suffer damage)', hint: 'damage collocation. 피해를 입다 = "suffer / sustain damage"; 피해가 발생하다 = "damage occurs"; 피해가 커지다 / 크다 = "damage grows / is large". 태풍으로 큰 피해를 입었다 (sustained big damage from the typhoon).' },
    { re: /(을|를)\s*막(다|아|아서|았|는|네|기|기\s*위해|으면|으려|아\s*내)/, label: '~을/를 막다 / 막아 내다 (prevent / block)', hint: 'prevention verb. <noun> + 을/를 막다 = "prevent / block / fend off". 사고를 막다 (prevent an accident); 확산을 막아 내다 (fend off the spread); 막기 위해 노력하다 (work to prevent).' },

    // DECISION / DETERMINATION
    { re: /(을|를)\s*결정(하|한|할|했|함|되|된|됐|돼)/, label: '~을/를 결정하다 / 결정되다 (decide / be decided)', hint: 'decision verb. <noun> + 을/를 결정하다 = "decides"; 결정되다 = "is decided". 정책을 결정하다 (decide the policy); 다음 회의에서 결정될 예정이다 (will be decided at the next meeting).' },
    { re: /(을|를)\s*판단(하|한|할|했|함|되|된)/, label: '~을/를 판단하다 / 판단되다 (judge / determine)', hint: 'judgement verb. <noun/clause> + 을/를 판단하다 = "judges / determines"; 판단되다 = "is judged / determined". 적절성을 판단하다 (judge the appropriateness); 사실로 판단된다 (is judged to be true).' },
    { re: /(을|를)\s*선택(하|한|할|했|함|되|된)/, label: '~을/를 선택하다 / 선택되다 (choose / be chosen)', hint: 'choice verb. <noun> + 을/를 선택하다 = "chooses / selects"; 선택되다 = "is chosen". 옵션을 선택하다 (choose an option); 후보로 선택되었다 (was chosen as a candidate).' },

    // POLICY / LAW / REGULATION
    { re: /(을|를)\s*시행(하|한|할|했|함|되|된)/, label: '~을/를 시행하다 / 시행되다 (implement / take effect)', hint: 'policy enactment verb. <noun> + 을/를 시행하다 = "implements / enforces"; 시행되다 = "takes effect". 법안이 시행되다 (the bill takes effect); 새 정책을 시행하다 (implement a new policy). Heavy news register.' },
    { re: /(을|를)\s*도입(하|한|할|했|함|되|된)/, label: '~을/를 도입하다 / 도입되다 (introduce / adopt)', hint: 'adoption verb. <noun> + 을/를 도입하다 = "introduces / adopts / brings in". 새 시스템을 도입하다 (introduce a new system); 한국에 도입된 기술 (technology introduced to Korea). Common in tech and policy.' },
    { re: /(을|를)\s*강화(하|한|할|했|함|되|된)/, label: '~을/를 강화하다 / 강화되다 (strengthen / be reinforced)', hint: 'strengthening verb. <noun> + 을/를 강화하다 = "strengthens / reinforces / tightens". 규제를 강화하다 (tighten regulations); 보안이 강화되었다 (security was strengthened). Policy and security news.' },
    { re: /(을|를)\s*완화(하|한|할|했|함|되|된)/, label: '~을/를 완화하다 / 완화되다 (ease / loosen)', hint: 'opposite of 강화. <noun> + 을/를 완화하다 = "eases / relaxes / loosens". 규제를 완화하다 (ease regulations); 통증이 완화되었다 (pain was relieved). Common in economic and medical contexts.' },

    // INVESTIGATION / INQUIRY
    { re: /(을|를)\s*조사(하|한|할|했|함|중|되|된)/, label: '~을/를 조사하다 / 조사 중 (investigate / be investigating)', hint: 'investigation verb. <noun> + 을/를 조사하다 = "investigates / studies / surveys". 사건을 조사하다 (investigate an incident); 원인을 조사하고 있다 (is investigating the cause); 조사 결과 (investigation result).' },
    { re: /(을|를)\s*확인(하|한|할|했|함|되|된)/, label: '~을/를 확인하다 / 확인되다 (confirm / verify)', hint: 'confirmation verb. <noun/clause> + 을/를 확인하다 = "confirms / verifies"; 확인되다 = "is confirmed". 사실을 확인하다 (confirm a fact); 양성으로 확인되었다 (was confirmed positive). Critical in journalism.' },
    { re: /(을|를)\s*발견(하|한|할|했|함|되|된)/, label: '~을/를 발견하다 / 발견되다 (discover / be found)', hint: 'discovery verb. <noun> + 을/를 발견하다 = "discovers / finds"; 발견되다 = "is discovered / found". 새 종을 발견하다 (discover a new species); 시신이 발견되었다 (a body was found).' },

    // SPEECH / COMMUNICATION
    { re: /의견(을|이)\s*(내|내놓|제시|보이|모이|밝|있)/, label: '~의견을 내다 / 의견을 제시하다 (offer / present an opinion)', hint: 'opinion verb. 의견을 내다 / 내놓다 / 제시하다 / 보이다 / 밝히다 = "offer / present / express an opinion". 다양한 의견이 나왔다 (various opinions emerged); 의견을 모으다 (gather opinions).' },
    { re: /(을|를)\s*주장(하|한|할|했|함)/, label: '~을/를 주장하다 (assert / claim)', hint: 'assertion verb. <noun/clause> + 을/를 주장하다 = "asserts / argues / claims". 무죄를 주장하다 (claim innocence); 개혁을 주장하다 (advocate reform). Stronger than 의견을 내다.' },
    { re: /(을|를)\s*강조(하|한|할|했|함)/, label: '~을/를 강조하다 (emphasize)', hint: 'emphasis verb. <noun/clause> + 을/를 강조하다 = "emphasizes / stresses / highlights". 중요성을 강조하다 (emphasize the importance); 필요성을 강조했다 (emphasized the need). News-quoting register.' },
    { re: /(을|를)\s*제기(하|한|할|했|함|되|된)/, label: '~을/를 제기하다 / 제기되다 (raise / be raised — formal)', hint: 'formal "raise" verb. <noun> + 을/를 제기하다 = "raises / brings up"; 제기되다 = "is raised". 문제를 제기하다 (raise an issue); 의혹이 제기되었다 (suspicions were raised). Legal / journalistic.' },

    // ROLE / RESPONSIBILITY
    { re: /역할(을|이)\s*(하|한|할|했|함|맡|있|있다|크|중요)/, label: '~역할을 하다 / 역할을 맡다 (play / take on a role)', hint: 'role collocation. 역할을 하다 = "plays a role"; 역할을 맡다 = "takes on a role"; 역할이 크다 / 중요하다 = "the role is big / important". 중요한 역할을 한다 (plays an important role).' },
    { re: /책임(을|이)\s*(지|있|있다|있는|다|진다|졌|맡)/, label: '책임을 지다 / 책임이 있다 (take responsibility / be responsible)', hint: 'responsibility collocation. 책임을 지다 = "take responsibility"; 책임이 있다 = "be responsible"; 책임을 다하다 = "fulfill responsibility"; 책임을 묻다 = "hold accountable". 사고에 책임을 지다 (take responsibility for the accident).' },

    // CHANGE / DEVELOPMENT
    { re: /변화(가|이|를)\s*(있|있다|많|크|일|일었|일어|보이|나|나타|시작)/, label: '~변화가 있다 / 변화를 보이다 (there is / shows change)', hint: 'change noun collocations. 변화가 있다 / 일다 / 일어나다 = "change occurs / arises"; 변화를 보이다 = "shows change". 큰 변화가 일고 있다 (big change is unfolding); 변화의 필요성 (need for change).' },
    { re: /발전(을|이|에|을\s*이|이\s*되|된|시키)/, label: '~발전을 이루다 / 발전이 되다 (develop / make progress)', hint: 'development collocation. 발전을 이루다 / 거두다 = "achieve development"; 발전하다 / 발전되다 = "develop / be developed"; 발전에 기여하다 = "contribute to development". 기술 발전이 빠르다 (technology development is fast).' },
    { re: /(을|를)\s*개선(하|한|할|했|함|되|된)/, label: '~을/를 개선하다 / 개선되다 (improve)', hint: 'improvement verb. <noun> + 을/를 개선하다 = "improves / enhances"; 개선되다 = "is improved". 환경을 개선하다 (improve the environment); 성능이 개선되었다 (performance was improved).' },

    // BUSINESS / ECONOMY
    { re: /시장(을|이|에|에서)\s*(공략|진출|형성|확대|개척|점유|선도)/, label: '~시장을 공략하다 / 시장에 진출하다 (target / enter a market)', hint: 'market collocations. 시장을 공략하다 = "target the market"; 시장에 진출하다 = "enter the market"; 시장을 형성하다 = "form a market"; 시장을 점유하다 = "occupy market share". Heavy business register.' },
    { re: /매출(이|을|이\s*늘|이\s*줄|을\s*올|을\s*올렸)/, label: '매출이 늘다 / 매출을 올리다 (sales rise / boost sales)', hint: 'sales collocation. 매출이 늘다 / 증가하다 / 오르다 = "sales rise"; 매출이 줄다 / 감소하다 = "sales fall"; 매출을 올리다 = "boost sales". 매출이 사상 최고를 기록했다 (sales recorded all-time high).' },
    { re: /(이|가)\s*늘어나(?!나)|(이|가)\s*증가세(를|에)/, label: '~증가세를 보이다 (show an upward trend)', hint: 'trend description. 증가세를 보이다 = "show an upward trend"; 감소세를 보이다 = "show a downward trend"; 상승세 / 하락세를 보이다 = "show rising / falling trend". 매출이 증가세를 보이고 있다.' },

    // SCIENCE / TECH
    { re: /(을|를)\s*개발(하|한|할|했|함|되|된|중)/, label: '~을/를 개발하다 / 개발되다 (develop / be developed)', hint: 'tech/product development verb. <noun> + 을/를 개발하다 = "develops"; 개발되다 = "is developed". 백신을 개발하다 (develop a vaccine); 신기술이 개발되었다 (a new tech was developed).' },
    // (~을/를 상용화하다 dropped — already covered by the broader
    // ~화하다/~화되다 (-ization / -ize) pattern at line ~511.)
    { re: /(을|를)\s*적용(하|한|할|했|함|되|된)/, label: '~을/를 적용하다 / 적용되다 (apply / be applied)', hint: 'application verb. <noun> + 을/를 적용하다 = "applies"; 적용되다 = "is applied". 새 기준을 적용하다 (apply new standards); 모든 사용자에게 적용된다 (applies to all users).' },

    // CRIME / ACCIDENT
    { re: /(이|가)\s*발생(하|한|할|했|함|되|된)/, label: '~이/가 발생하다 (occur / happen — formal)', hint: 'formal occurrence verb (vs colloquial 일어나다 / 나다). <subj> + 이/가 발생하다 = "occurs / happens / is generated". 사고가 발생했다 (an accident occurred); 문제가 발생할 가능성 (possibility that a problem arises). Heavy news register.' },
    { re: /(을|를)\s*저지르(다|어|었|는|네|며|기)/, label: '~을/를 저지르다 (commit — wrongdoing)', hint: 'crime-collocation verb. <crime> + 을/를 저지르다 = "commit (a crime/wrongdoing)". 범죄를 저지르다 (commit a crime); 실수를 저지르다 (make a mistake — negative connotation).' },

    // HEALTH / TREATMENT
    { re: /(을|를)\s*치료(하|한|할|했|함|되|된|받|받았)/, label: '~을/를 치료하다 / 치료받다 (treat / be treated)', hint: 'medical treatment verb. <noun> + 을/를 치료하다 = "treat"; 치료받다 = "receive treatment"; 치료되다 = "be treated". 환자를 치료하다 (treat a patient); 암을 치료할 수 있다 (can treat cancer).' },
    { re: /진단(을\s*받|을\s*내리|을\s*하|하|한|할|했|함|받|받았|받는|받은)|(으로|로)\s*진단(받|되|된)/, label: '~을/를 진단하다 / 진단받다 (diagnose / be diagnosed)', hint: 'diagnosis verb. <noun> + 을/를 진단하다 = "diagnoses"; 진단받다 = "be diagnosed"; X(으)로 진단받다 = "be diagnosed AS X". 암으로 진단받다 (be diagnosed with cancer); 정확한 진단을 받다 (receive an accurate diagnosis).' },
    { re: /증상(이|을)\s*(나|나타|보이|있|호소|완화)/, label: '~증상이 나타나다 / 증상을 보이다 (show / develop symptoms)', hint: 'symptom collocation. 증상이 나타나다 / 보이다 = "symptoms appear / show"; 증상을 호소하다 = "complain of symptoms"; 증상이 완화되다 = "symptoms are relieved". 발열 증상이 나타났다 (fever symptoms appeared).' },

    // PURPOSE / GOAL
    { re: /목표(를|로|가|이)\s*(삼|두|달|이|있|세우|향)/, label: '~목표로 삼다 / 목표를 세우다 (set / aim for a goal)', hint: 'goal collocation. 목표로 삼다 = "set as a goal"; 목표를 세우다 = "set a goal"; 목표를 달성하다 = "achieve a goal"; 목표가 있다 = "have a goal". 1조 원을 목표로 한다 (aims for 1 trillion won).' },

    // OPPORTUNITY / RISK
    { re: /기회(가|를)\s*(있|많|얻|놓|잡|마련|제공)/, label: '~기회가 있다 / 기회를 잡다 (have / seize an opportunity)', hint: 'opportunity collocation. 기회가 있다 / 많다 = "there is / many opportunities"; 기회를 얻다 / 잡다 = "get / seize an opportunity"; 기회를 놓치다 = "miss an opportunity"; 기회를 제공하다 = "provide an opportunity". 좋은 기회를 잡았다 (seized a good chance).' },

    // GENERIC ACTION FRAMERS — extremely common
    { re: /노력(을|이)\s*(하|기울|들이|기울이|있|많|보이|크)/, label: '노력을 하다 / 노력을 기울이다 (make an effort)', hint: 'effort collocation. 노력을 하다 = "make an effort"; 노력을 기울이다 / 들이다 = "put in effort"; 노력이 필요하다 = "effort is needed"; 노력이 보이다 = "effort is visible". 큰 노력을 기울이고 있다 (is putting in big effort).' },
    { re: /(을|를)\s*기울이(다|어|었|는|며|기)/, label: '~을/를 기울이다 (devote / put forth — formal)', hint: 'formal "devote" host verb. <noun (often abstract: 노력/관심/열정)> + 을/를 기울이다 = "devote / dedicate / put forth". 노력을 기울이다 (devote effort); 관심을 기울이다 (pay attention). News and formal register only.' },
    { re: /(을|를)\s*벌이(다|어|었|는|며|기|어\s*놓|어\s*나)/, label: '~을/를 벌이다 (carry out / wage)', hint: 'large-scale action verb. <noun> + 을/를 벌이다 = "carry out / wage / hold". 캠페인을 벌이다 (run a campaign); 토론을 벌이다 (hold a debate); 수사를 벌이다 (conduct an investigation). Often for events with multiple participants.' },
    { re: /(을|를)\s*나서(다|어|었|는|며)/, label: '~에 나서다 (step forward / take action)', hint: 'initiative verb. <noun> + 에 나서다 = "step forward to / take the lead in / undertake". 수사에 나서다 (step into the investigation); 구조에 나서다 (move in for rescue); 회담에 나서다 (enter into talks).' },
    { re: /(을|를)\s*제공(하|한|할|했|함|되|된)/, label: '~을/를 제공하다 / 제공되다 (provide / be provided)', hint: 'provision verb. <noun> + 을/를 제공하다 = "provides / offers"; 제공되다 = "is provided". 정보를 제공하다 (provide info); 무료로 제공된다 (is provided for free). Business and service register.' },
    { re: /(을|를)\s*제공받|를\s*받는다는|을\s*받는다는/, label: '~을/를 제공받다 (be provided with)', hint: 'passive of 제공하다. <noun> + 을/를 제공받다 = "be provided with / receive". 무료로 식사를 제공받다 (be provided with a free meal); 정부 지원을 제공받았다.' },

    // EDUCATION-SPECIFIC
    { re: /도움(을|이)\s*(되|된|돼|돼서|됩|많|크|받|받았|주|주는|주었)/, label: '도움이 되다 / 도움을 받다 (be helpful / receive help)', hint: 'help collocation. 도움이 되다 = "is helpful / useful"; 도움을 주다 = "give help"; 도움을 받다 = "receive help"; 큰 도움이 되다 = "is a big help". 학습에 도움이 된다 (is helpful for learning); 친구에게 도움을 청하다 (ask a friend for help).' },
    { re: /효과(가|를|이|적)\s*(있|크|좋|적|적인|많|보이|발휘|얻|기대|뛰어)/, label: '효과가 있다 / 효과를 보이다 (be effective)', hint: 'effectiveness collocation. 효과가 있다 = "is effective"; 효과가 크다 / 뛰어나다 = "is highly effective"; 효과를 보이다 = "shows effect"; 효과를 발휘하다 = "exhibits effect"; 효과적이다 = "is effective". Common in product / health / education claims.' },
    { re: /의미(가|를)\s*(있|있다|크|보이|두|지|지니|찾|있는|없)/, label: '의미가 있다 / 의미를 두다 (be meaningful / find meaning)', hint: 'meaning collocation. 의미가 있다 = "is meaningful"; 의미가 크다 = "is highly significant"; 의미를 두다 = "place importance on"; 의미를 찾다 = "find meaning"; 의미를 지니다 = "carry meaning".' },

    // SPATIAL / CHRONOLOGICAL ANCHORING
    { re: /(은|는|이|가)\s*물론(?=[\s,.!?]|이|$)/, label: '~은/는 물론(이고) (of course / not to mention)', hint: 'inclusive emphasis. A는 물론(이고) B도 = "A is of course, and B too / not only A but also B". 학생은 물론이고 직장인도 (not only students but also office workers); 가격은 물론 품질도 좋다 (quality is good, let alone the price).' },
    // BUG FIX: previous regex `이|가\s*뿐만\s*아니라|뿐만\s*아니라` had
    // no parens, so it matched bare `이` (subject particle) alone — half
    // of all Korean sentences fired this pattern. Now requires literal
    // 뿐만 아니라.
    { re: /뿐만\s*아니라/, label: '~뿐만 아니라 (not only / on top of)', hint: 'additive emphasis. A뿐만 아니라 B도 = "not only A but also B". 한국에서뿐만 아니라 세계적으로도 인기다 (popular not only in Korea but worldwide). Slightly more formal than ~만이 아니라.' },
    { re: /(으로|로)\s*이어(지|졌|진|져)/, label: '~(으)로 이어지다 (lead to / result in)', hint: 'causation/result. <noun> + (으)로 이어지다 = "lead to / result in / be linked to". 노력이 결과로 이어졌어요 = "efforts led to results"' },
    { re: /(으로|로)\s*인(해|한|하여)/, label: '~(으)로 인해/인한 (due to)', hint: 'causation. <noun> + (으)로 인해 = "due to / because of"' },
    { re: /에\s*대한\s*[가-힣]/, label: '~에 대한 N (about/regarding N) [adnominal]', hint: 'attributive form. <noun> + 에 대한 + <noun> = "the X about Y". ~에 대한 관심 = "interest in"' },
    { re: /을\s*비롯한(?=[^가-힣]|$)|를\s*비롯한(?=[^가-힣]|$)/, label: '~을/를 비롯한 (including)', hint: 'inclusive listing. "including / starting with"' },
    { re: /과\s*관련(된|하여|해서)(?=[^가-힣]|$)|와\s*관련(된|하여|해서)(?=[^가-힣]|$)/, label: '~과/와 관련된 (related to)', hint: 'connection. "related to / regarding"' },
    { re: /의\s*경우(?=[^가-힣]|$)/, label: '~의 경우 (in the case of)', hint: 'case-specifying. "in the case of"' },
    { re: /만에(?=[^가-힣]|$)/, label: '~만에 (after a (long) gap of)', hint: 'time-elapsed pattern with emphasis on how long it has been. <time> + 만에 = "after X time / for the first time in X". 3년 만에 만났다 (met for the first time in 3 years / met after 3 years apart), 일주일 만에 다 끝냈다 (finished it in just a week — emphasising speed). ⚠️ Distinct from ~만 (only) — ~만 attaches with no space and means restriction; ~만에 needs a time expression and implies a notable gap.' },
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
    // ~기에 vs locative 기+에 — fossil place adverbs 여기에/거기에/저기에
    // would match [가-힣]기에\s+[가-힣] (e.g. "여기에 앉으세요"), but the
    // 기 there is part of the demonstrative noun, not the nominalizer.
    // Skip when chars before the matched [가-힣] are 여/거/저 + the
    // [가-힣] itself is 기 (i.e. 여기/거기/저기 + 에).
    { _check: function(t) {
        if (!t) return '';
        var re = /[가-힣]기에\s+[가-힣]/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          var x = t.charAt(m.index);
          if (x === '여' || x === '거' || x === '저') continue;
          return m[0];
        }
        return '';
      }, label: '~기에 (formal because — written register)', hint: 'formal cause connector. <stem> + 기에 = "because / since (formal)". 학생이기에 (because he\'s a student); 비싸기에 사지 않았다.' },
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
    // Removed: 기록하다/기록되다. A specific verb lemma doesn't belong
    // in a GRAMMAR pattern detector — it's a vocabulary item, not a
    // morphological/syntactic pattern. Surfacing it as a "grammar
    // pattern" misleads the learner ("기록하다 means record" is a
    // dictionary entry, not a pattern to study).
    { re: /의\s*일종(이|이다|입니다|으로|이라)/, label: '~의 일종이다 (is a kind / type of)', hint: 'classification marker. <noun> + 의 일종이다 = "is a kind / type of (X)". 운동의 일종이다 (is a kind of exercise); 사기의 일종으로 분류된다 (is classified as a kind of fraud).' },

    // ── Honorifics ──────────────────────────────────────────────
    // ~(으)셨 honorific past — false-fires on 시-stem verbs whose
    // 시+었 contracts to 셨 (마시다 → 마셨, 모시다 → 모셨). Those are
    // just past tense, not honorific. Exclude X=마 (마셨 = drank) —
    // the most common false positive. 모셨 left in (often legitimately
    // honorific in context, "served the elder").
    { _check: function(t) {
        if (!t) return '';
        var re = /(으셨|셨)(어요|습니다|네|군|는)/g;
        var m;
        while ((m = re.exec(t)) !== null) {
          if (m[1] === '셨' && m.index > 0) {
            var prev = t.charAt(m.index - 1);
            if (prev === '마') continue; // 마셨다 = 마시+었, not honorific
          }
          return m[0];
        }
        return '';
      }, label: '~(으)셨 (honorific past)', hint: 'subject honorific past tense. <stem> + (으)시 + 었 → contracts to (으)셨. 가시다 → 가셨다 / 가셨어요 (went, honorific); 받으셨다 (received, honorific). ⚠️ Distinct from 시-stem verbs that incidentally produce 셨 — 마시다 → 마셨다 (drank) is plain past, not honorific.' },
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
  //
  // ⚠️ Keys MUST match the current `label` strings exactly. When you
  // rename a label (e.g. ~의 → ~의 (possessive / relational)), update
  // the key here too — otherwise the skip silently stops working and
  // Intermediate/Advanced users get every basic particle as a card on
  // every sentence (user-reported 2026-05-24).
  var INTERMEDIATE_SKIP_LABELS = {
    '~을/를 (object marker)': 1,
    '~이/가 (subject marker)': 1,
    '~은/는 (topic marker)': 1,
    '~의 (possessive / relational)': 1,
    '~에 (location / time / direction / target)': 1,
    '~아/어/여요 (present polite)': 1,
    '~아/어/여요 (present polite — contracted)': 1,
    '~ㅂ/습니다 (present formal)': 1,
    '~는 (present verb modifier)': 1,
    '~ㄴ/은 (past verb / present adj modifier)': 1,
    // Also noisy at Intermediate+ — but kept OUT of skip list for now
    // because the dual-meaning expansion makes them less repetitive
    // (e.g. ~도 'also' vs 'even', ~까지 'until' vs 'even'):
    //   ~도 (also / even), ~까지 (until / even / as much as), ~만 (only / just)
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

  // Extend a raw regex match outward to the nearest word boundary so
  // the chunk shown to the learner is the whole readable word, not a
  // 2-syllable suffix. e.g. for "이렇게" against /[가-힣]게(?=...)/,
  // the raw match is "렇게"; this widens to "이렇게". For "대도시에서"
  // against /[가-힣]에서/, raw is "시에서"; widens to "대도시에서".
  //
  // Word boundary = whitespace, punctuation, start/end of string. We
  // don't extend rightward into the next word because most patterns
  // already include their full trailing morpheme in the match (the
  // truncation always happens on the leading side).
  function _widenToWord(text, matchIdx, matchLen) {
    if (matchIdx == null || matchIdx < 0) return null;
    // Some regexes (e.g. [가-힣]로\s) include trailing whitespace in
    // their match. Pull the match-end inward past any trailing space /
    // punctuation BEFORE widening rightward, otherwise we'd skip
    // straight over the boundary and grab the next word too.
    var rawEnd = matchIdx + matchLen;
    while (rawEnd > matchIdx && /\s|[.,!?;:]/.test(text.charAt(rawEnd - 1))) rawEnd--;
    // Similarly trim leading whitespace inside the match.
    var rawStart = matchIdx;
    while (rawStart < rawEnd && /\s|[.,!?;:]/.test(text.charAt(rawStart))) rawStart++;

    // Walk backward from rawStart while we're still inside a Hangul
    // word: stop on whitespace or punctuation. The Hangul block alone
    // is 0xAC00-0xD7A3; we also accept other Korean Jamo characters
    // that appear in canonical morpheme strings.
    var i = rawStart;
    while (i > 0) {
      var c = text.charCodeAt(i - 1);
      var isHangul = (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E);
      if (!isHangul) break;
      i--;
    }
    // Extend rightward across trailing Hangul up to next boundary —
    // catches cases where the regex stopped mid-word (e.g. "면서"
    // match should grow to "들어가면서").
    var j = rawEnd;
    while (j < text.length) {
      var c2 = text.charCodeAt(j);
      var isHangul2 = (c2 >= 0xAC00 && c2 <= 0xD7A3) || (c2 >= 0x3131 && c2 <= 0x318E);
      if (!isHangul2) break;
      j++;
    }
    if (i === matchIdx && j === matchIdx + matchLen) return null;
    return text.slice(i, j);
  }

  // Find the actual chunk in `text` that triggered pattern `p`. Used by
  // enforce to produce a non-empty example_in_sentence — without it the
  // article renderer's filter (sentNoWs.indexOf(ex) < 0) drops the entry,
  // which made every enforce-injected pattern silently invisible to users.
  // After getting the raw regex match, widen it outward to the nearest
  // word boundary so users see "이렇게" instead of "렇게" and
  // "대도시에서" instead of "시에서".
  function _extractExample(text, p) {
    if (!text) return '';
    if (p.re) {
      var m = text.match(p.re);
      if (m && m[0]) {
        var idx = text.indexOf(m[0]);
        var wider = _widenToWord(text, idx, m[0].length);
        return wider || m[0];
      }
      var stripped = text.replace(/\s+/g, '');
      m = stripped.match(p.re);
      if (m && m[0]) return m[0];
    } else if (p._check) {
      // _check callbacks return the matched chunk string when matched, ''
      // otherwise. Use the chunk directly so example_in_sentence reflects
      // the actual surface form that triggered detection.
      var chunk = p._check(text);
      if (typeof chunk === 'string' && chunk) {
        var idx2 = text.indexOf(chunk);
        if (idx2 >= 0) {
          var wider2 = _widenToWord(text, idx2, chunk.length);
          if (wider2) return wider2;
        }
        return chunk;
      }
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
  // Label-only catalog for prompt injection. Same checklist effect
  // as formatFullCatalog but ~70% smaller (~2K tokens vs ~9K) since
  // Sonnet already knows what each canonical pattern means from its
  // built-in Korean grammar knowledge — just naming + enumeration is
  // the value-add. Used by runAutoGenerate where speed matters and
  // the body doesn't exist for pre-detection.
  function formatLabelCatalog() {
    return PATTERNS.map(function(p, i) {
      return (i + 1) + '. ' + p.label;
    }).join('\n');
  }

  function formatFullCatalog() {
    return PATTERNS.map(function(p, i) {
      return (i + 1) + '. ' + p.label + ' — ' + (p.hint || '');
    }).join('\n');
  }

  // Revised Romanization of Korean — syllable-by-syllable converter
  // for filling in missing word_rom / reading columns without an AI
  // call. Hyphenated between syllables to match the existing admin
  // autofill format (e.g. 한국어 → "han-guk-eo"). Does NOT apply
  // batchim assimilation rules (신라 → "sin-ra" instead of "sil-la")
  // because for hover-tooltip use the literal syllable-by-syllable
  // form is more pedagogically useful (learners can map each hangul
  // syllable to its sound) and correctly-assimilated form requires a
  // much larger ruleset.
  var _ROM_INITIAL = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  var _ROM_MEDIAL  = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  // Final consonants: index 0 = no batchim, 1-27 = standard 종성 set.
  // Cluster batchims (ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ) reduce to their
  // pronounced final per the simplified-coda rule.
  var _ROM_FINAL = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','h'];
  function romanize(text) {
    if (!text) return '';
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        var idx = c - 0xAC00;
        var ini = Math.floor(idx / 588);
        var med = Math.floor((idx % 588) / 28);
        var fin = idx % 28;
        out.push(_ROM_INITIAL[ini] + _ROM_MEDIAL[med] + _ROM_FINAL[fin]);
      } else if (/\s/.test(text.charAt(i))) {
        if (out.length && out[out.length - 1] !== ' ') out.push(' ');
      } else {
        // Pass-through ASCII / punctuation / other non-Hangul
        out.push(text.charAt(i));
      }
    }
    // Join syllables with hyphens, but reset between whitespace-separated
    // words so "한국 사람" → "han-guk sa-ram" not "han-guk- -sa-ram".
    return out.reduce(function(acc, syl) {
      if (syl === ' ') return acc + ' ';
      if (!acc || acc.charAt(acc.length - 1) === ' ') return acc + syl;
      return acc + '-' + syl;
    }, '');
  }

  window.KH_GRAMMAR = {
    detect: detect,
    detectForLevel: detectForLevel,
    enforceDetectedPatterns: enforceDetectedPatterns,
    formatPromptList: formatPromptList,
    formatFullCatalog: formatFullCatalog,
    formatLabelCatalog: formatLabelCatalog,
    romanize: romanize,
    _PATTERNS: PATTERNS,  // exposed for testing only
  };
})();
