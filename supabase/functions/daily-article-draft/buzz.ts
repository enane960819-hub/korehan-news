// Buzz — one original article a day about what Korean online communities
// are talking about (section 'buzz', Tree / Intermediate level).
//
// Runs as an extra unit of work inside daily-article-draft, after the four
// news drafts are done:
//   tick A  collectBuzz(): read the "hot / best" list pages of a few
//           communities (titles + links only), drop topics already used,
//           Haiku picks safe + interesting candidates, then the first post
//           page we can read becomes a queued pick (kind 'buzz').
//   tick B  the normal buildDraft() path writes it with buzzPrompt():
//           an ORIGINAL Korean explainer (never a copy of the post) plus a
//           "Netizen Talk" box — reactions paraphrased in our own words and
//           a slang glossary — stored on articles.netizen_talk.
//
// Content rules (owner decision): no reproduction of post text, no
// nicknames / screenshots / community images; skip politics, hate, gender
// wars, accusations against real people, minors, sexual content, personal
// info, crime victims. Images come from Pexels (licensed) via image_query.
//
// Sources were verified readable from Supabase's network on 2026-10-12
// (supabase/reports/2026-10-12_buzz_probe.sql / _buzz_links.sql). fmkorea,
// ruliweb, todayhumor and clien/recommend block bots — not used.

export type BuzzCandidate = { title: string; url: string; source: string }

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export const SOURCES: Array<{ id: string; label: string; url: string; base: string; post: RegExp }> = [
  { id: 'nate-pann', label: 'Nate Pann', url: 'https://pann.nate.com/talk/ranking', base: 'https://pann.nate.com', post: /^(?:https:\/\/pann\.nate\.com)?\/talk\/\d{8,}$/ },
  { id: 'theqoo', label: 'theqoo', url: 'https://theqoo.net/hot', base: 'https://theqoo.net', post: /^(?:https:\/\/theqoo\.net)?\/hot\/\d{8,}$/ },
  { id: 'instiz', label: 'instiz', url: 'https://www.instiz.net/pt?category=1', base: 'https://www.instiz.net', post: /^(?:https:\/\/www\.instiz\.net)?\/pt\/\d+/ },
  { id: 'clien', label: 'Clien', url: 'https://www.clien.net/service/board/park', base: 'https://www.clien.net', post: /^(?:https:\/\/www\.clien\.net)?\/service\/board\/park\/\d+/ },
  { id: 'dcinside', label: 'DC Inside', url: 'https://gall.dcinside.com/board/lists/?id=hit', base: 'https://gall.dcinside.com', post: /^(?:https:\/\/gall\.dcinside\.com)?\/board\/view\/\?id=(?:hit|dcbest)&no=\d+/ },
  { id: 'bobaedream', label: 'Bobaedream', url: 'https://www.bobaedream.co.kr/list?code=best', base: 'https://www.bobaedream.co.kr', post: /^(?:https:\/\/www\.bobaedream\.co\.kr)?\/view\?code=best&No=\d+/ },
]
const SKIP_TITLE = /공지|광고|필독|이벤트|규칙|운영|신고|홍보|AD\b/i
const PER_SOURCE = 15
const MAX_PAGE_CHARS = 7000

function decodeEntities(s: string): string {
  return String(s || '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}
function stripTags(s: string): string {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// Korean sites still serve EUC-KR now and then — honour the declared charset.
async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(timeoutMs), redirect: 'follow',
  })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const buf = new Uint8Array(await r.arrayBuffer())
  let charset = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || [])[1] || ''
  if (!charset) {
    const head = new TextDecoder('latin1').decode(buf.slice(0, 4000))
    charset = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8'
  }
  try { return new TextDecoder(charset.toLowerCase()).decode(buf) } catch (_) { return new TextDecoder().decode(buf) }
}

export function parseList(html: string, src: typeof SOURCES[number]): BuzzCandidate[] {
  const out: BuzzCandidate[] = []
  const seen = new Set<string>()
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) && out.length < PER_SOURCE) {
    let href = decodeEntities(m[1]).replace(/#.*$/, '')
    if (!src.post.test(href)) continue
    // Drop list-navigation params (page=, category=) but keep the post id params.
    if (src.id === 'clien' || src.id === 'nate-pann' || src.id === 'theqoo') href = href.replace(/\?.*$/, '')
    if (src.id === 'dcinside') href = href.replace(/(&no=\d+).*$/, '$1')
    if (src.id === 'bobaedream') href = href.replace(/(&No=\d+).*$/, '$1')
    if (src.id === 'instiz') href = href.replace(/\?.*$/, '')
    const url = /^https?:/.test(href) ? href : src.base + href
    // First anchor per post is the title; later ones are previews / comment counts.
    if (seen.has(url)) continue
    const title = stripTags(m[2]).replace(/\[\d+\]$|\(\d+\)$/, '').trim()
    if (title.length < 6 || title.length > 120 || /^\d+$/.test(title) || SKIP_TITLE.test(title)) continue
    seen.add(url)
    out.push({ title, url, source: src.label })
  }
  return out
}

