// sync marker
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-bypass',
}

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdoenRyZHZ0eG1ybWF3bmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzQ3NTIsImV4cCI6MjA4ODAxMDc1Mn0.UCt6Z76XTmJGbhHdX744tM8BKDdVhqRiCLuQi6w-rNs'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })

    const token = authHeader.replace('Bearer ', '')
    const isAdminBypass = req.headers.get('x-admin-bypass') === '1'

    if (isAdminBypass && token === supabaseServiceKey) {
      // Admin bypass — skip JWT verification
    } else {
      // Verify user JWT by calling Supabase Auth REST API directly
      const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': authHeader,
          'apikey': SUPABASE_ANON_KEY,
        }
      })
      if (!authCheck.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
      const userData = await authCheck.json()
      if (!userData || !userData.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // Get API key from DB using service role client
    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'anthropic_key').single()
    const apiKey = setting?.value
    if (!apiKey) return new Response(JSON.stringify({ error: 'No API key configured' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })

    const body = await req.json()
    const { feature, ...claudeBody } = body

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeBody),
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
