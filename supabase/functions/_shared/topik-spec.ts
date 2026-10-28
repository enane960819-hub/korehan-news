// TOPIK question layout by number — the spec the topik-gen generator follows
// so practice tests mirror the real exam (TOPIK I: listening 1–30, reading
// 31–70; TOPIK II: listening 1–50, reading 1–50). Questions are ORIGINAL;
// only the format follows TOPIK. Edit here if NIIED changes the layout.
//
// Each section is split into chunks (one generation call each, ~6–10
// questions). A block is one question type over a number range: `set` = how
// many questions share one passage/script (1 = each number stands alone).

export type Block = {
  from: number; to: number; type: string; set?: number
  ko: string            // the instruction exactly as printed on the paper
  en: string            // short English label for learners
  make: string          // what the generator must write for this block
  choices?: 'text' | 'graph' | 'order' | 'insert'
}
export type Section = { level: 'I' | 'II'; section: 'reading' | 'listening'; minutes: number; listening: boolean; chunks: Block[][] }

const L = (s: string) => s   // readability

export const LEVEL_GUIDE: Record<'I' | 'II', string> = {
  I: 'TOPIK I (levels 1–2): beginner vocabulary (about 1,500–2,000 basic words), everyday topics (family, shopping, school, weather, food, transport, hobbies), short sentences in 합쇼체/해요체. Early numbers are very easy; difficulty rises with the number.',
  II: 'TOPIK II (levels 3–6): intermediate–advanced vocabulary and grammar; topics move from daily life and work to society, culture, science, economy, environment and opinion pieces. Formal written style (-ㄴ다/-다) in articles and essays, natural spoken style in dialogues. Difficulty rises steadily with the number; 40–50 are advanced (level 5–6).',
}

