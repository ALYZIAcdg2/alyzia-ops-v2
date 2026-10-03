import app from "./v2-admin-public-sources-wrapper.js";
import {runStaBackfill} from "./sta-backfill-public.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

const PUBLIC_SOURCE_LABELS=[
  ["FLIGHTSTATS","FlightStats"],["FLIGHTAWARE","FlightAware"],["FR24","Flightradar24"],["FLIGHTRADAR24","Flightradar24"],
  ["PLANEFINDER","PlaneFinder"],["SKYSCANNER","Skyscanner"],["FLIGHTVIEW","FlightView"],["WEGO","Wego"],
  ["IXIGO","Ixigo"],["KAYAK","Kayak"],["FLIGHTY","Flighty"],["PARIS_AEROPORT","Paris Aéroport"],
  ["SIMPLEFLYING","SimpleFlying"],["FLIGHTRADARS24","Flightradars24.fr"],["FLIGHTERA","Flightera"]
];
const STA_CHAIN=["FlightStats","FlightAware","Flightradar24 exact","Flightera"];
function publicLabel(source){const s=upper(source);if(!s)return "";for(const [key,label] of PUBLIC_SOURCE_LABELS)if(s.includes(key))return label;return ""}
function flightNumber(airline,flight){const a=upper(airline),f=upper(flight);if(f.startsWith(a))return f.slice(a.length);return f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"")}
function latestPublicSourceInfo(x){
  const direct=[
    [x.staSource,x.staUpdatedAt||x?.staBackfill?.checkedAt],[x.etdSource,x.etdUpdatedAt],[x.atdSource,x.atdUpdatedAt],
    [x.takeoffSource,x.takeoffUpdatedAt],[x.etaSource,x.etaUpdatedAt],[x.landingSource,x.landingUpdatedAt],
    [x.ataSource,x.ataUpdatedAt],[x.gateSource,x.gateUpdatedAt],[x.regSource||x.registrationSource,x.regUpdatedAt],
    [x.aircraftActualSource||x.typeSource,x.aircraftActualAt],[x?.staBackfill?.source,x?.staBackfill?.checkedAt]
  ];
  for(const [src,at] of direct){const label=publicLabel(src);if(label)return {source:label,at:clean(at)}}
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
  for(const e of log){const label=publicLabel(e?.source);if(label)return {source:label,at:clean(e?.at)}}
  return {source:"DONNÉE EXISTANTE / IMPORT",at:""};
}
function cronPlan(x){const sta=clean(x.sta);return sta&&sta!=="—"?{next:"STA OK",chain:[]}:{next:"FlightStats",chain:STA_CHAIN}}
async function publicFlow(env){
  const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+2);const until=d.toISOString().slice(0,10);
  const p=new Date(`${today}T12:00:00Z`);p.setUTCDate(p.getUTCDate()-1);const since=p.toISOString().slice(0,10);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,data_json FROM flights WHERE flight_date>=? AND flight_date<=? AND airline<>'SYS' ORDER BY flight_date,flight_number`).bind(since,until).all();
  const flights=[];
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const airline=upper(x.airline||row.airline),number=flightNumber(airline,x.flight||row.flight_number),flight=upper(x.flight||`${airline}${number}`);
    const last=latestPublicSourceInfo(x),plan=cronPlan(x);
    flights.push({identity:row.identity,date:row.flight_date,flight,source:last.source,sourceAt:last.at,nextSource:plan.next,nextChain:plan.chain,sta:clean(x.sta)});
  }
  return {ok:true,generatedAt:new Date().toISOString(),since,until,flights};
}
async function ensureDeletedTable(env){
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS admin_deleted_flights(identity TEXT PRIMARY KEY,flight_date TEXT,airline TEXT,flight_number TEXT,snapshot_json TEXT,deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}
async function deleteFlight(request,env){
  let body={};try{body=await request.json()}catch{}
  const identity=clean(body.identity);if(!identity)return json({ok:false,error:"IDENTITY_REQUIRED"},400);
  await ensureDeletedTable(env);
  const row=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,data_json FROM flights WHERE identity=? LIMIT 1`).bind(identity).first();
  if(!row)return json({ok:false,error:"FLIGHT_NOT_FOUND"},404);
  await env.OPS_DB.prepare(`INSERT INTO admin_deleted_flights(identity,flight_date,airline,flight_number,snapshot_json,deleted_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(identity) DO UPDATE SET snapshot_json=excluded.snapshot_json,deleted_at=CURRENT_TIMESTAMP`).bind(row.identity,row.flight_date,row.airline,row.flight_number,row.data_json).run();
  await env.OPS_DB.prepare(`DELETE FROM flights WHERE identity=?`).bind(identity).run();
  try{await env.OPS_DB.prepare(`DELETE FROM provider_enrichment_queue WHERE flight_identity=?`).bind(identity).run()}catch{}
  return json({ok:true,deleted:true,identity,flight:row.flight_number,date:row.flight_date});
}
async function publicPush(env){
  const result=await runStaBackfill(env,{limit:96,concurrency:4});
  return json({ok:true,mode:"PUBLIC_SOURCES_PUSH",sources:STA_CHAIN,...result});
}

