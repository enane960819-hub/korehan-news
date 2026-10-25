// Grammar link audit (2026-10-26): every grammar label in saved article
// analyses → the Study Room lesson it opens. Run: KH_QA_EMAIL=… KH_QA_PASSWORD=… node docs/reference/grammar-link-audit.mjs
// (needs a signed-in test account; prints hidden/changed counts + suspicious pairs).
import fs from 'fs';
const SUPA='https://samghztrdvtxmrmawneu.supabase.co';
const SR=fs.readFileSync('korehan/korehan-study-room.js','utf8');
const SH=fs.readFileSync('korehan/korehan-shared.js','utf8');
const ANON=SH.match(/eyJ[A-Za-z0-9_.-]{40,}/)[0];
const tok=await (await fetch(SUPA+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.KH_QA_EMAIL,password:process.env.KH_QA_PASSWORD})})).json();
const H={apikey:ANON,Authorization:'Bearer '+tok.access_token};
const all=async q=>{let out=[];for(let f=0;f<20000;f+=1000){const r=await fetch(SUPA+'/rest/v1/'+q,{headers:{...H,Range:`${f}-${f+999}`}});const d=await r.json();if(!Array.isArray(d))break;out=out.concat(d);if(d.length<1000)break;}return out;};
const code=SR.slice(SR.indexOf('function _gcNorm(s)'), SR.indexOf('// -- Curriculum localStorage key'));
const cur=await all('grammar_curriculum?select=pattern,level,description,unit&active=eq.true');
const lm=await all('grammar_label_map?select=label_norm,pattern,verdict&verdict=neq.skip');
const M=new Function('C','LM','var GRAMMAR_CURRICULUM=C;'+code+';LM.forEach(function(r){ if(r.pattern) _GC_LABEL_MAP[r.label_norm]=r.pattern; }); return {find:_gcFindItem, ctx:_gcFindItemCtx};')(cur.map(r=>({pattern:r.pattern,level:r.level,desc:r.description||''})), lm);
const _khAnalysisFalsePositive=new Function(SH.slice(SH.indexOf('var _KH_UI_WORDS'), SH.indexOf('function _khRenderSentPanel'))+';return _khAnalysisFalsePositive;')();
const rows=await all('article_cache?select=article_id,translation');
let total=0,hidden=0,changed=0; const items=[];
for (const r of rows){ let t=r.translation; try{ if(typeof t==='string') t=JSON.parse(t);}catch(e){continue}
  for(const s of ((t&&t.sentences)||[])){ for(const it of (s.analysis||[])){ if((it.type||'grammar')!=='grammar') continue; const L=(it.label||'').trim(); if(!L) continue; total++;
    if(_khAnalysisFalsePositive(it, s.text||s.ko||'')){hidden++;continue;}
    const name=L.replace(/\s*\([^)]*\)\s*$/,'').trim(); const exp=it.exp||''; const ex=it.example_in_sentence||'';
    const a=M.find(name), b=M.ctx(name,exp,ex); if((a&&a.pattern)!==(b&&b.pattern)) changed++;
    items.push({L,name,exp,ex,p:b?b.pattern:null}); } } }
console.log({total,hidden,changed});
// suspicious: mapped lesson's Korean core (before —) has no syllable overlap with example
const sus={};
for(const x of items){ if(!x.p) continue; const core=x.p.split(' — ')[0]; const syl=(core.match(/[가-힣]/g)||[]); const exs=x.ex.replace(/\s/g,'');
  // skip conjugation-based lessons (tense, endings, irregulars) where surface differs
  if(/Past tense|Verb endings|irregular|drop|Noun modifiers|Formal polite|Future tense/.test(x.p)) continue;
  if(syl.length && !syl.some(c=>exs.includes(c))){ const k=x.name+' => '+x.p; (sus[k]=sus[k]||{n:0,ex:x.ex,exp:x.exp.slice(0,70)}).n++; } }
const list=Object.entries(sus).sort((a,b)=>b[1].n-a[1].n);
console.log('suspicious label→lesson pairs:',list.length); for(const [k,v] of list.slice(0,60)) console.log(v.n,'|',k,'|',v.ex,'|',v.exp);
