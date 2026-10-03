const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2})[:hH](\d{2})/);return m?`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`:''};
const today=()=>new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const manual=(x,field)=>upper(x?.[field+'Source']).includes('MANUAL')||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);

function textOnly(html){return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim()}
async function fetchBoard(){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch('https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures',{redirect:'follow',signal:c.signal,headers:{accept:'text/html,application/xhtml+xml','accept-language':'fr-FR,fr;q=0.9,en;q=0.7','user-agent':'Mozilla/5.0 (compatible; AlyziaOpsV2-ParisStatus/1.0)'}});
    return r.ok?textOnly(await r.text()):'';
  }catch{return ''}finally{clearTimeout(t)}
}
function flightDesignator(row,x){return upper(x.flight||row.flight_number)}
function windowFor(text,row,x){
  const u=upper(text),designator=flightDesignator(row,x),airline=upper(x.airline||row.airline),raw=designator.startsWith(airline)?designator.slice(airline.length):designator;
  const keys=[designator,airline&&raw?`${airline} ${raw}`:''].filter(Boolean);let i=-1;
  for(const k of keys){i=u.indexOf(k);if(i>=0)break}if(i<0)return '';
  const w=text.slice(Math.max(0,i-1800),Math.min(text.length,i+3600));
  const dest=upper(x.destination||x.dest||'');if(dest&&!upper(w).includes(dest))return '';
  return w;
}
function parseStatus(text,row,x){
  const w=windowFor(text,row,x);if(!w)return null;const u=upper(w);
  let m=w.match(/(?:D[ÉE]COLL[ÉE]|D[ÉE]COLLAGE|TOOK\s+OFF)\s*(?:À|A|AT)?\s*(\d{1,2}[:Hh]\d{2})/i);
  if(m)return {status:'EN VOL',takeoff:hhmm(m[1]),raw:m[0]};
  m=w.match(/(?:POS[ÉE]|ATTERRI|LANDED)\s*(?:À|A|AT)?\s*(\d{1,2}[:Hh]\d{2})/i);
  if(m)return {status:'ATTERI',landing:hhmm(m[1]),raw:m[0]};
  if(/EMBARQUEMENT\s+CLOS|BOARDING\s+CLOSED|GATE\s+CLOSED/.test(u))return {status:'EMBARQUEMENT CLOS',raw:'Embarquement clos'};
  if(/EMBARQUEMENT\s+EN\s+COURS|BOARDING\s+IN\s+PROGRESS|BOARDING/.test(u))return {status:'EMBARQUEMENT',raw:'Embarquement en cours'};
  return null;
}
function setField(x,field,value,source,at){if(!value||manual(x,field))return false;const before=clean(x[field]);if(before===value&&upper(x[field+'Source'])===source)return false;(x.flightInfoLog??=[]).unshift({at,source,field,from:before,to:value});x[field]=value;x[field+'Source']=source;x[field+'UpdatedAt']=at;return true}

export async function runParisAirportStatusFlow(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=today(),board=await fetchBoard();if(!board)return {ok:true,date,checked:0,updated:0,source:'PARIS_AEROPORT',status:'NO_DATA'};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  let updated=0,matched=0;const at=new Date().toISOString(),items=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}const hit=parseStatus(board,row,x);if(!hit)continue;matched++;let changed=false;
    if(hit.takeoff&&setField(x,'takeoff',hit.takeoff,'PARIS_AEROPORT',at))changed=true;
    if(hit.landing&&setField(x,'landing',hit.landing,'PARIS_AEROPORT',at))changed=true;
    if(!manual(x,'status')&&clean(x.status)!==hit.status){const before=clean(x.status);(x.flightInfoLog??=[]).unshift({at,source:'PARIS_AEROPORT',field:'status',from:before,to:hit.status});x.status=hit.status;x.statusSource='PARIS_AEROPORT';x.statusUpdatedAt=at;changed=true}
    x.providerStatusRaw=hit.raw;x.providerStatusRawSource='PARIS_AEROPORT';x.parisAeroportStatusCheckedAt=at;if(Array.isArray(x.flightInfoLog))x.flightInfoLog=x.flightInfoLog.slice(0,240);
    if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}
    items.push({flight:flightDesignator(row,x),status:hit.status,takeoff:hit.takeoff||'',landing:hit.landing||'',changed});
  }
  return {ok:true,date,source:'PARIS_AEROPORT',checked:results.length,matched,updated,items};
}
