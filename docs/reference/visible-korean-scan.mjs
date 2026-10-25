// Visible-Korean scan: renders pages (signed in) and lists every visible
// Korean text node outside known learning-content containers. Use this,
// not a source grep — HTML-literal text is invisible to string scans.
// Run (with python3 -m http.server 8765 in korehan/):
//   KH_QA_EMAIL=… KH_QA_PASSWORD=… node docs/reference/visible-korean-scan.mjs http://localhost:8765 [pages…]
import pkg from '/opt/node-tools/node_modules/playwright/index.js';
import fs from 'fs';
const { chromium } = pkg;
const base=process.argv[2]||'http://localhost:8765';
const SUPA='https://samghztrdvtxmrmawneu.supabase.co';
const ANON=fs.readFileSync('korehan/korehan-shared.js','utf8').match(/eyJ[A-Za-z0-9_.-]{40,}/)[0];
const tok=await (await fetch(SUPA+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.KH_QA_EMAIL,password:process.env.KH_QA_PASSWORD})})).json();
const session={access_token:tok.access_token,token_type:'bearer',expires_in:tok.expires_in,expires_at:Math.floor(Date.now()/1000)+tok.expires_in,refresh_token:tok.refresh_token,user:tok.user};
const b=await chromium.launch();
const pages=process.argv.slice(3).length?process.argv.slice(3):['index.html','korehan-all.html','korehan-section.html?s=buzz','korehan-conversations.html','korehan-study-room.html','korehan-learning-overview.html','korehan-mypage.html','korehan-shop.html','korehan-fun.html','korehan-courses.html','korehan-learn.html','korehan-reporters.html','beginner-guide.html','landing.html','korehan-onboarding.html','korehan-notes.html','korehan-friends.html'];
for (const pg of pages) {
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.addInitScript(([k,v])=>{try{localStorage.setItem(k,v);localStorage.setItem('kh_cookie_consent','essential')}catch(e){}},['sb-samghztrdvtxmrmawneu-auth-token',JSON.stringify(session)]);
  const p=await ctx.newPage();
  await p.goto(base+'/'+pg,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(9000);
  const out=await p.evaluate(()=>{
    const res=new Set(); const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n; while((n=w.nextNode())){ const t=n.nodeValue.replace(/\s+/g,' ').trim(); if(!t||!/[가-힣]/.test(t)) continue;
      const el=n.parentElement; if(!el) continue; const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') continue;
      if(el.closest('script,style,[lang="ko"]')) continue;
      // skip obvious content (article bodies, chat bubbles, word cards)
      if(el.closest('.art-body,.art-sent,.khn-title,.khr-title,.nc-title,.cc2-bub,.hconv-card,.story-card,.vc-ko,.kh-wb-ko')) continue;
      res.add(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]+' :: '+t.slice(0,90)); }
    return [...res];
  });
  console.log('\n=== '+pg+' ('+out.length+')'); out.slice(0,70).forEach(x=>console.log('  '+x));
  await ctx.close();
}
await b.close();
