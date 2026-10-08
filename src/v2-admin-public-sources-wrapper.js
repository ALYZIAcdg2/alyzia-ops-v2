import app from "./v2-sta-backfill-wrapper.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

// Sources utiles seulement : celles qui alimentent les vols aujourd'hui. Les autres (PlaneFinder, Skyscanner, FlightView, Wego, Ixigo, Kayak, Flighty, SimpleFlying, Flightradars24.fr, Flightera) n'ont jamais rien apporté ou sont refusées en permanence.
const SOURCES=[
  {key:"FR24BOARD",label:"FR24 tableau CDG",role:"TAKEOFF / ETD / GATE / IMMAT / TYPE (un appel pour tous les vols)"},
  {key:"FIDS",label:"FIDS flightradar.live",role:"ATD / ATA / ETA des vols en l'air / GATE (un appel pour tous les vols)"},
  {key:"FR24",label:"Flightradar24 par vol",role:"ETD / TAKEOFF / ETA / LANDING / TYPE / IMMAT"},
  {key:"FLIGHTSTATS",label:"FlightStats",role:"ATD / ATA / ETA / statut"},
  {key:"FLIGHTAWARE",label:"FlightAware",role:"ATD / ETA / ATA / suivi vol"},
  {key:"GATENAVO",label:"Gatenavo (embarquement)",role:"STATUT embarquement / embarquement clos (un appel pour tous les vols)"},
  {key:"PARIS_AEROPORT",label:"Paris Aéroport",role:"GATE / statut / décollage / horaires CDG"}
];
const FIELDS=["sta","etd","atd","takeoff","eta","landing","ata","gate","reg","aircraftActual","status"];
const FIELD_LABEL={sta:"STA",etd:"ETD",atd:"ATD",takeoff:"TAKEOFF",eta:"ETA",landing:"LANDING",ata:"ATA",gate:"GATE",reg:"IMMAT",aircraftActual:"TYPE",status:"STATUS"};
const FAILURE_LABEL={BLOCKED:"BLOQUÉ",TIMEOUT:"TIMEOUT",HTTP_ERROR:"HTTP",FETCH_ERROR:"RÉSEAU",NO_USABLE_DATA:"SANS DONNÉE",OCCURRENCE_MISMATCH:"MAUVAISE OCCURRENCE",NOT_TRACKED:"NON SUIVI",NO_SOURCE:"SOURCE ABSENTE",UNKNOWN:"AUTRE"};
function parisDate(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function addDays(date,n){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function sourceKey(v){
  const s=upper(v);
  if(!s)return "";
  if(s.includes("FR24BOARD"))return "FR24BOARD";
  if(s.includes("FIDS"))return "FIDS";
  if(s.includes("FLIGHTSTATS"))return "FLIGHTSTATS";
  if(s.includes("FLIGHTAWARE"))return "FLIGHTAWARE";
  if(s.includes("GATENAVO"))return "GATENAVO";
  if(s.includes("PARIS_AEROPORT")||s.includes("PARIS AEROPORT"))return "PARIS_AEROPORT";
  if(s==="FR24"||s.includes("FR24")||s.includes("FLIGHTRADAR24"))return "FR24";
  return "";
}
function initStats(){return Object.fromEntries(SOURCES.map(s=>[s.key,{...s,attempts:0,ok:0,failed:0,icaoFallbacks:0,lastAt:"",fields:{},failureReasons:{},httpErrors:{}}]))}
function touch(s,at){const v=clean(at);if(v&&v>s.lastAt)s.lastAt=v}
function failureReason(a={}){
  const status=upper(a.status)||"UNKNOWN";
  if(status==="OK")return "";
  if(status==="HTTP_ERROR"&&a.httpStatus)return `HTTP_${Number(a.httpStatus)||0}`;
  if(FAILURE_LABEL[status])return status;
  if(status.includes("BLOCK"))return "BLOCKED";
  if(status.includes("TIMEOUT"))return "TIMEOUT";
  if(status.includes("MISMATCH"))return "OCCURRENCE_MISMATCH";
  if(status.includes("NOT_TRACK"))return "NOT_TRACKED";
  if(status.includes("NO_USABLE"))return "NO_USABLE_DATA";
  if(status.includes("FETCH"))return "FETCH_ERROR";
  return status||"UNKNOWN";
}
function addAttempt(stats,key,a={},fallbackAt=""){
  const s=stats[key];if(!s)return;
  s.attempts++;
  const status=upper(a.status);
  if(status==="OK")s.ok++;
  else{
    s.failed++;
    const reason=failureReason(a)||"UNKNOWN";
    s.failureReasons[reason]=(s.failureReasons[reason]||0)+1;
    if(reason.startsWith("HTTP_"))s.httpErrors[reason]=(s.httpErrors[reason]||0)+1;
  }
  if(upper(a.lookupCodeType||a.codeType)==="ICAO"||/^[A-Z]{3}\d/.test(upper(a.lookupDesignator||a.designator)))s.icaoFallbacks++;
  touch(s,a.checkedAt||fallbackAt);
}
function addField(stats,key,field,at){
  const s=stats[key];if(!s||!field)return;
  const f=FIELD_LABEL[field]||upper(field);s.fields[f]=(s.fields[f]||0)+1;touch(s,at);
}
function valueFor(x,field){
  if(field==="reg")return clean(x.reg||x.registration||x.aircraftRegistration);
  if(field==="aircraftActual")return clean(x.aircraftActual||x.aircraft||x.type);
  return clean(x[field]);
}
function sourceFor(x,field){
  if(field==="reg")return x.regSource||x.registrationSource||x.aircraftRegistrationSource;
  if(field==="aircraftActual")return x.aircraftActualSource||x.aircraftSource||x.typeSource;
  return x[field+"Source"];
}
function timeFor(x,field){
  if(field==="reg")return x.regUpdatedAt||x.registrationUpdatedAt||x.aircraftRegistrationUpdatedAt;
  if(field==="aircraftActual")return x.aircraftActualUpdatedAt||x.aircraftActualAt||x.aircraftUpdatedAt||x.typeUpdatedAt;
  return x[field+"UpdatedAt"];
}
async function publicSourceStats(env){
  const today=parisDate(),j1=addDays(today,1),stats=initStats();
  let totalFlights=0,missingSta=0;
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(today,j1).all();
    totalFlights=results.length;
    for(const row of results){
      let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
      if(!clean(x.sta))missingSta++;
      const b=x.staBackfill||{};
      for(const a of (Array.isArray(b.attempts)?b.attempts:[]))addAttempt(stats,sourceKey(a.source),a,b.checkedAt);
      const live=x.publicLiveBackfill||{};
      for(const a of (Array.isArray(live.attempts)?live.attempts:[]))addAttempt(stats,sourceKey(a.source),a,live.checkedAt);
      const faExact=x.flightAwareExactHistory||{};
      for(const a of (Array.isArray(faExact.attempts)?faExact.attempts:[]))addAttempt(stats,"FLIGHTAWARE",a,faExact.checkedAt);
      const ground=x.groundPublicBackfill||x.publicGroundBackfill||x.groundBackfill||{};
      for(const a of (Array.isArray(ground.attempts)?ground.attempts:[]))addAttempt(stats,sourceKey(a.source),a,ground.checkedAt);
      const seen=new Set();
      for(const field of FIELDS){
        if(!valueFor(x,field))continue;
        const key=sourceKey(sourceFor(x,field));if(!stats[key])continue;
        const sig=`${key}|${field}`;if(seen.has(sig))continue;seen.add(sig);addField(stats,key,field,timeFor(x,field));
      }
      for(const e of (Array.isArray(x.flightInfoLog)?x.flightInfoLog:[])){
        const key=sourceKey(e?.source);if(!stats[key])continue;
        let field=clean(e?.field);if(field==="registration"||field==="aircraftRegistration")field="reg";if(field==="aircraft"||field==="type")field="aircraftActual";
        if(!FIELDS.includes(field))continue;
        const sig=`${key}|${field}`;if(seen.has(sig))continue;seen.add(sig);addField(stats,key,field,e?.at);
      }
      const phaseKey=upper(x.parisAeroportVia)==="GATENAVO"?"GATENAVO":sourceKey(x.parisAeroportPhaseSource);if(phaseKey==="GATENAVO"&&stats.GATENAVO&&clean(x.parisAeroportStatusCheckedAt))addAttempt(stats,"GATENAVO",{status:"OK",checkedAt:x.parisAeroportStatusCheckedAt});if(stats[phaseKey]&&clean(x.parisAeroportPhase))addField(stats,phaseKey,"status",x.parisAeroportPhaseUpdatedAt||x.parisAeroportStatusCheckedAt);
    }
  }catch(e){return {ok:false,error:"PUBLIC_SOURCE_STATS",detail:String(e?.message||e)}}
  const sources=SOURCES.map(def=>{
    const s=stats[def.key],fieldTotal=Object.values(s.fields).reduce((a,b)=>a+Number(b||0),0);
    const failureList=Object.entries(s.failureReasons).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,label:reason.startsWith("HTTP_")?reason.replace("_"," "):(FAILURE_LABEL[reason]||reason),count}));
    return {...s,fieldTotal,fieldList:Object.entries(s.fields).sort((a,b)=>b[1]-a[1]).map(([field,count])=>({field,count})),failureList};
  });
  return {ok:true,date:today,j1,totalFlights,missingSta,complete:missingSta===0,lookupStrategy:"IATA_THEN_ICAO",sourceCount:SOURCES.length,sources};
}

