import app from "./v2-exact-occurrence-wrapper.js";

// ADMIN ergonomics layered on the existing dashboard: 10 flights per page, the public sources table on its own page,
// no flash of the legacy API sections while loading, and "next processing" lines that name the public sources.
const UI=String.raw`<style id="alyzia-admin-ux-css">
#app .admin-native .adn-table tbody tr.adx-off{display:none!important}
#app .admin-native .adn-section.adx-src{display:none}
@media(min-width:900px){#app .admin-native .adn-cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
#app .admin-native.adx-sources>*:not(.adx-srchead):not(.adx-src){display:none!important}
#app .admin-native.adx-sources .adn-section.adx-src{display:block}
.adx-pager{display:flex;align-items:center;justify-content:center;gap:10px;margin:12px 0 4px;flex-wrap:wrap}
.adx-pager button{min-height:36px;min-width:36px;padding:6px 12px;border:1px solid #bad2eb;border-radius:10px;background:#fff;color:#086bd5;font-weight:900;cursor:pointer}
.adx-pager button[disabled]{opacity:.4;cursor:default}.adx-pager button.on{background:#086bd5;color:#fff;border-color:#086bd5}
.adx-pager span{font-size:11px;font-weight:900;color:#536d87}
.adx-srcbtn{margin-left:8px;min-height:36px;padding:6px 14px;border:1px solid #bad2eb;border-radius:10px;background:#fff;color:#086bd5;font-weight:900;cursor:pointer}
.adx-cron{display:inline-flex;align-items:center;gap:6px;margin-left:8px;min-height:36px;padding:6px 12px;border:1px solid #cfe3f6;border-radius:10px;background:#f4f9ff;font-size:11px;font-weight:900;color:#536d87}.adx-cron b{font-size:15px;color:#086bd5;font-variant-numeric:tabular-nums}.adx-cron.soon b{color:#0f8a5f}
.adx-srchead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 14px}.adx-srchead b{font-size:22px;font-weight:950;color:#10233f}
</style><script id="alyzia-admin-ux-js">(()=>{'use strict';
if(window.__alyziaAdminUx)return;window.__alyziaAdminUx=true;
const PAGE=10,LEGACY=/QUOTAS?\s*API|PROVIDER|FOURNISSEUR/i,LEGACY_NAMES=/(AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|CDGBOARD|KAYAK|FLIGHTERA|FLIGHTRADAR\d)[A-Z0-9 \/→·+]*$/;
let page=1,sig='',view='main',queued=false;
const root=()=>document.querySelector('#app .admin-native');
const rows=r=>[...r.querySelectorAll('.adn-table tbody tr')];
function tidy(r){
  r.querySelectorAll('.adn-section').forEach(sec=>{
    const h=(sec.querySelector('h3')?.textContent||'').trim();
    if(/SOURCES PUBLIQUES/i.test(h)){if(!sec.classList.contains('adx-src'))sec.classList.add('adx-src');return}
    if(LEGACY.test(h))sec.remove();
  });
  r.querySelectorAll('.adn-card-next').forEach(el=>{const t=el.textContent||'',n=t.replace(LEGACY_NAMES,'FLIGHTSTATS · FR24 · FLIGHTAWARE');if(n!==t)el.textContent=n});
}
function cronLeft(){const n=new Date(),s=(120-((n.getUTCMinutes()%2)*60+n.getUTCSeconds()))%120||120;return s}
function cronText(){const s=cronLeft();return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function tickCron(){document.querySelectorAll('.adx-cron').forEach(el=>{const b=el.querySelector('b'),t=cronText();if(b&&b.textContent!==t)b.textContent=t;el.classList.toggle('soon',cronLeft()<=10)})}
function controls(r){
  const head=r.querySelector('.adn-head');
  if(head&&!head.querySelector('.adx-cron')){const c=document.createElement('span');c.className='adx-cron';c.title='Le contrôle automatique des vols passe toutes les 2 minutes (minutes paires)';c.innerHTML='PROCHAIN PASSAGE <b>--:--</b>';const ref=head.querySelector('.adx-srcbtn');(ref?.parentNode||head).insertBefore(c,ref||null);tickCron()}
  if(head&&!head.querySelector('.adx-srcbtn')){
    const b=document.createElement('button');b.type='button';b.className='adx-srcbtn';b.textContent='SOURCES PUBLIQUES';b.addEventListener('click',()=>setView('sources'));
    const refresh=head.querySelector('.adn-refresh,#adminRefreshBtn');(refresh?.parentNode||head).appendChild(b);
  }
  let bar=r.querySelector('.adx-srchead');
  if(!bar){bar=document.createElement('div');bar.className='adx-srchead';bar.innerHTML='<button type="button" class="adx-srcbtn" style="margin:0">‹ RETOUR ADMIN</button><b>SOURCES PUBLIQUES</b><span></span>';bar.querySelector('button').addEventListener('click',()=>setView('main'));r.insertBefore(bar,r.firstChild)}
  bar.style.display=view==='sources'?'flex':'none';
  r.classList.toggle('adx-sources',view==='sources');
}
function paginate(r){
  const table=r.querySelector('.adn-table');if(!table)return;
  const all=rows(r).filter(tr=>tr.style.display!=='none');
  const s=all.length+'|'+(all[0]?.textContent||'').slice(0,40);
  if(s!==sig){sig=s;page=1}
  const pages=Math.max(1,Math.ceil(all.length/PAGE));if(page>pages)page=pages;
  const keep=new Set(all.slice((page-1)*PAGE,page*PAGE));
  rows(r).forEach(tr=>{const off=!keep.has(tr)&&tr.style.display!=='none';if(tr.classList.contains('adx-off')!==off)tr.classList.toggle('adx-off',off)});
  const holder=table.closest('.adn-section')||table.parentElement;
  let bar=holder.querySelector('.adx-pager');if(!bar){bar=document.createElement('div');bar.className='adx-pager';holder.appendChild(bar)}
  const key=page+'/'+pages+'/'+all.length;if(bar.dataset.k===key)return;bar.dataset.k=key;
  let nums='';for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)nums+='<button type="button" data-p="'+i+'" class="'+(i===page?'on':'')+'">'+i+'</button>';else if(Math.abs(i-page)===2)nums+='<span>…</span>'}
  bar.innerHTML='<button type="button" data-p="'+(page-1)+'"'+(page<=1?' disabled':'')+'>‹</button>'+nums+'<button type="button" data-p="'+(page+1)+'"'+(page>=pages?' disabled':'')+'>›</button><span>'+all.length+' VOL'+(all.length>1?'S':'')+' · PAGE '+page+'/'+pages+'</span>';
  bar.querySelectorAll('button[data-p]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.p);if(n>=1&&n<=pages){page=n;bar.dataset.k='';run()}}));
}
function setView(v){view=v;const r=root();if(r){controls(r);try{window.scrollTo(0,0)}catch{}}}
function run(){queued=false;const r=root();if(!r){view='main';return}try{tidy(r);controls(r);paginate(r)}catch(e){console.error('admin ux',e)}}
function queue(){if(queued)return;queued=true;requestAnimationFrame(run)}
const app=document.getElementById('app');
if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
setInterval(run,1200);setInterval(tickCron,1000);
})();</script>`;

function patch(html){
  let s=String(html||"").replace(/<style id="alyzia-admin-ux-css">[\s\S]*?<\/style>/g,"").replace(/<script id="alyzia-admin-ux-js">[\s\S]*?<\/script>/g,"");
  const i=s.lastIndexOf("</body>");
  return i>=0?s.slice(0,i)+UI+"\n"+s.slice(i):s+UI;
}

export default {
  async fetch(request,env,ctx){
    const r=await app.fetch(request,env,ctx);
    const type=String(r.headers.get("content-type")||"").toLowerCase();
    if(!type.includes("text/html"))return r;
    const h=new Headers(r.headers);h.delete("content-length");h.set("cache-control","no-store");
    return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
