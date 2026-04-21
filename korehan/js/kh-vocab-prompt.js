/* ──────────────────────────────────────────────────────────────
 * KH_VOCAB — hardened article-vocab Claude prompt + validator.
 *
 * Standalone module so it can be loaded by both the public site
 * (via korehan-shared.js — which still defines an identical copy
 * for backward compatibility) AND the admin CMS (which doesn't
 * load shared.js). Whichever loads first wins; redefining is
 * harmless because the IIFE just reassigns window.KH_VOCAB.
 * ────────────────────────────────────────────────────────────── */
(function(){
  if (window.KH_VOCAB && window.KH_VOCAB.promptText && window.KH_VOCAB.validateBest) return;

  var BLACKLIST = {
    '정말':1,'많이':1,'너무':1,'진짜':1,'아주':1,'매우':1,'조금':1,'좀':1,
    '잘':1,'또':1,'다':1,'더':1,'이미':1,'그냥':1,'그리고':1,'그래서':1,
    '하지만':1,'근데':1,'만약':1,'물론':1,'아마':1,'특히':1,'바로':1,'약':1,
    '한국':1,'사람':1,'것':1,'수':1,'거':1,'때':1,'일':1,'곳':1,'말':1,
    '집':1,'나':1,'너':1,'우리':1,'저':1,'제':1,'이':1,'그':1,'저거':1,
    '분':1,'년':1,'월':1,'오늘':1,'어제':1,'내일':1,
    '있다':1,'없다':1,'하다':1,'되다':1,'가다':1,'오다':1
  };

  function stemMatch(body, word) {
    if (!word || word.length < 2) return false;
    if (body.indexOf(word) !== -1) return true;
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(^|[^\\uAC00-\\uD7A3])' + escaped + '(?![\\uAC00-\\uD7A3])');
    if (re.test(body)) return true;
    if (/[다요]$/.test(word) && word.length >= 3) {
      var stem = word.slice(0, -1);
      var sre = new RegExp('(^|[^\\uAC00-\\uD7A3])' + stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '[\\uAC00-\\uD7A3]{0,4}(?![\\uAC00-\\uD7A3])');
      if (sre.test(body)) return true;
    }
    return false;
  }

  function promptText(level, body) {
    var levelHint = level ? level : 'Intermediate';
    return [
      'You are a Korean language teacher curating study vocabulary from THIS news article.',
      '',
      'Return **10 to 12** key vocabulary items a ' + levelHint + ' learner should study from this article.',
      '',
      'MANDATORY RULES:',
      '1. Each item\'s Korean form OR its natural conjugation MUST literally appear in the article body. Do NOT invent words or pick words not present.',
      '2. Output the DICTIONARY FORM. Verbs/adjectives end in -다 (e.g., 갖추다, 실리다, 커지다).',
      '3. ACCURATE meaning only. If you are unsure of a word\'s dictionary meaning, DROP IT. Do not guess.',
      '   · Examples of the mistakes you must avoid:',
      '     - 갖추다 means "to equip / have ready", NOT "victim"',
      '     - 실리다 means "to be loaded / be carried / appear (in print)", NOT "save, use"',
      '     - 커지다 means "to grow bigger", NOT "come untied"',
      '     - 모두 means "all / everyone" ✓',
      '4. Include a "context" field: a short excerpt (10–50 characters) from the article body containing the word or its conjugation. The excerpt MUST be a literal substring of the body.',
      '',
      'HARD EXCLUSIONS (never return, even if frequent):',
      '- Trivial adverbs/conjunctions: 정말, 많이, 너무, 진짜, 아주, 매우, 조금, 좀, 잘, 또, 다, 더, 이미, 그냥, 그리고, 그래서, 하지만, 근데, 만약, 물론, 아마, 특히, 바로',
      '- Basic nouns/pronouns: 한국, 사람, 것, 수, 거, 때, 일, 곳, 말, 집, 나, 너, 우리, 저, 제, 이, 그',
      '- Bare auxiliaries alone: 있다, 없다, 하다, 되다, 가다, 오다. They are fine inside multi-word collocations like "관심을 갖다".',
      '- Particles, postpositions, pure numerals, simple dates.',
      '- Proper nouns unless they are cultural landmarks that deserve explanation.',
      '',
      'PRIORITY ORDER:',
      '1. Topic-specific content words (domain nouns, verbs, adjectives) that carry the article\'s meaning.',
      '2. Useful multi-word collocations or grammar patterns taken verbatim ("관심을 갖다", "덕분에", "~는 편이다").',
      '3. Intermediate-to-advanced vocab the learner is likely to encounter again.',
      '4. Words with cultural significance to THIS article.',
      '',
      'Return ONLY a JSON array of 10–12 items. Each item EXACTLY:',
      '{"word":"Korean dictionary form","reading":"romanization","meaning":"accurate dictionary meaning","context":"short excerpt from article"}',
      '',
      'No surrounding prose, no code fences, no trailing comments.'
    ].join('\n');
  }

  function validate(items, body) {
    if (!Array.isArray(items)) return { items: [], strict: [] };
    var lenient = [];
    var strict  = [];
    var seen = {};
    var bodyNoSpace = (body || '').replace(/\s+/g, '');
    items.forEach(function(x) {
      if (!x) return;
      var ko  = (x.word || x.ko || x.word_ko || '').trim();
      var en  = (x.meaning || x.en || x.word_en || '').trim();
      var rom = (x.reading || x.rom || x.word_rom || '').trim();
      var ctx = (x.context || '').trim();
      if (!ko || !en) return;
      if (ko.length < 2) return;
      if (BLACKLIST[ko]) return;
      if (seen[ko]) return;
      seen[ko] = true;
      var entry = { word: ko, reading: rom, meaning: en, context: ctx };
      lenient.push(entry);
      if (!body) { strict.push(entry); return; }
      if (!stemMatch(body, ko)) return;
      if (ctx) {
        var ctxNoSpace = ctx.replace(/\s+/g, '');
        var ctxClip = ctxNoSpace.length > 40 ? ctxNoSpace.slice(0, 40) : ctxNoSpace;
        var bodyHasCtx = body.indexOf(ctx) !== -1
                     || bodyNoSpace.indexOf(ctxNoSpace) !== -1
                     || bodyNoSpace.indexOf(ctxClip) !== -1;
        if (!bodyHasCtx) return;
      }
      strict.push(entry);
    });
    return { items: lenient.slice(0, 12), strict: strict.slice(0, 12) };
  }

  function validateBest(items, body) {
    var r = validate(items, body);
    if (r.strict.length >= 4) return r.strict;
    var seen = {};
    r.strict.forEach(function(x){ seen[x.word] = true; });
    var extra = r.items.filter(function(x){ return !seen[x.word]; });
    return r.strict.concat(extra).slice(0, 12);
  }

  window.KH_VOCAB = { promptText: promptText, validate: validate, validateBest: validateBest, BLACKLIST: BLACKLIST };
})();
