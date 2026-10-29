// Owner on/off switches for every paid AI call (admin page:
// korehan-x9f4k2m7-ai.html). Every Edge Function that calls Anthropic asks
// aiGate() first and skips the call when it returns a reason.
//
// app_settings.ai_switches (JSON text):
//   all            false = every AI call stops (admin included)
//   site           false = learner/admin features through claude-proxy stop
//   jobs           { '<function name>': false } = that background job stops
//   off_features   ['cron:word-tags', 'translate', …] = these features stop
//   daily_cap_usd  number | null — once today's spend (KST) reaches it, every
//                  call except the admin's stops until midnight KST
//
// A missing row or bad JSON means everything is on (the site keeps working).

type Switches = {
  all: boolean
  site: boolean
  jobs: Record<string, boolean>
  off_features: string[]
  daily_cap_usd: number | null
}
const DEFAULTS: Switches = { all: true, site: true, jobs: {}, off_features: [], daily_cap_usd: null }

let cached: { at: number; v: Switches } | null = null
let spend: { at: number; usd: number } | null = null

export async function aiSwitches(sb: any): Promise<Switches> {
  if (cached && Date.now() - cached.at < 30_000) return cached.v
  let v = DEFAULTS
  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'ai_switches').maybeSingle()
    const raw = data?.value ? (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) : null
    if (raw && typeof raw === 'object') {
      v = {
        all: raw.all !== false,
        site: raw.site !== false,
        jobs: raw.jobs && typeof raw.jobs === 'object' ? raw.jobs : {},
        off_features: Array.isArray(raw.off_features) ? raw.off_features.map(String) : [],
        daily_cap_usd: Number.isFinite(Number(raw.daily_cap_usd)) && raw.daily_cap_usd !== null && raw.daily_cap_usd !== '' ? Number(raw.daily_cap_usd) : null,
      }
    }
  } catch (_) { /* keep defaults */ }
  cached = { at: Date.now(), v }
  return v
}

async function spentToday(sb: any): Promise<number> {
  if (spend && Date.now() - spend.at < 60_000) return spend.usd
  let usd = 0
  try {
    const { data } = await sb.rpc('kh_ai_spend_today')
    usd = Number(data) || 0
  } catch (_) { /* unknown spend never blocks */ }
  spend = { at: Date.now(), usd }
  return usd
}

/**
 * Returns null when the call may go ahead, otherwise a short reason.
 * job     = the Edge Function's name ('content-qa', 'daily-article-draft', …),
 *           or 'site' for claude-proxy.
 * feature = the feature string written to claude_api_usage for this call.
 */
export async function aiGate(sb: any, job: string, feature: string | null, opts: { admin?: boolean } = {}): Promise<string | null> {
  const s = await aiSwitches(sb)
  if (!s.all) return 'All AI is turned off in the admin.'
  if (!opts.admin) {
    if (job === 'site' && !s.site) return 'AI features are turned off in the admin.'
    if (job !== 'site' && s.jobs[job] === false) return `The ${job} job is turned off in the admin.`
    if (feature && s.off_features.includes(feature)) return `${feature} is turned off in the admin.`
    if (s.daily_cap_usd !== null && (await spentToday(sb)) >= s.daily_cap_usd) return `Today's AI budget ($${s.daily_cap_usd}) is used up.`
  }
  return null
}

/** Thrown by job helpers so a cron run stops cleanly and reports why. */
export class AiOffError extends Error {
  constructor(reason: string) { super('ai_off: ' + reason); this.name = 'AiOffError' }
}