const UI=String.raw`<style id="alyzia-admin-public-sources-css">
#app .adn-public-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
#app .adn-public-source{border:1px solid #e0e8f1;border-radius:12px;padding:10px;background:#fbfdff}
#app .adn-public-source .ps-top{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:950}
#app .adn-public-source .ps-role{margin-top:4px;font-size:9px;color:#71839a;font-weight:850}
#app .adn-public-source .ps-stats{margin-top:7px;font-size:10px;color:#405b74;font-weight:850;line-height:1.5}
#app .adn-public-source .ps-ok{color:#087443}#app .adn-public-source .ps-warn{color:#a76a00}
#app .adn-public-source .ps-fields{margin-top:5px;color:#0a6abf;font-size:9px;font-weight:900;line-height:1.45}
#app .adn-public-source .ps-failures{margin-top:5px;padding-top:5px;border-top:1px dashed #e3eaf2;color:#a04424;font-size:9px;font-weight:900;line-height:1.45}
#app .adn-public-source .ps-failures.ok{color:#087443}
#app .adn-source-note{margin:0 0 9px;font-size:10px;color:#52677d;font-weight:850}
#app .ps-table-wrap{overflow:auto;border:1px solid #e0e8f1;border-radius:12px}
#app .ps-table{width:100%;border-collapse:collapse;font-size:11px;min-width:640px}
#app .ps-table th{position:sticky;top:0;background:#f4f8fc;color:#4a6078;font-size:9px;font-weight:950;text-align:left;padding:8px 10px;white-space:nowrap}
#app .ps-table td{padding:8px 10px;border-top:1px solid #edf2f7;vertical-align:top;color:#27425e;font-weight:800}
#app .ps-table .ps-name b{display:block;font-size:12px;color:#10304f}#app .ps-table .ps-name small{display:block;margin-top:2px;font-size:9px;color:#71839a;font-weight:800}
#app .ps-table .ps-num{text-align:right;font-variant-numeric:tabular-nums}
#app .ps-table .ps-ok{color:#087443}#app .ps-table .ps-warn{color:#a04424}
#app .ps-table .ps-fields{color:#0a6abf;font-size:10px}#app .ps-table .ps-fail{color:#a04424;font-size:10px}#app .ps-table .ps-last{white-space:nowrap;color:#52677d}
#app .ps-table tr.ps-unused td{opacity:.55}
#app .ps-toggle{margin-top:8px;border:1px solid #cfdbe8;background:#f3f7fb;color:#4a6078;border-radius:999px;padding:7px 12px;font-size:10px;font-weight:900;line-height:1.2;font-family:inherit;cursor:pointer}
</style><script id="alyzia-admin-public-sources-js">(()=>{'use strict';
if(window.__alyziaAdminPublicSources)return;window.__alyziaAdminPublicSources=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let cache=null,showUnused=false;
async function load(){try{const r=await fetch('/api/admin/public-sources',{cache:'no-store'});const d=await r.json();if(r.ok&&d?.ok)cache=d}catch{}return cache}
function fmt(v){if(!v)return '—';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function removeProviderSections(){[...document.querySelectorAll('#app .admin-native .adn-section')].forEach(sec=>{const h=(sec.querySelector('h3')?.textContent||'').trim().toUpperCase();if(/PROVIDER|FOURNISSEUR|QUOTAS? API/.test(h)&&!h.includes('SOURCES PUBLIQUES'))sec.remove()})}
function replacePlans(){document.querySelectorAll('#app .admin-native .adn-next-plan b').forEach(el=>{let t=el.textContent||'';if(/AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|FLIGHTRADAR|CDGBOARD|KAYAK/i.test(t)){const prefix=t.includes('·')?t.split('·')[0].trim()+' · ':'';el.textContent=prefix+'SOURCES PUBLIQUES'}});document.querySelectorAll('#app .admin-native .adn-next-plan small').forEach(el=>{if(/API|FOURNISSEUR|PROVIDER/i.test(el.textContent||''))el.textContent='RECHERCHE IATA → OACI · SOURCES PUBLIQUES'})}
function fields(s){return (s.fieldList||[]).map(x=>esc(x.field)+' '+esc(x.count)).join(' · ')||'AUCUN CHAMP RETENU'}
function failures(s){const a=s.failureList||[];return a.length?a.map(x=>esc(x.label)+' '+esc(x.count)).join(' · '):'AUCUN ÉCHEC'}
function patch(data){
  removeProviderSections();const sections=[...document.querySelectorAll('#app .admin-native .adn-section')];let sec=sections.find(s=>/SOURCES PUBLIQUES|QUOTAS API/i.test(s.querySelector('h3')?.textContent||''));if(!sec&&sections.length){sec=document.createElement('div');sec.className='adn-section';sections[0].after(sec)}
  if(sec&&data){
   // A source that never produced a field nor a successful read is hidden (counted in the footer, one click to show them).
   const all=data.sources||[],useful=all.filter(s=>Number(s.fieldTotal)>0||Number(s.ok)>0||Number(s.attempts)>0).sort((a,b)=>Number(b.fieldTotal)-Number(a.fieldTotal)||Number(b.ok)-Number(a.ok)),unused=all.filter(s=>!useful.includes(s)),shown=all;
   const row=s=>'<tr class="'+(Number(s.fieldTotal)>0||Number(s.ok)>0?'':'ps-unused')+'"><td class="ps-name"><b>'+esc(s.label)+'</b><small>'+esc(s.role)+'</small></td><td class="ps-num ps-ok">'+esc(s.ok)+'</td><td class="ps-num">'+esc(s.attempts)+'</td><td class="ps-num '+(s.failed?'ps-warn':'')+'">'+esc(s.failed)+'</td><td class="ps-fields">'+esc((s.fieldList||[]).map(x=>x.field+' '+x.count).join(' · ')||'—')+'</td><td class="ps-fail">'+((s.failureList||[]).slice(0,2).map(x=>esc(x.label)+' '+esc(x.count)).join(' · ')||'—')+'</td><td class="ps-last">'+esc(fmt(s.lastAt))+'</td></tr>';
   const foot='';
   sec.innerHTML='<h3>SOURCES PUBLIQUES · '+useful.length+' ACTIVE'+(useful.length>1?'S':'')+'</h3><div class="adn-source-note">J/J+1 : '+esc(data.totalFlights)+' VOLS · STA MANQUANTS : '+esc(data.missingSta)+' · IATA → OACI</div><div class="ps-table-wrap"><table class="ps-table"><thead><tr><th>SOURCE</th><th>OK</th><th>TENT.</th><th>KO</th><th>CHAMPS RETENUS</th><th>ÉCHECS</th><th>DERNIER</th></tr></thead><tbody>'+(shown.map(row).join('')||'<tr><td colspan="7">AUCUNE SOURCE ACTIVE</td></tr>')+'</tbody></table></div>'+foot;
   const t=sec.querySelector('#psToggle');if(t)t.onclick=()=>{showUnused=!showUnused;patch(cache)};
  }
  replacePlans();
}
async function refresh(){patch(await load())}
const original=window.renderAdminDashboard;if(typeof original==='function'&&!original.__publicSources){const wrapped=async function(...args){const out=await original.apply(this,args);await refresh();return out};wrapped.__publicSources=true;window.renderAdminDashboard=wrapped}
window.addEventListener('adn:repaint',()=>setTimeout(refresh,30));document.addEventListener('click',e=>{if(e.target?.closest?.('#adminRefreshBtn,#adminPrev,#adminNext,#adminDateBtn,[data-mobile-nav="admin"]'))setTimeout(refresh,80)},true);setTimeout(refresh,50);
})();</script>`;
function patchHtml(html){let s=String(html||"");s=s.replace(/<style id="alyzia-admin-public-sources-css">[\s\S]*?<\/style>/g,"").replace(/<script id="alyzia-admin-public-sources-js">[\s\S]*?<\/script>/g,"");const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);if(url.pathname==="/api/admin/public-sources"&&request.method==="GET")return json(await publicSourceStats(env));
    const response=await app.fetch(request,env,ctx);const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