// Readable text of a post page, starting near the title so menus don't
// eat the budget. Comments, when the site renders them server-side, come
// along — the writer uses them only for the paraphrased Netizen Talk.
async function fetchPostText(c: BuzzCandidate): Promise<string> {
  const html = (await fetchHtml(c.url, 8000)).slice(0, 1_500_000)
  const body = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0]
    .replace(/<(script|style|noscript|svg|header|footer|nav|form|select|button|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n')
  const text = decodeEntities(body.replace(/<[^>]*>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
  const probe = c.title.replace(/\s+/g, ' ').slice(0, 14)
  const idx = probe.length >= 6 ? text.indexOf(probe) : -1
  return text.slice(Math.max(0, idx - 100), Math.max(0, idx - 100) + MAX_PAGE_CHARS)
}

export async function collectBuzz(
  sb: any,
  pickWithAI: (prompt: string) => Promise<string>,
  extractJsonObject: (s: string) => any,
): Promise<{ candidate: BuzzCandidate & { body_text: string }; reason: string } | { none: string; stats: Record<string, unknown> }> {
  // Topics already used (Buzz posts are deduped by source link).
  const { data: used } = await sb.from('articles').select('source_url').eq('section', 'buzz').order('date', { ascending: false }).limit(500)
  const usedUrls = new Set((used || []).map((r: any) => String(r?.source_url || '').trim()).filter(Boolean))

  const stats: Record<string, unknown> = {}
  const lists = await Promise.all(SOURCES.map(async (s) => {
    try {
      const items = parseList(await fetchHtml(s.url), s).filter((c) => !usedUrls.has(c.url))
      stats[s.id] = items.length
      return items
    } catch (e) { stats[s.id] = 'error: ' + String((e as Error).message || e).slice(0, 40); return [] as BuzzCandidate[] }
  }))
  // Round-robin so one busy board can't fill the list.
  const all: BuzzCandidate[] = []
  for (let i = 0; i < PER_SOURCE; i++) for (const l of lists) if (l[i]) all.push(l[i])
  if (all.length < 3) return { none: 'too few candidates', stats }

  const prompt =
    'You choose ONE topic a day for "Korea Buzz", a section of a Korean-learning site for foreign adults. '
    + 'We write our own short Korean explainer about what Korean netizens are talking about — we never copy the post.\n\n'
    + 'Trending post titles from Korean online communities:\n'
    + all.map((c, i) => `${i}. [${c.source}] ${c.title}`).join('\n') + '\n\n'
    + 'Rank the 5 best candidates. GOOD: everyday life in Korea, workplace / school / dating culture (light), food, prices and money tips, '
    + 'trends, new slang or memes, funny situations, "is this normal?" debates, travel, pets, K-content fandom moments, culture differences.\n'
    + 'NEVER pick: politics or elections, hate / gender or regional wars, accusations or rumours about real named people, '
    + 'crime victims or accidents with injuries, minors in sensitive situations, sexual content, personal information, '
    + 'self-harm, gambling or stocks/crypto hype, ads, anything mean-spirited, titles that only make sense with an image.\n'
    + 'Prefer topics a learner can understand without Korean internet context, and that teach something about Korea.\n\n'
    + 'Return ONLY JSON: {"ranked":[{"idx":<number>,"why":"<10 words>"}]}'
  const out = extractJsonObject(await pickWithAI(prompt))
  const ranked: Array<{ idx: number; why?: string }> = Array.isArray(out?.ranked) ? out.ranked : []
  for (const r of ranked.slice(0, 5)) {
    const c = all[Number(r?.idx)]
    if (!c) continue
    try {
      const text = await fetchPostText(c)
      if (text.length >= 200) return { candidate: { ...c, body_text: text }, reason: String(r.why || '').slice(0, 120) }
    } catch (_) { /* unreadable page → next candidate */ }
  }
  return { none: 'no readable pick', stats }
}

export function buzzPrompt(title: string, source: string, pageText: string, todayKo: string): string {
  return '당신은 외국인 한국어 학습자를 위한 사이트 KoreHani의 "Korea Buzz" 코너 기자입니다. '
    + '한국 온라인 커뮤니티에서 화제가 된 주제를 소개하는 짧은 오리지널 기사를 씁니다.\n\n'
    + '[참고 자료 — 커뮤니티 게시글 페이지 텍스트 (메뉴·광고·댓글이 섞여 있을 수 있음)]\n'
    + '게시글 제목: ' + title + '\n커뮤니티: ' + source + '\n페이지 텍스트:\n' + pageText + '\n\n'
    + '[안전 판단] 먼저 판단하세요. 정치, 혐오·성별/지역 갈등, 실존 인물에 대한 비난·루머, 범죄 피해자, 미성년자, 선정적 내용, 개인정보, '
    + '자해, 도박·코인 같은 주제이거나 글 내용을 이해할 수 없으면 {"safe":false,"reason":"..."} 만 출력하고 끝내세요.\n\n'
    + '[기사 작성 규칙]\n'
    + '- 게시글 문장을 그대로 옮기지 마세요. 주제와 상황만 가져와 완전히 새로운 문장으로 씁니다. 따옴표 인용 금지.\n'
    + '- 닉네임, 작성자 신상, 구체적 개인 정보, 커뮤니티 고유 은어로 된 사람 지칭 금지. "한 온라인 커뮤니티에 올라온 글"처럼 소개.\n'
    + '- 학습자가 한국 사회·문화를 이해할 수 있게 배경을 1~2문장 덧붙여도 됩니다(상식 수준, 지어낸 통계·숫자 금지).\n'
    + '- 글에 없는 사실을 만들지 마세요. 사진/영상 묘사 금지.\n'
    + '- 난이도: 중급 (TOPIK 3~4). 합쇼체(~ㅂ니다/~습니다) 위주. 평어체 금지. 한 기사에 자연스럽게 4개 이상: ~다고 합니다, ~(으)면서, ~는 것 같습니다, ~기 때문입니다, ~게 되었습니다, ~(으)ㄴ/는데.\n'
    + '- 분량: 4~6단락, 단락당 2~3문장. 문장 20~35자. 제목 15~25자. 괄호 보충 설명·한자 금지.\n'
    + '- 마지막 단락: 한국 네티즌들의 반응 경향을 한두 문장으로 정리하고 자연스럽게 마무리. "귀추가 주목됩니다" 같은 클리셰 금지.\n\n'
    + '[Netizen Talk]\n'
    + '- reactions: 페이지 텍스트에 실제로 있는 댓글/반응의 "의견 경향"을 3~5개, 우리 말로 짧게 바꿔 쓴 반말 구어체 한 줄 (원문 복사 금지, 욕설·비하 제외). '
    + '페이지에 반응이 없으면 [].\n'
    + '- slang: 이 주제와 관련해 한국 네티즌이 실제로 자주 쓰는 신조어/인터넷 표현 2~4개 (예: 킹받다, 존맛, 국룰). 각 표현의 뜻(영어)과 짧은 예문.\n'
    + '- image_query: 기사에 어울리는 스톡 사진 검색어 (영어 2~4단어, 사람 얼굴 클로즈업·로고 피하기).\n\n'
    + '[단락별 번역] body의 각 단락(\\n\\n 구분)마다 polished English 1줄, 개수 동일.\n'
    + '[오늘 날짜: ' + todayKo + ']\n\n'
    + '[출력 — JSON ONLY, no preamble, no code fences]\n'
    + '{"safe":true,"title":"<Korean title>","title_en":"<English headline ≤70 chars>","body":"본문 (단락 \\\\n\\\\n)",'
    + '"paragraph_translations":["..."],"key_expressions":[{"ko":"...","en":"..."}],'
    + '"netizen_talk":{"summary_en":"<one sentence: how Korean netizens reacted>","reactions":[{"ko":"...","en":"..."}],'
    + '"slang":[{"term":"...","meaning":"...","example_ko":"...","example_en":"..."}]},"image_query":"..."}'
}

// Licensed stock photo for a Buzz article (community images are never reused).
export async function pexelsImage(sb: any, query: string): Promise<string> {
  const q = String(query || '').trim().slice(0, 60)
  if (!q) return ''
  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'pexels_key').maybeSingle()
    const key = String(data?.value || '').trim()
    if (!key) return ''
    const u = new URL('https://api.pexels.com/v1/search')
    u.searchParams.set('query', q); u.searchParams.set('per_page', '5'); u.searchParams.set('orientation', 'landscape')
    const r = await fetch(u.toString(), { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return ''
    const j = await r.json()
    const photo = (j?.photos || [])[0]
    return photo?.src?.large || photo?.src?.medium || ''
  } catch (_) { return '' }
}
