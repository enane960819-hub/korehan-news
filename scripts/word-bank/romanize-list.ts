// deno run --allow-read --allow-write romanize-list.ts in.json out.json
// Adds `rom` to every {ko} row with the site's rule-based romanizer.
import { romanize } from '../../supabase/functions/_shared/romanize.ts'
const [inp, out] = Deno.args
const rows = JSON.parse(await Deno.readTextFile(inp))
for (const r of rows) r.rom = romanize(r.ko)
await Deno.writeTextFile(out, JSON.stringify(rows))
console.log('romanized', rows.length, '| e.g.', rows.slice(0, 5).map((r: any) => r.ko + '=' + r.rom).join(', '))
