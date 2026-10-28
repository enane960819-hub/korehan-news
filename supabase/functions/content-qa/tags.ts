// Word Universe categories: one tag per word, assigned once and stored in
// word_tags. Nine broad groups so the Universe stays readable.
export const WORD_TAGS = ['daily', 'food', 'places', 'people', 'work', 'society', 'culture', 'nature', 'study'] as const
export type WordTag = typeof WORD_TAGS[number]

export function tagPrompt(words: Array<{ ko: string; en: string }>): string {
  return `Put each Korean word into exactly ONE category for a vocabulary map shown to learners.

Categories:
- daily: everyday life — home, time, routines, objects, shopping, basic actions and descriptions
- food: food, drink, cooking, eating out
- places: travel, transport, cities, buildings, directions, locations
- people: family, friends, relationships, feelings, personality, communication between people
- work: jobs, office, business, money, economy, finance
- society: news, politics, law, crime, public issues, government, social problems
- culture: music, K-pop, drama, movies, sports, hobbies, art, history, traditions
- nature: animals, plants, weather, environment, space, the body, health, medicine
- study: school, language learning, science, technology, the internet

Pick the category a learner would expect from the word's most common meaning. A general verb or adjective with no clear topic goes to daily.

Words (Korean — English):
${words.map((w) => `${w.ko} — ${w.en || '?'}`).join('\n')}

Answer with JSON only: {"tags": {"<korean word>": "<category>", ...}} covering every word above.`
}

export function parseTags(json: any, words: Array<{ ko: string }>): Record<string, WordTag> {
  const out: Record<string, WordTag> = {}
  const tags = json && typeof json.tags === 'object' ? json.tags : {}
  for (const w of words) {
    const t = String(tags[w.ko] || '').toLowerCase().trim()
    if ((WORD_TAGS as readonly string[]).includes(t)) out[w.ko] = t as WordTag
  }
  return out
}
