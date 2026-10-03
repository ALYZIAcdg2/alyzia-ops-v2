import app from "./v2-sta-backfill-wrapper.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

// Same public-source catalogue as public-web-day-test.js.
const SOURCES=[
  {key:"FR24",label:"Flightradar24",role:"suivi vol / occurrence / appareil"},
  {key:"FLIGHTAWARE",label:"FlightAware",role:"suivi vol / horaires"},
  {key:"FLIGHTSTATS",label:"FlightStats",role:"horaires planifiés / statut"},
  {key:"PLANEFINDER",label:"PlaneFinder",role:"suivi vol / appareil"},
  {key:"SKYSCANNER",label:"Skyscanner",role:"horaires / statut"},
  {key:"FLIGHTVIEW",label:"FlightView",role:"horaires / statut"},
  {key:"WEGO",label:"Wego",role:"horaires"},
  {key:"IXIGO",label:"Ixigo",role:"statut / horaires"},
  {key:"KAYAK",label:"Kayak",role:"suivi / horaires"},
  {key:"FLIGHTY",label:"Flighty",role:"tableau départs CDG"},
  {key:"PARIS_AEROPORT",label:"Paris Aéroport",role:"source aéroport CDG"},
  {key:"SIMPLEFLYING",label:"SimpleFlying",role:"flight tracker public"},
  {key:"FLIGHTRADARS24_FR",label:"Flightradars24.fr",role:"départs CDG"},
  {key:"FLIGHTERA",label:"Flightera",role:"horaires / statut / fallback"}
];
function parisDate(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function addDays(date,n){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function sourceKey(v){
  const s=upper(v);
  if(s.includes("FLIGHTSTATS"))return "FLIGHTSTATS";
  if(s.includes("FLIGHTAWARE"))return "FLIGHTAWARE";
  if(s==="FR24"||s.includes("FR24_PUBLIC")||s.includes("FLIGHTRADAR24"))return "FR24";
  if(s.includes("PLANEFINDER"))return "PLANEFINDER";
  if(s.includes("SKYSCANNER"))return "SKYSCANNER";
  if(s.includes("FLIGHTVIEW"))return "FLIGHTVIEW";
  if(s.includes("WEGO"))return "WEGO";
  if(s.includes("IXIGO"))return "IXIGO";
  if(s.includes("KAYAK"))return "KAYAK";
  if(s.includes("FLIGHTY"))return "FLIGHTY";
  if(s.includes("PARIS_AEROPORT")||s.includes("PARIS AEROPORT"))return "PARIS_AEROPORT";
  if(s.includes("SIMPLEFLYING"))return "SIMPLEFLYING";
  if(s.includes("FLIGHTRADARS24"))return "FLIGHTRADARS24_FR";
  if(s.includes("FLIGHTERA"))return "FLIGHTERA";
  return s;
}
function addAttempt(stats,key,{status="",lookupCodeType="",lookupDesignator="",checkedAt="",usedForSta=false}={}){
  const s=stats[key];if(!s)return;
  s.attempts++;
  if(upper(status)==="OK")s.ok++;else s.failed++;
  if(upper(lookupCodeType)==="ICAO"||/^[A-Z]{3}\d/.test(upper(lookupDesignator)))s.icaoFallbacks++;
  if(usedForSta)s.usedForSta++;
  if(checkedAt&&checkedAt>s.lastAt)s.lastAt=checkedAt;
}
async function publicSourceStats(env){
  const today=parisDate(),j1=addDays(today,1);
  const stats=Object.fromEntries(SOURCES.map(s=>[s.key,{...s,attempts:0,ok:0,failed:0,icaoFallbacks:0,lastAt:"",usedForSta:0}]));
  let totalFlights=0,missingSta=0;
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(today,j1).all();
    totalFlights=results.length;
    for(const row of results){
      let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
      if(!clean(x.sta))missingSta++;
      const b=x.staBackfill||{},used=sourceKey(b.source||x.staSource);
      if(stats[used])stats[used].usedForSta++;
      for(const a of (Array.isArray(b.attempts)?b.attempts:[])){
        const k=sourceKey(a.source);addAttempt(stats,k,{...a,checkedAt:clean(a.checkedAt||b.checkedAt)});
      }
      const at=clean(b.checkedAt||x.staUpdatedAt);if(stats[used]&&at&&at>stats[used].lastAt)stats[used].lastAt=at;
    }
  }catch(e){return {ok:false,error:"PUBLIC_SOURCE_STATS",detail:String(e?.message||e)}}

  // Reuse the complete 14-site day-test history when available.
  try{
    const {results=[]}=await env.OPS_DB.prepare(`
      SELECT r.source,r.status,r.candidates_json,r.checked_at
      FROM public_web_test_results r
      JOIN public_web_test_runs x ON x.run_id=r.run_id
      WHERE x.flight_date IN (?,?)
      ORDER BY r.checked_at DESC
      LIMIT 12000
    `).bind(today,j1).all();
    for(const row of results){
      const k=sourceKey(row.source);if(!stats[k])continue;
      let c={};try{c=JSON.parse(row.candidates_json||"{}")}catch{}
      const attempts=Array.isArray(c.lookupAttempts)?c.lookupAttempts:[];
      if(attempts.length){
        for(const a of attempts)addAttempt(stats,k,{status:a.status,lookupCodeType:a.codeType,lookupDesignator:a.designator,checkedAt:clean(a.checkedAt||row.checked_at)});
      }else addAttempt(stats,k,{status:row.status,lookupCodeType:c.lookupCodeType,lookupDesignator:c.lookupDesignator,checkedAt:clean(row.checked_at)});
    }
  }catch{}

  return {ok:true,date:today,j1,totalFlights,missingSta,complete:missingSta===0,lookupStrategy:"IATA_THEN_ICAO",sourceCount:SOURCES.length,sources:SOURCES.map(s=>stats[s.key])};
}

const UI=String.raw`<style id="alyzia-admin-public-sources-css">
#app .adn-public-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:8px}
#app .adn-public-source{border:1px solid #e0e8f1;border-radius:12px;padding:10px;background:#fbfdff}
#app .adn-public-source .ps-top{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:950}
#app .adn-public-source .ps-role{margin-top:4px;font-size:9px;color:#71839a;font-weight:850}
#app .adn-public-source .ps-stats{margin-top:7px;font-size:10px;color:#405b74;font-weight:850;line-height:1.5}
#app .adn-public-source .ps-ok{color:#087443}#app .adn-public-source .ps-warn{color:#a76a00}
#app .adn-source-note{margin:0 0 9px;font-size:10px;color:#52677d;font-weight:850}
</style><script id="alyzia-admin-public-sources-js">(()=>{'use strict';
if(window.__alyziaAdminPublicSources)return;window.__alyziaAdminPublicSources=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let cache=null;
async function load(){try{const r=await fetch('/api/admin/public-sources',{cache:'no-store'});const d=await r.json();if(r.ok&&d?.ok)cache=d}catch{}return cache}
function fmt(v){if(!v)return '—';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function removeProviderSections(){
  [...document.querySelectorAll('#app .admin-native .adn-section')].forEach(sec=>{
    const h=(sec.querySelector('h3')?.textContent||'').trim().toUpperCase();
    if(/PROVIDER|FOURNISSEUR|QUOTAS? API/.test(h)&&!h.includes('SOURCES PUBLIQUES'))sec.remove();
  });
}
function replacePlans(){
  document.querySelectorAll('#app .admin-native .adn-next-plan b').forEach(el=>{
    let t=el.textContent||'';
    if(/AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|FLIGHTRADAR|CDGBOARD|KAYAK/i.test(t)){
      const prefix=t.includes('·')?t.split('·')[0].trim()+' · ':'';el.textContent=prefix+'SOURCES PUBLIQUES';
    }
  });
  document.querySelectorAll('#app .admin-native .adn-next-plan small').forEach(el=>{if(/API|FOURNISSEUR|PROVIDER/i.test(el.textContent||''))el.textContent='RECHERCHE IATA → OACI · SOURCES PUBLIQUES'});
}
function patch(data){
  removeProviderSections();
  const sections=[...document.querySelectorAll('#app .admin-native .adn-section')];
  let sec=sections.find(s=>/SOURCES PUBLIQUES|QUOTAS API/i.test(s.querySelector('h3')?.textContent||''));
  if(!sec&&sections.length){sec=document.createElement('div');sec.className='adn-section';sections[0].after(sec)}
  if(sec&&data){
    const cards=(data.sources||[]).map(s=>'<div class="adn-public-source"><div class="ps-top"><span>'+esc(s.label)+'</span><span class="'+(s.ok?'ps-ok':'ps-warn')+'">'+esc(s.ok)+' OK</span></div><div class="ps-role">'+esc(s.role)+'</div><div class="ps-stats">TENTATIVES '+esc(s.attempts)+' · ÉCHECS '+esc(s.failed)+'<br>STA RETENUS '+esc(s.usedForSta)+' · FALLBACK OACI '+esc(s.icaoFallbacks)+'<br>DERNIER '+esc(fmt(s.lastAt))+'</div></div>').join('');
    sec.innerHTML='<h3>SOURCES PUBLIQUES · '+esc(data.sourceCount||0)+'</h3><div class="adn-source-note">RECHERCHE VOL : IATA D’ABORD, PUIS OACI SI LE PREMIER RÉSULTAT N’EST PAS EXPLOITABLE · J/J+1 : '+esc(data.totalFlights)+' VOLS · STA MANQUANTS : '+esc(data.missingSta)+'</div><div class="adn-public-sources">'+cards+'</div>';
  }
  replacePlans();
}
async function refresh(){patch(await load())}
const original=window.renderAdminDashboard;
if(typeof original==='function'&&!original.__publicSources){const wrapped=async function(...args){const out=await original.apply(this,args);await refresh();return out};wrapped.__publicSources=true;window.renderAdminDashboard=wrapped}
window.addEventListener('adn:repaint',()=>setTimeout(refresh,30));
document.addEventListener('click',e=>{if(e.target?.closest?.('#adminRefreshBtn,#adminPrev,#adminNext,#adminDateBtn,[data-mobile-nav="admin"]'))setTimeout(refresh,80)},true);
setTimeout(refresh,50);
})();</script>`;
function patchHtml(html){const s=String(html||"");if(s.includes('id="alyzia-admin-public-sources-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/public-sources"&&request.method==="GET")return json(await publicSourceStats(env));
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