export const SPEC: Record<string, Section> = {
  'I-listening': { level: 'I', section: 'listening', minutes: 40, listening: true, chunks: [
    [
      { from: 1, to: 4, type: 'l_answer', ko: '[1~4] 다음을 듣고 <보기>와 같이 물음에 맞는 대답을 고르십시오.', en: 'Choose the right answer to the question',
        make: L('script = ONE short question by one speaker. 1–2: yes/no questions — all 4 choices start with 네, or 아니요, (mix them); 3–4: wh-questions (누구, 언제, 어디, 뭐, 몇) — choices are short answers. Exactly one choice answers the question correctly.') },
      { from: 5, to: 6, type: 'l_next', ko: '[5~6] 다음을 듣고 <보기>와 같이 이어지는 말을 고르십시오.', en: 'Choose what comes next',
        make: L('script = ONE social expression (greeting, thanks, apology, congratulation, leaving, eating). Choices = 4 possible replies; exactly one is the natural reply.') },
    ],
    [
      { from: 7, to: 10, type: 'l_place', ko: '[7~10] 여기는 어디입니까? <보기>와 같이 알맞은 것을 고르십시오.', en: 'Where are they?',
        make: L('script = 2-turn dialogue (남자/여자) that clearly happens in one place without naming it. Choices = 4 places (e.g. 은행, 서점, 병원, 공항).') },
      { from: 11, to: 14, type: 'l_topic', ko: '[11~14] 다음은 무엇에 대해 말하고 있습니까? <보기>와 같이 알맞은 것을 고르십시오.', en: 'What are they talking about?',
        make: L('script = 2-turn dialogue. Choices = 4 category nouns (e.g. 가족, 날씨, 취미, 주소); exactly one covers the dialogue.') },
    ],
    [
      { from: 15, to: 16, type: 'l_picture', ko: '[15~16] 다음 대화를 듣고 알맞은 그림을 고르십시오.', en: 'Choose the right picture',
        make: L('script = 2-turn dialogue describing a concrete scene. Choices = 4 short Korean picture descriptions starting with "그림:" (e.g. "그림: 남자가 여자에게 우산을 주고 있다"); only one matches.') },
      { from: 17, to: 21, type: 'l_match', ko: '[17~21] 다음을 듣고 <보기>와 같이 대화 내용과 같은 것을 고르십시오.', en: 'Choose what matches the dialogue',
        make: L('script = 4-turn dialogue 남자/여자. Choices = 4 statements; three change one detail (who, when, what, how many).') },
    ],
    [
      { from: 22, to: 24, type: 'l_main', ko: '[22~24] 다음을 듣고 여자의 중심 생각을 고르십시오.', en: "The woman's main idea",
        make: L('script = 4-turn dialogue where the woman gives an opinion. Choices = 4 statements; the answer is her main point, not a detail.') },
      { from: 25, to: 26, type: 'l_set', set: 2, ko: '[25~26] 다음을 듣고 물음에 답하십시오.', en: 'Announcement',
        make: L('script = one announcement by 여자 (5–7 sentences: store, school, building, event). Q25 question: "여자가 왜 이 이야기를 하고 있는지 고르십시오." Q26 question: "들은 내용과 같은 것을 고르십시오."') },
    ],
    [
      { from: 27, to: 28, type: 'l_set', set: 2, ko: '[27~28] 다음을 듣고 물음에 답하십시오.', en: 'Dialogue',
        make: L('script = 6–8-turn dialogue. Q27 question: "두 사람이 무엇에 대해 이야기하고 있는지 고르십시오." Q28 question: "들은 내용과 같은 것을 고르십시오."') },
      { from: 29, to: 30, type: 'l_set', set: 2, ko: '[29~30] 다음을 듣고 물음에 답하십시오.', en: 'Interview',
        make: L('script = 6–8-turn interview (여자 asks, 남자 explains his job or experience). Q29 question: "남자가 ~한 이유를 고르십시오." (write the real reason question). Q30 question: "들은 내용과 같은 것을 고르십시오."') },
    ],
  ] },

  'I-reading': { level: 'I', section: 'reading', minutes: 60, listening: false, chunks: [
    [
      { from: 31, to: 33, type: 'topic', ko: '[31~33] 무엇에 대한 이야기입니까? <보기>와 같이 알맞은 것을 고르십시오.', en: 'What is it about?',
        make: L('passage = 2 very short sentences. Choices = 4 category nouns (나라, 요일, 과일, 계절…).') },
      { from: 34, to: 39, type: 'blank', ko: '[34~39] <보기>와 같이 (    )에 들어갈 가장 알맞은 것을 고르십시오.', en: 'Fill the blank',
        make: L('passage = 2 short sentences with "(    )". 34: a particle; 35–37: a noun or verb; 38–39: an adverb or adjective. Distractors must be WRONG in the blank (grammar or meaning), not just different.') },
    ],
    [
      { from: 40, to: 42, type: 'notice', ko: '[40~42] 다음을 읽고 맞지 않는 것을 고르십시오.', en: 'Notices — choose what is NOT true',
        make: L('passage = a short notice, ad, ticket, message or schedule (use line breaks). Choices = 4 statements; exactly ONE is not true.') },
      { from: 43, to: 45, type: 'match', ko: '[43~45] 다음의 내용과 같은 것을 고르십시오.', en: 'Choose what matches',
        make: L('passage = 3 sentences about daily life. Choices = 4 statements; one matches.') },
      { from: 46, to: 48, type: 'main', ko: '[46~48] 다음을 읽고 중심 생각을 고르십시오.', en: 'Main idea',
        make: L('passage = 3 sentences giving the writer\'s feeling or wish. Choices = 4 statements; the main idea.') },
    ],
    [
      { from: 49, to: 50, type: 'set', set: 2, ko: '[49~50] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage = 5–6 sentences with "( ㉠ )". Q49: "㉠에 들어갈 알맞은 말을 고르십시오." Q50: "이 글의 내용과 같은 것을 고르십시오."') },
      { from: 51, to: 52, type: 'set', set: 2, ko: '[51~52] 다음을 읽고 물음에 답하십시오.', en: 'Explanatory passage',
        make: L('passage = short explanation of a Korean custom/thing with "( ㉠ )" needing a grammar form. Q51: "㉠에 들어갈 알맞은 것을 고르십시오." Q52: "무엇에 대한 이야기인지 맞는 것을 고르십시오."') },
      { from: 53, to: 54, type: 'set', set: 2, ko: '[53~54] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage = personal experience with "( ㉠ )". Q53: "㉠에 들어갈 알맞은 말을 고르십시오." Q54: "이 글의 내용과 같은 것을 고르십시오."') },
      { from: 55, to: 56, type: 'set', set: 2, ko: '[55~56] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage = short informative text with "( ㉠ )" needing a connector (그런데, 그래서, 예를 들면…). Q55: "㉠에 들어갈 알맞은 말을 고르십시오." Q56: "이 글의 내용과 같은 것을 고르십시오."') },
    ],
    [
      { from: 57, to: 58, type: 'order', choices: 'order', ko: '[57~58] 다음을 순서대로 맞게 배열한 것을 고르십시오.', en: 'Sentence order',
        make: L('passage = 4 sentences labelled (가)(나)(다)(라), one per line, shuffled. Choices = 4 orders written like "(나)-(가)-(다)-(라)"; exactly one is coherent. The first sentence of the right order must not start with a connector.') },
      { from: 59, to: 60, type: 'set', set: 2, choices: 'insert', ko: '[59~60] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage = 5 sentences with gaps ( ㉠ ) ( ㉡ ) ( ㉢ ) ( ㉣ ) between them, then a line "[보기] <one sentence>". Q59: "다음 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오." choices exactly ["㉠","㉡","㉢","㉣"]. Q60: "이 글의 내용과 같은 것을 고르십시오." (normal 4 text choices).') },
      { from: 61, to: 62, type: 'set', set: 2, ko: '[61~62] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage with "( ㉠ )" needing a verb form/tense. Q61: "㉠에 들어갈 알맞은 말을 고르십시오." Q62: "이 글의 내용과 같은 것을 고르십시오."') },
    ],
    [
      { from: 63, to: 64, type: 'set', set: 2, ko: '[63~64] 다음을 읽고 물음에 답하십시오.', en: 'Email / notice',
        make: L('passage = an email or notice ("받는 사람:", "제목:", body, sender). Q63: "왜 윗글을 썼는지 맞는 것을 고르십시오." Q64: "윗글의 내용과 같은 것을 고르십시오."') },
      { from: 65, to: 66, type: 'set', set: 2, ko: '[65~66] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage about Korean culture/society with "( ㉠ )". Q65: "㉠에 들어갈 알맞은 말을 고르십시오." Q66: "이 글의 내용과 같은 것을 고르십시오."') },
      { from: 67, to: 68, type: 'set', set: 2, ko: '[67~68] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('informative passage (health, science, life tips) with "( ㉠ )". Q67: "㉠에 들어갈 알맞은 말을 고르십시오." Q68: "이 글의 내용과 같은 것을 고르십시오."') },
      { from: 69, to: 70, type: 'set', set: 2, ko: '[69~70] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('first-person story with "( ㉠ )" needing a modifier/ending. Q69: "㉠에 들어갈 알맞은 말을 고르십시오." Q70: "이 글을 읽고 알 수 있는 것을 고르십시오."') },
    ],
  ] },

  'II-listening': { level: 'II', section: 'listening', minutes: 60, listening: true, chunks: [
    [
      { from: 1, to: 2, type: 'l_picture', ko: '[1~3] 다음을 듣고 가장 알맞은 그림 또는 그래프를 고르십시오.', en: 'Choose the right picture',
        make: L('script = 3-turn dialogue in a concrete situation. Choices = 4 Korean picture descriptions starting with "그림:"; only one matches.') },
      { from: 3, to: 3, type: 'l_graph', choices: 'graph', ko: '[1~3] 다음을 듣고 가장 알맞은 그림 또는 그래프를 고르십시오.', en: 'Choose the right graph',
        make: L('script = a short news report by 남자 with survey numbers. Choices = 4 graph objects {"graph":{"title":"…","unit":"%","items":[{"label":"…","value":n}]}}; only one matches the numbers/ranking heard.') },
      { from: 4, to: 8, type: 'l_next', ko: '[4~8] 다음 대화를 잘 듣고 이어질 수 있는 말을 고르십시오.', en: 'What can come next',
        make: L('script = 3-turn dialogue ending with the other speaker\'s turn to talk. Choices = 4 replies; exactly one follows naturally.') },
    ],
    [
      { from: 9, to: 12, type: 'l_action', ko: '[9~12] 다음 대화를 잘 듣고 여자가 이어서 할 행동으로 가장 알맞은 것을 고르십시오.', en: 'What will the woman do next?',
        make: L('script = 4-turn dialogue. Choices = 4 actions (ending -ㄴ다/-는다); only one is what the woman will do right after.') },
      { from: 13, to: 16, type: 'l_match', ko: '[13~16] 다음을 듣고 들은 내용과 일치하는 것을 고르십시오.', en: 'Choose what matches',
        make: L('13–14: 4-turn dialogue; 15: a short news report; 16: a short interview. Choices = 4 statements; one matches.') },
    ],
    [
      { from: 17, to: 20, type: 'l_main', ko: '[17~20] 다음을 듣고 남자의 중심 생각으로 가장 알맞은 것을 고르십시오.', en: "The man's main idea",
        make: L('script = 3–4-turn dialogue (20: interview) where the man argues a point. Choices = 4 statements; his central idea.') },
      { from: 21, to: 22, type: 'l_set', set: 2, ko: '[21~22] 다음을 듣고 물음에 답하십시오.', en: 'Dialogue',
        make: L('script = 4–6-turn workplace/daily dialogue. Q21: "남자의 중심 생각으로 가장 알맞은 것을 고르십시오." Q22: "들은 내용으로 맞는 것을 고르십시오."') },
    ],
    [
      { from: 23, to: 24, type: 'l_set', set: 2, ko: '[23~24] 다음을 듣고 물음에 답하십시오.', en: 'Phone / inquiry',
        make: L('script = phone call or inquiry. Q23: "남자가 무엇을 하고 있는지 고르십시오." Q24: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 25, to: 26, type: 'l_set', set: 2, ko: '[25~26] 다음을 듣고 물음에 답하십시오.', en: 'Interview',
        make: L('script = interview: 여자 asks, 남자 answers at length. Q25: "남자의 중심 생각으로 가장 알맞은 것을 고르십시오." Q26: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 27, to: 28, type: 'l_set', set: 2, ko: '[27~28] 다음을 듣고 물음에 답하십시오.', en: 'Dialogue',
        make: L('script = 5–6-turn dialogue. Q27: "남자가 말하는 의도로 알맞은 것을 고르십시오." Q28: "들은 내용으로 맞는 것을 고르십시오."') },
    ],
    [
      { from: 29, to: 30, type: 'l_set', set: 2, ko: '[29~30] 다음을 듣고 물음에 답하십시오.', en: 'Interview — who is he?',
        make: L('script = interview about an unusual job. Q29: "남자가 누구인지 고르십시오." Q30: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 31, to: 32, type: 'l_set', set: 2, ko: '[31~32] 다음을 듣고 물음에 답하십시오.', en: 'Debate',
        make: L('script = debate-style dialogue. Q31: "남자의 생각으로 가장 알맞은 것을 고르십시오." Q32: "남자의 태도로 가장 알맞은 것을 고르십시오." (choices describe attitudes, e.g. 상대방의 의견에 동의하며 근거를 덧붙이고 있다.)') },
      { from: 33, to: 34, type: 'l_set', set: 2, ko: '[33~34] 다음을 듣고 물음에 답하십시오.', en: 'Lecture',
        make: L('script = short lecture by 여자. Q33: "무엇에 대한 내용인지 가장 알맞은 것을 고르십시오." Q34: "들은 내용으로 맞는 것을 고르십시오."') },
    ],
    [
      { from: 35, to: 36, type: 'l_set', set: 2, ko: '[35~36] 다음을 듣고 물음에 답하십시오.', en: 'Speech',
        make: L('script = formal speech by 남자 (award, opening, farewell). Q35: "남자가 무엇을 하고 있는지 고르십시오." Q36: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 37, to: 38, type: 'l_set', set: 2, ko: '[37~38] 다음은 교양 프로그램입니다. 잘 듣고 물음에 답하십시오.', en: 'Talk show',
        make: L('script = educational program: 남자 host asks, 여자 expert explains. Q37: "여자의 중심 생각으로 가장 알맞은 것을 고르십시오." Q38: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 39, to: 40, type: 'l_set', set: 2, ko: '[39~40] 다음은 대담입니다. 잘 듣고 물음에 답하십시오.', en: 'Discussion',
        make: L('script = discussion that starts mid-topic. Q39: "이 대화 전의 내용으로 가장 알맞은 것을 고르십시오." Q40: "들은 내용으로 맞는 것을 고르십시오."') },
    ],
    [
      { from: 41, to: 42, type: 'l_set', set: 2, ko: '[41~42] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.', en: 'Lecture',
        make: L('script = academic lecture by 여자 (6–8 sentences). Q41: "이 강연의 중심 내용으로 가장 알맞은 것을 고르십시오." Q42: "들은 내용으로 맞는 것을 고르십시오."') },
      { from: 43, to: 44, type: 'l_set', set: 2, ko: '[43~44] 다음은 다큐멘터리입니다. 잘 듣고 물음에 답하십시오.', en: 'Documentary',
        make: L('script = documentary narration by 남자 about nature/science/history. Q43: "무엇에 대한 내용인지 가장 알맞은 것을 고르십시오." Q44: "~한 이유로 맞는 것을 고르십시오." (write the specific reason question).') },
      { from: 45, to: 46, type: 'l_set', set: 2, ko: '[45~46] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.', en: 'Lecture',
        make: L('script = lecture by 여자. Q45: "들은 내용으로 맞는 것을 고르십시오." Q46: "여자가 말하는 방식으로 가장 알맞은 것을 고르십시오." (choices describe how she speaks, e.g. 구체적인 사례를 들어 설명하고 있다.)') },
      { from: 47, to: 48, type: 'l_set', set: 2, ko: '[47~48] 다음은 대담입니다. 잘 듣고 물음에 답하십시오.', en: 'Discussion',
        make: L('script = discussion: 여자 host, 남자 expert on a social issue. Q47: "들은 내용으로 맞는 것을 고르십시오." Q48: "남자의 태도로 가장 알맞은 것을 고르십시오."') },
      { from: 49, to: 50, type: 'l_set', set: 2, ko: '[49~50] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.', en: 'Lecture',
        make: L('script = advanced lecture by 남자 (law, philosophy, economy, history). Q49: "들은 내용으로 맞는 것을 고르십시오." Q50: "남자의 태도로 가장 알맞은 것을 고르십시오."') },
    ],
  ] },

  'II-reading': { level: 'II', section: 'reading', minutes: 70, listening: false, chunks: [
    [
      { from: 1, to: 2, type: 'grammar', ko: '[1~2] (    )에 들어갈 가장 알맞은 것을 고르십시오.', en: 'Grammar blank',
        make: L('passage = one sentence with "(    )" testing a connective/ending (e.g. -느라고, -다가, -도록). Choices = 4 grammar forms on the same verb; only one is correct.') },
      { from: 3, to: 4, type: 'similar', ko: '[3~4] 다음 밑줄 친 부분과 의미가 비슷한 것을 고르십시오.', en: 'Similar meaning',
        make: L('passage = one sentence with the target expression wrapped in [u]…[/u]. Choices = 4 grammar expressions; only one has the same meaning in that sentence.') },
      { from: 5, to: 8, type: 'about', ko: '[5~8] 다음은 무엇에 대한 글인지 고르십시오.', en: 'What is it about? (ads, signs)',
        make: L('passage = 1–2 line ad slogan, campaign or sign (5: product, 6: place/service, 7: campaign, 8: usage guide/notice). Choices = 4 short nouns (e.g. 냉장고, 도서관, 환경 보호, 사용 방법).') },
    ],
    [
      { from: 9, to: 9, type: 'notice', ko: '[9~12] 다음 글 또는 그래프의 내용과 같은 것을 고르십시오.', en: 'Notice — what matches',
        make: L('passage = an event/program notice with details (date, place, fee, how to apply). Choices = 4 statements; one matches.') },
      { from: 10, to: 10, type: 'graph', ko: '[9~12] 다음 글 또는 그래프의 내용과 같은 것을 고르십시오.', en: 'Graph — what matches',
        make: L('passage = a one-line title; media = {"graph":{"title":"…","unit":"%","items":[{"label":"…","value":n}]}} (4–6 bars, e.g. survey by age group). Choices = 4 statements about the graph; one is correct.') },
      { from: 11, to: 12, type: 'match', ko: '[9~12] 다음 글 또는 그래프의 내용과 같은 것을 고르십시오.', en: 'Article — what matches',
        make: L('passage = 4–5 sentence news article. Choices = 4 statements; one matches.') },
      { from: 13, to: 15, type: 'order', choices: 'order', ko: '[13~15] 다음을 순서대로 맞게 배열한 것을 고르십시오.', en: 'Sentence order',
        make: L('passage = 4 sentences (가)(나)(다)(라), one per line. Choices = 4 orders like "(나)-(가)-(라)-(다)"; real TOPIK II gives two possible starting sentences across the choices. Exactly one order is coherent.') },
    ],
    [
      { from: 16, to: 18, type: 'blank', ko: '[16~18] 다음을 읽고 (    )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.', en: 'Fill the blank (content)',
        make: L('passage = 4–5 sentence explanation with "(    )" needing a phrase that completes the logic. Choices = 4 phrases.') },
      { from: 19, to: 20, type: 'set', set: 2, ko: '[19~20] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage with "(    )" needing an adverb/connector. Q19: "(    )에 들어갈 알맞은 것을 고르십시오." Q20: "위 글의 주제로 가장 알맞은 것을 고르십시오."') },
      { from: 21, to: 22, type: 'set', set: 2, ko: '[21~22] 다음을 읽고 물음에 답하십시오.', en: 'Passage — idiom',
        make: L('passage with "(    )" needing a Korean idiom/관용 표현 (e.g. 발을 벗고 나서다). Q21: "(    )에 들어갈 알맞은 것을 고르십시오." Q22: "위 글의 중심 생각을 고르십시오."') },
    ],
    [
      { from: 23, to: 24, type: 'set', set: 2, ko: '[23~24] 다음을 읽고 물음에 답하십시오.', en: 'Essay',
        make: L('passage = first-person essay with one phrase wrapped in [u]…[/u] showing the writer\'s feeling. Q23: "밑줄 친 부분에 나타난 \'나\'의 심정으로 알맞은 것을 고르십시오." (choices like 서운하다, 후련하다, 당황스럽다, 부담스럽다). Q24: "위 글의 내용과 같은 것을 고르십시오."') },
      { from: 25, to: 27, type: 'headline', ko: '[25~27] 다음은 신문 기사의 제목입니다. 가장 잘 설명한 것을 고르십시오.', en: 'Newspaper headline',
        make: L('passage = one newspaper headline in headline style (noun phrases, commas, short verbs, e.g. "가을 단풍 절정, 주말 나들이객 몰려"). Choices = 4 full sentences; one explains it correctly.') },
      { from: 28, to: 31, type: 'blank', ko: '[28~31] 다음을 읽고 (    )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.', en: 'Fill the blank (expository)',
        make: L('passage = 4–5 sentence expository text (science, society, culture) with "(    )". Choices = 4 phrases; one fits the logic.') },
    ],
    [
      { from: 32, to: 34, type: 'match', ko: '[32~34] 다음을 읽고 내용이 같은 것을 고르십시오.', en: 'Choose what matches',
        make: L('passage = 5–6 sentence informative text. Choices = 4 statements; one matches.') },
      { from: 35, to: 38, type: 'theme', ko: '[35~38] 다음 글의 주제로 가장 알맞은 것을 고르십시오.', en: 'Main theme',
        make: L('passage = 5–6 sentence argument/explanation. Choices = 4 statements; the theme of the whole text.') },
    ],
    [
      { from: 39, to: 41, type: 'insert', choices: 'insert', ko: '[39~41] 주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.', en: 'Where does the sentence go?',
        make: L('passage = 5–6 sentences with ( ㉠ ) ( ㉡ ) ( ㉢ ) ( ㉣ ) gaps, then a line "[보기] <one sentence>". Choices exactly ["㉠","㉡","㉢","㉣"].') },
      { from: 42, to: 43, type: 'set', set: 2, ko: '[42~43] 다음을 읽고 물음에 답하십시오.', en: 'Story',
        make: L('passage = short literary story excerpt (8–10 sentences) with one phrase in [u]…[/u]. Q42: "밑줄 친 부분에 나타난 인물의 심정으로 알맞은 것을 고르십시오." Q43: "위 글의 내용으로 알 수 있는 것을 고르십시오."') },
      { from: 44, to: 45, type: 'set', set: 2, ko: '[44~45] 다음을 읽고 물음에 답하십시오.', en: 'Passage',
        make: L('passage = 6–8 sentence argument with "(    )". Q44: "위 글의 주제로 가장 알맞은 것을 고르십시오." Q45: "(    )에 들어갈 내용으로 가장 알맞은 것을 고르십시오."') },
    ],
    [
      { from: 46, to: 47, type: 'set', set: 2, ko: '[46~47] 다음을 읽고 물음에 답하십시오.', en: 'Opinion',
        make: L('passage = opinion piece on a policy or social change (7–9 sentences). Q46: "위 글에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오." Q47: "위 글의 내용과 같은 것을 고르십시오."') },
      { from: 48, to: 50, type: 'set', set: 3, ko: '[48~50] 다음을 읽고 물음에 답하십시오.', en: 'Editorial',
        make: L('passage = advanced editorial (9–11 sentences) with "(    )". Q48: "필자가 이 글을 쓴 목적으로 알맞은 것을 고르십시오." Q49: "(    )에 들어갈 내용으로 가장 알맞은 것을 고르십시오." Q50: "밑줄 친 부분에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오." — wrap one phrase in [u]…[/u] for Q50.') },
    ],
  ] },
}

export function sectionKey(level: string, section: string) { return `${level}-${section}` }
export function questionCount(s: Section) { return s.chunks.flat().reduce((n, b) => n + (b.to - b.from + 1), 0) }