const UI=String.raw`<style id="alyzia-admin-public-flow-css">
#app .admin-native .adn-source-chain{display:block;margin-top:2px;color:#73869b;font-size:8px;font-weight:800;white-space:normal}
#app .admin-native .adn-last .adn-public-src{display:block;color:#087443;font-weight:950;margin-top:2px}
#app .admin-native .adn-next .adn-public-next{color:#0a6abf;font-weight:950}
#app .admin-native .adn-delete-flight{margin-left:7px;border:0;background:#fff1f2;color:#c6283c;border-radius:7px;padding:3px 6px;font-size:10px;font-weight:950;cursor:pointer}
</style><script id="alyzia-admin-public-flow-js">(()=>{'use strict';
if(window.__alyziaAdminPublicFlowV2)return;window.__alyziaAdminPublicFlowV2=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let flow=null;
async function load(){try{const r=await fetch('/api/admin/public-flow',{cache:'no-store'}),d=await r.json();if(r.ok&&d?.ok)flow=d}catch{}return flow}
function selectedDate(){return document.getElementById('adminDateInput')?.value||''}
function findFlow(flight){const d=selectedDate(),f=String(flight||'').trim().toUpperCase();return (flow?.flights||[]).find(x=>x.date===d&&String(x.flight||'').toUpperCase()===f)||null}
function nextCron(){const d=new Date();d.setSeconds(0,0);const m=d.getMinutes();d.setMinutes(m<30?30:60);return d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
function fmtAt(v){if(!v)return '—';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function providerBlock(){
 const root=document.querySelector('#app .admin-native');if(!root)return null;
 const heads=[...root.querySelectorAll('h1,h2,h3,h4,div,strong')].filter(el=>String(el.textContent||'').trim().toUpperCase()==='PROVIDER OBSERVABILITY');
 for(const h of heads){let b=h;for(let i=0;i<6&&b;i++,b=b.parentElement){const t=String(b.textContent||'').toUpperCase();if(t.includes('OAG')&&t.includes('AIRLABS')&&t.includes('SKYLINK'))return b}}
 return heads[0]?.parentElement||null;
}
function publicSourcesSection(){return [...document.querySelectorAll('#app .admin-native .adn-section')].find(s=>String(s.querySelector('h3')?.textContent||'').toUpperCase().includes('SOURCES PUBLIQUES'))||null}
function placePublicSources(){
 const old=providerBlock(),src=publicSourcesSection();
 if(old){const parent=old.parentElement,next=old.nextSibling;old.remove();if(src&&parent){next?parent.insertBefore(src,next):parent.appendChild(src)}}
}
function removeExtraColumns(table){
 if(!table)return;
 const head=table.querySelector('thead tr');if(head){[...head.children].filter(th=>th.dataset.publicFlowHead||['SOURCE ALIMENTÉE','PROCHAIN CRON'].includes(String(th.textContent||'').trim().toUpperCase())).forEach(th=>th.remove())}
 table.querySelectorAll('td.adn-source-fed,td.adn-source-next').forEach(td=>td.remove());
 table.classList.remove('adn-public-flow-table');
}
function patchTable(){
 const root=document.querySelector('#app .admin-native');if(!root||!flow)return;
 const table=[...root.querySelectorAll('.adn-table')].find(t=>{const h=[...t.querySelectorAll('thead th')].map(x=>String(x.textContent||'').trim().toUpperCase());return h.includes('VOL')&&h.includes('STA')&&h.includes('DERNIER TRAITEMENT')}) ;if(!table)return;
 removeExtraColumns(table);
 const headers=[...table.querySelectorAll('thead th')].map(x=>String(x.textContent||'').trim().toUpperCase()),lastIdx=headers.indexOf('DERNIER TRAITEMENT'),nextIdx=headers.indexOf('PROCHAIN');
 [...table.querySelectorAll('tbody tr')].forEach(tr=>{
   const cells=[...tr.children],flight=String(cells[0]?.textContent||'').trim().toUpperCase(),f=findFlow(flight);if(!f)return;
   if(lastIdx>=0&&cells[lastIdx])cells[lastIdx].innerHTML=esc(fmtAt(f.sourceAt))+'<span class="adn-public-src">'+esc(f.source||'—')+'</span>';
   if(nextIdx>=0&&cells[nextIdx]){
     const chain=(f.nextChain||[]).join(' → '),next=f.nextSource==='STA OK'?'STA OK':nextCron()+' · '+(f.nextSource||'—');
     cells[nextIdx].innerHTML='<span class="adn-public-next">'+esc(next)+'</span>'+(chain?'<span class="adn-source-chain">'+esc(chain)+'</span>':'')+'<button type="button" class="adn-delete-flight" data-delete-id="'+esc(f.identity)+'" data-delete-flight="'+esc(f.flight)+'">SUPPR.</button>';
   }
 });
}
async function refresh(){await load();placePublicSources();patchTable();setTimeout(()=>{placePublicSources();patchTable()},80)}
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='Recherche immédiate sur les sources publiques…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(msg)msg.textContent=j?.ok?'✓ SOURCES PUBLIQUES · '+(j.filled||0)+' STA AJOUTÉ(S) · '+(j.missingAfter||0)+' RESTANT(S)':'ÉCHEC : '+(j?.error||('HTTP '+r.status));await window.renderAdminDashboard?.(true)}catch(e){if(msg)msg.textContent='ÉCHEC : '+(e?.message||e)}finally{if(btn){btn.disabled=false;btn.textContent='⚡ PUSH'}}
};
const base=window.renderAdminDashboard;
if(typeof base==='function'&&!base.__publicFlowV2){const wrapped=async function(...args){const out=await base.apply(this,args);await refresh();const b=document.getElementById('adminPushBtn');if(b)b.title='Lance immédiatement les sources publiques, sans attendre le cron';return out};wrapped.__publicFlowV2=true;window.renderAdminDashboard=wrapped}
document.addEventListener('click',async e=>{
 const del=e.target?.closest?.('.adn-delete-flight');if(del){e.preventDefault();e.stopImmediatePropagation();const flight=del.dataset.deleteFlight||'ce vol';if(!confirm('SUPPRIMER '+flight+' DU PLANNING ?'))return;const r=await fetch('/api/admin/delete-flight',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identity:del.dataset.deleteId})});const j=await r.json();if(!j?.ok){alert('SUPPRESSION IMPOSSIBLE : '+(j?.error||r.status));return}await window.renderAdminDashboard?.(true);return}
 const row=e.target?.closest?.('#app .admin-native .adn-table tbody tr');if(row)try{sessionStorage.setItem('alyziaReturnView','admin')}catch{}
 const back=e.target?.closest?.('#app .flight-back-btn');if(back){let v='';try{v=sessionStorage.getItem('alyziaReturnView')||''}catch{}if(v==='admin'){e.preventDefault();e.stopImmediatePropagation();try{sessionStorage.removeItem('alyziaReturnView')}catch{}window.renderAdminDashboard?.(true);return}}
 if(e.target?.closest?.('#adminRefreshBtn,#adminPrev,#adminNext,#adminDateBtn,[data-terminal],.adn-status-active,.adn-mini span,[data-mobile-nav="admin"]'))setTimeout(refresh,100)
},true);
document.addEventListener('change',e=>{if(e.target?.id==='adminDateInput')setTimeout(refresh,80)},true);
window.addEventListener('adn:repaint',()=>setTimeout(refresh,40));
setTimeout(refresh,120);
})();</script>`;
function patchHtml(html){const s=String(html||"");if(s.includes('id="alyzia-admin-public-flow-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/public-flow"&&request.method==="GET")return json(await publicFlow(env));
    if(url.pathname==="/api/admin/push-now"&&request.method==="POST")return publicPush(env);
    if(url.pathname==="/api/admin/delete-flight"&&request.method==="POST")return deleteFlight(request,env);
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
