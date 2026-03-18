export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Korean TTS proxy — proxies Google Translate TTS to avoid CORS
    if (url.pathname === '/tts') {
      const text = url.searchParams.get('t') || '';
      if (!text || text.length > 200) {
        return new Response('bad request', { status: 400 });
      }
      const speed = url.searchParams.get('sp') || '0.85';
      const ttsUrl =
        'https://translate.google.com/translate_tts?ie=UTF-8' +
        '&q=' + encodeURIComponent(text) +
        '&tl=ko&client=gtx&ttsspeed=' + encodeURIComponent(speed);
      try {
        const resp = await fetch(ttsUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
              'AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/124.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/',
          },
        });
        if (!resp.ok) return new Response('tts upstream error', { status: 502 });
        return new Response(resp.body, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=2592000', // 30 days
          },
        });
      } catch (e) {
        return new Response('tts error: ' + e.message, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
