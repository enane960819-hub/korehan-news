// speaking-pass-checkout — RETIRED.
//
// The Speaking Coach feature (and its coin top-ups) was removed from
// KoreHani. This function cannot be deleted from here (it is still deployed on
// Supabase), so it is kept as a stub that answers 410 Gone to every request so
// no coins can be bought or credited. The previous implementation is in git
// history if it is ever needed again.

Deno.serve(() =>
  new Response(JSON.stringify({ ok: false, error: 'gone', detail: 'Speaking passes are no longer available.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  })
)
