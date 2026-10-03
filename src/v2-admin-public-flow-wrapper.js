import app from "./v2-admin-public-sources-wrapper.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

const PUBLIC_SOURCE_LABELS=[
  ["FLIGHTSTATS","FlightStats"],["FLIGHTAWARE","FlightAware"],["FR24","Flightradar24"],["FLIGHTRADAR24","Flightradar24"],
  ["PLANEFINDER","PlaneFinder"],["SKYSCANNER","Skyscanner"],["FLIGHTVIEW","FlightView"],["WEGO","Wego"],
  ["IXIGO","Ixigo"],["KAYAK","Kayak"],["FLIGHTY","Flighty"],["PARIS_AEROPORT","Paris Aéroport"],
  ["SIMPLEFLYING","SimpleFlying"],["FLIGHTRADARS24","Flightradars24.fr"],["FLIGHTERA","Flightera"]
];
function publicLabel(source){
  const s=upper(source);if(!s)return "";
  for(const [key,label] of PUBLIC_SOURCE_LABELS)if(s.includes(key))return label;
  return "";
}
function flightNumber(airline,flight){
  const a=upper(airline),f=upper(flight);if(f.startsWith(a))return f.slice(a.length);return f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
}
function latestPublicSource(x){
  const direct=[x.staSource,x.etdSource,x.atdSource,x.takeoffSource,x.etaSource,x.landingSource,x.ataSource,x.gateSource,x.regSource,x.registrationSource,x.aircraftActualSource,x.typeSource,x?.staBackfill?.source];
  for(const v of direct){const label=publicLabel(v);if(label)return label}
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
  for(const e of log){const label=publicLabel(e?.source);if(label)return label}
  return "";
}
function cronPlan(x){
  const sta=clean(x.sta);
  if(sta&&sta!=="—")return {next:"AUCUN · STA OK",chain:[]};
  return {next:"FlightStats",chain:["FlightStats","FlightAware","Flightradar24 exact","Flightera"]};
}
async function publicFlow(env){
  const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+2);const until=d.toISOString().slice(0,10);
  const p=new Date(`${today}T12:00:00Z`);p.setUTCDate(p.getUTCDate()-1);const since=p.toISOString().slice(0,10);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_date,airline,flight_number,data_json FROM flights WHERE flight_date>=? AND flight_date<=? AND airline<>'SYS' ORDER BY flight_date,flight_number`).bind(since,until).all();
  const flights=[];
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const airline=upper(x.airline||row.airline),number=flightNumber(airline,x.flight||row.flight_number),flight=upper(x.flight||`${airline}${number}`);
    const source=latestPublicSource(x)||"DONNÉE EXISTANTE / IMPORT";
    const plan=cronPlan(x);
    flights.push({date:row.flight_date,flight,source,nextSource:plan.next,nextChain:plan.chain,sta:clean(x.sta)});
  }
  return {ok:true,generatedAt:new Date().toISOString(),since,until,flights};
}

const UI=String.raw`<style id="alyzia-admin-public-flow-css">
#app .admin-native .adn-table.adn-public-flow-table{min-width:1220px!important}
#app .admin-native .adn-source-fed,#app .admin-native .adn-source-next{font-size:10px;font-weight:900;white-space:normal;min-width:125px;line-height:1.25}
#app .admin-native .adn-source-fed{color:#087443}#app .admin-native .adn-source-next{color:#0a6abf}
#app .admin-native .adn-source-chain{display:block;margin-top:2px;color:#73869b;font-size:8px;font-weight:800}
</style><script id="alyzia-admin-public-flow-js">(()=>{'use strict';
if(window.__alyziaAdminPublicFlow)return;window.__alyziaAdminPublicFlow=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let flow=null;
async function load(){try{const r=await fetch('/api/admin/public-flow',{cache:'no-store'});const d=await r.json();if(r.ok&&d?.ok)flow=d}catch{}return flow}
function removeProviderObservability(){
 const root=document.querySelector('#app .admin-native');if(!root)return;
 [...root.querySelectorAll('h1,h2,h3,h4')].forEach(h=>{
   const t=String(h.textContent||'').toUpperCase();
   if(/PROVIDER\s*OBSERVABILITY|OBSERVABILIT[ÉE].*PROVIDER|PROVIDER.*OBSERVABILIT[ÉE]/.test(t)){
     const block=h.closest('.adn-section,.adn-card,section,.provider-observability')||h.parentElement;block?.remove();
   }
 });
}
function selectedDate(){return document.getElementById('adminDateInput')?.value||''}
function findFlow(flight){const date=selectedDate();const f=String(flight||'').trim().toUpperCase();return (flow?.flights||[]).find(x=>x.date===date&&String(x.flight||'').toUpperCase()===f)||null}
function patchTable(){
 const root=document.querySelector('#app .admin-native');if(!root||!flow)return;
 const section=[...root.querySelectorAll('.adn-section')].find(s=>/VOLS TRAIT[ÉE]S|À SURVEILLER|TRAITEMENT DES VOLS/i.test(s.querySelector('h3')?.textContent||'')&&s.querySelector('.adn-table'))||[...root.querySelectorAll('.adn-section')].find(s=>{const th=[...s.querySelectorAll('.adn-table th')].map(x=>String(x.textContent||'').trim().toUpperCase());return th.includes('VOL')&&th.includes('STA')});
 const table=section?.querySelector('.adn-table');if(!table)return;table.classList.add('adn-public-flow-table');
 const head=table.querySelector('thead tr');if(head&&!head.querySelector('[data-public-flow-head]')){
   const h1=document.createElement('th');h1.dataset.publicFlowHead='fed';h1.textContent='SOURCE ALIMENTÉE';
   const h2=document.createElement('th');h2.dataset.publicFlowHead='next';h2.textContent='PROCHAIN CRON';head.append(h1,h2);
 }
 [...table.querySelectorAll('tbody tr')].forEach(tr=>{
   const cells=[...tr.children];if(!cells.length)return;
   const flight=String(cells[1]?.textContent||'').trim().toUpperCase();const f=findFlow(flight);
   let fed=tr.querySelector('.adn-source-fed'),next=tr.querySelector('.adn-source-next');
   if(!fed){fed=document.createElement('td');fed.className='adn-source-fed';tr.appendChild(fed)}
   if(!next){next=document.createElement('td');next.className='adn-source-next';tr.appendChild(next)}
   fed.textContent=f?.source||'—';
   if(f){const chain=(f.nextChain||[]).join(' → ');next.innerHTML=esc(f.nextSource||'—')+(chain?'<span class="adn-source-chain">'+esc(chain)+'</span>':'')}else next.textContent='—';
 });
}
async function refresh(){removeProviderObservability();await load();removeProviderObservability();patchTable()}
const base=window.renderAdminDashboard;
if(typeof base==='function'&&!base.__publicFlow){const wrapped=async function(...args){const out=await base.apply(this,args);await refresh();return out};wrapped.__publicFlow=true;window.renderAdminDashboard=wrapped}
window.addEventListener('adn:repaint',()=>setTimeout(refresh,40));
document.addEventListener('click',e=>{if(e.target?.closest?.('#adminRefreshBtn,#adminPrev,#adminNext,#adminDateBtn,[data-terminal],.adn-status-active,.adn-mini span,[data-mobile-nav="admin"]'))setTimeout(refresh,100)},true);
document.addEventListener('change',e=>{if(e.target?.id==='adminDateInput')setTimeout(refresh,80)},true);
setTimeout(refresh,80);
})();</script>`;
function patchHtml(html){const s=String(html||"");if(s.includes('id="alyzia-admin-public-flow-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/public-flow"&&request.method==="GET")return json(await publicFlow(env));
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
