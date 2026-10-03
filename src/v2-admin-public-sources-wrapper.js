import app from "./v2-sta-backfill-wrapper.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

const SOURCES=[
  {key:"FLIGHTSTATS_PUBLIC",label:"FlightStats",role:"STA / horaires planifiés"},
  {key:"FLIGHTAWARE_PUBLIC",label:"FlightAware",role:"fallback horaires / suivi"},
  {key:"FR24_PUBLIC_EXACT",label:"Flightradar24",role:"occurrence exacte / horaires / appareil"},
  {key:"FLIGHTERA_PUBLIC",label:"Flightera",role:"fallback public"}
];
function parisDate(){
  return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function addDays(date,n){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function sourceKey(v){const s=upper(v);if(s.includes("FLIGHTSTATS"))return "FLIGHTSTATS_PUBLIC";if(s.includes("FLIGHTAWARE"))return "FLIGHTAWARE_PUBLIC";if(s.includes("FR24")||s.includes("FLIGHTRADAR24"))return "FR24_PUBLIC_EXACT";if(s.includes("FLIGHTERA"))return "FLIGHTERA_PUBLIC";return s}
async function publicSourceStats(env){
  const today=parisDate(),j1=addDays(today,1),stats=Object.fromEntries(SOURCES.map(s=>[s.key,{...s,attempts:0,ok:0,failed:0,icaoFallbacks:0,lastAt:"",usedForSta:0}]));
  let totalFlights=0,missingSta=0;
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(today,j1).all();
    totalFlights=results.length;
    for(const row of results){
      let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
      if(!clean(x.sta))missingSta++;
      const b=x.staBackfill||{};
      const used=sourceKey(b.source||x.staSource);
      if(stats[used])stats[used].usedForSta++;
      const arr=Array.isArray(b.attempts)?b.attempts:[];
      for(const a of arr){
        const k=sourceKey(a.source);if(!stats[k])continue;
        const s=stats[k];s.attempts++;
        if(upper(a.status)==="OK")s.ok++;else s.failed++;
        if(upper(a.lookupCodeType)==="ICAO"||/^[A-Z]{3}\d/.test(upper(a.lookupDesignator)))s.icaoFallbacks++;
        const at=clean(a.checkedAt||b.checkedAt);if(at&&at>s.lastAt)s.lastAt=at;
      }
      const at=clean(b.checkedAt||x.staUpdatedAt);if(used&&stats[used]&&at&&at>stats[used].lastAt)stats[used].lastAt=at;
    }
  }catch(e){return {ok:false,error:"PUBLIC_SOURCE_STATS",detail:String(e?.message||e)}}
  // Ajoute les audits publics unitaires récents quand ils existent.
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT result_json,created_at FROM public_flight_audits WHERE flight_date IN (?,?) ORDER BY created_at DESC LIMIT 500`).bind(today,j1).all();
    for(const row of results){let r={};try{r=JSON.parse(row.result_json||"{}")}catch{}for(const src of (r.sources||[])){const k=sourceKey(src.name);if(!stats[k])continue;const s=stats[k];s.attempts++;if(upper(src.status)==="OK")s.ok++;else s.failed++;if(upper(src.lookupCodeType)==="ICAO"||String(src.lookupDesignator||"").match(/^[A-Z]{3}\d/))s.icaoFallbacks++;const at=clean(src.checkedAt||row.created_at);if(at&&at>s.lastAt)s.lastAt=at}}
  }catch{}
  return {ok:true,date:today,j1,totalFlights,missingSta,complete:missingSta===0,lookupStrategy:"IATA_THEN_ICAO",sources:SOURCES.map(s=>stats[s.key])};
}

const UI=String.raw`<style id="alyzia-admin-public-sources-css">
#app .adn-public-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
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
function replacePlans(){
  document.querySelectorAll('#app .admin-native .adn-next-plan b').forEach(el=>{
    let t=el.textContent||'';
    if(/AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|FLIGHTRADAR|CDGBOARD|KAYAK/i.test(t)){
      const prefix=t.includes('·')?t.split('·')[0].trim()+' · ':'';
      el.textContent=prefix+'SOURCES PUBLIQUES';
    }
  });
  document.querySelectorAll('#app .admin-native .adn-next-plan small').forEach(el=>{if(/API|FOURNISSEUR/i.test(el.textContent||''))el.textContent='RECHERCHE IATA → OACI · CASCADE PUBLIQUE'});
}
function patch(data){
  const sections=[...document.querySelectorAll('#app .admin-native .adn-section')];
  const sec=sections.find(s=>/QUOTAS API|SOURCES PUBLIQUES/i.test(s.querySelector('h3')?.textContent||''));
  if(sec&&data){
    const cards=(data.sources||[]).map(s=>'<div class="adn-public-source"><div class="ps-top"><span>'+esc(s.label)+'</span><span class="'+(s.ok?'ps-ok':'ps-warn')+'">'+esc(s.ok)+' OK</span></div><div class="ps-role">'+esc(s.role)+'</div><div class="ps-stats">TENTATIVES '+esc(s.attempts)+' · ÉCHECS '+esc(s.failed)+'<br>STA RETENUS '+esc(s.usedForSta)+' · FALLBACK OACI '+esc(s.icaoFallbacks)+'<br>DERNIER '+esc(fmt(s.lastAt))+'</div></div>').join('');
    sec.innerHTML='<h3>SOURCES PUBLIQUES</h3><div class="adn-source-note">RECHERCHE : CODE IATA D’ABORD, PUIS CODE OACI SI LE VOL N’EST PAS EXPLOITABLE · J/J+1 : '+esc(data.totalFlights)+' VOLS · STA MANQUANTS : '+esc(data.missingSta)+'</div><div class="adn-public-sources">'+cards+'</div>';
  }
  replacePlans();
}
async function refresh(){patch(await load())}
const original=window.renderAdminDashboard;
if(typeof original==='function'&&!original.__publicSources){
  const wrapped=async function(...args){const out=await original.apply(this,args);await refresh();return out};wrapped.__publicSources=true;window.renderAdminDashboard=wrapped;
}
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
