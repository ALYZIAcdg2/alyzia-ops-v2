import {fetchGatenavoRows,gatenavoPhase} from './gatenavo-probe.js';
const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);return m?`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`:''};
const today=()=>new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const manual=(x,field)=>upper(x?.[field+'Source']).includes('MANUAL')||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);
function textOnly(html){return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim()}
async function fetchBoard(){
  const urls=['https://www.parisaeroport.fr/fr/passagers/vols/tous-les-vols-depart','https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures'];
  for(const url of urls){const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{accept:'text/html,application/xhtml+xml','accept-language':'fr-FR,fr;q=0.9,en;q=0.7','user-agent':'Mozilla/5.0 (compatible; AlyziaOpsV2-ParisStatus/1.2)'}});if(r.ok){const text=textOnly(await r.text());if(text)return {text,url:r.url||url}}}catch{}finally{clearTimeout(t)}}return {text:'',url:''};
}
const PARIS_PAGE='https://www.parisaeroport.fr/fr/passagers/vols/tous-les-vols-depart';
// Liste complète des départs du jour : la page l'obtient par un appel interne (server action Next.js), le HTML initial est vide.
// Identifiants relevés sur la page publique ; surchargeables par PARIS_ACTION_ID / PARIS_ACTION_ARG si le site est redéployé.
const PARIS_ACTION_ID='7f2b5707695319793ef531cc73cda81f07a468044d';
const PARIS_ACTION_ARG='waErdTysKIkpSE7aKcP8+I7cEBLJaP63u+ScRCAxE9E2JC2UAseQ5LM3YMgI+1pKG0nP1eGKiEFB1d7xTx9nl44u9iw0SzrWKsyD3w+/5Pp95Icd88EgjQSNDr0jxRxOmCOWacNI8w9NQXsXQoslAy3A486OBzXCMs+efnF+RR0tJj3wNLkaeJsqFe+TCyaWG4xYoAGQCw==';
const TREE='%5B%22%22%2C%7B%22children%22%3A%5B%5B%22lang%22%2C%22fr%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%5B%22segments%22%2C%22passagers%2Fvols%2Ftous-les-vols-depart%22%2C%22oc%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D';
export function parseParisRows(body){const line=String(body||'').split('\n').find(l=>l.startsWith('1:['));if(!line)return [];try{const rows=JSON.parse(line.slice(2));return Array.isArray(rows)?rows:[]}catch{return []}}
// Désactivé par défaut : Paris Aéroport répond « Pardon Our Interruption » (protection anti-robot) aux appels hors navigateur.
// Pas de contournement ; réactivable avec PARIS_STRUCTURED=1 si le site lève un jour la protection.
async function fetchStructured(env){
  if(clean(env?.PARIS_STRUCTURED)!=='1')return {rows:[],error:'DISABLED_BOT_PROTECTION'};
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{const fd=new FormData();fd.append('1',JSON.stringify(clean(env?.PARIS_ACTION_ARG)||PARIS_ACTION_ARG));fd.append('0',JSON.stringify(['$@1','dep','$D'+new Date().toISOString(),'CDG-ORY','','','']));
    const r=await fetch(PARIS_PAGE,{method:'POST',body:fd,signal:c.signal,headers:{accept:'text/x-component','next-action':clean(env?.PARIS_ACTION_ID)||PARIS_ACTION_ID,'next-router-state-tree':TREE,origin:'https://www.parisaeroport.fr',referer:PARIS_PAGE,'accept-language':'fr-FR,fr;q=0.9'}});
    if(!r.ok)return {rows:[],error:'HTTP_'+r.status};const body=await r.text(),rows=parseParisRows(body);return {rows,error:rows.length?'':(/Pardon Our Interruption/i.test(body)?'BOT_PROTECTION':'NO_ROWS'),debug:rows.length?undefined:{status:r.status,type:r.headers.get('content-type')||'',length:body.length,head:body.slice(0,400),lines:body.split('\n').slice(0,6).map(l=>l.slice(0,60))}}}
  catch(e){return {rows:[],error:String(e?.name||e?.message||e)}}finally{clearTimeout(t)}
}
export function structuredIndex(rows,date){const idx=new Map();for(const r of rows){if(upper(r?.departureIataCode)!=='CDG'||clean(r.departureDate)!==date)continue;const arr=upper(r.arrivalIataCode);for(const n of [r.displayFlightNumber,...(r.codeShares||[]).map(c=>c.displayFlightNumber)]){const k=upper(n).replace(/\s+/g,'');if(k&&!idx.has(k+'|'+arr))idx.set(k+'|'+arr,r)}}return idx}
export function hitFromRow(r){const s=clean(r?.departureStatus);
  if(s==='boarding')return {phase:'EMBARQUEMENT',raw:clean(r.departureStatusLabel)};
  if(s==='boarding_closed')return {phase:'EMBARQUEMENT CLOS',raw:clean(r.departureStatusLabel)};
  if(s==='cancelled')return {phase:'ANNULÉ',raw:clean(r.departureStatusLabel)};
  if(s==='take_off')return {phase:'EN VOL',takeoff:hhmm(r.departureActualTime||r.departureStatusLabel),raw:clean(r.departureStatusLabel)};
  return {phase:'',raw:clean(r.departureStatusLabel)}}
function flightDesignator(row,x){return upper(x.flight||row.flight_number)}
function windowFor(text,row,x){const u=upper(text),designator=flightDesignator(row,x),airline=upper(x.airline||row.airline),raw=designator.startsWith(airline)?designator.slice(airline.length):designator,keys=[designator,airline&&raw?`${airline} ${raw}`:''].filter(Boolean),dest=upper(x.destination||x.dest||'');for(const k of keys){let from=0;for(;;){const i=u.indexOf(k,from);if(i<0)break;const w=text.slice(Math.max(0,i-1300),Math.min(text.length,i+3000));if(!dest||upper(w).includes(dest))return w;from=i+k.length}}return ''}
function parseStatus(text,row,x){const w=windowFor(text,row,x);if(!w)return null;const u=upper(w);let m;
  for(const re of [/(?:D[ÉE]COLL[ÉE](?:\s+À)?|D[ÉE]COLLAGE\s+(?:À|A)|TOOK\s+OFF\s+(?:AT)?)\s*(\d{1,2}\s*[:hH]\s*\d{2})/i,/(\d{1,2}\s*[:hH]\s*\d{2})\s*(?:D[ÉE]COLL[ÉE]|TOOK\s+OFF)/i]){m=w.match(re);if(m)return {phase:'EN VOL',takeoff:hhmm(m[1]),raw:m[0]}}
  for(const re of [/(?:POS[ÉE](?:\s+À)?|ATTERRI(?:\s+À)?|LANDED\s+(?:AT)?)\s*(\d{1,2}\s*[:hH]\s*\d{2})/i,/(\d{1,2}\s*[:hH]\s*\d{2})\s*(?:POS[ÉE]|ATTERRI|LANDED)/i]){m=w.match(re);if(m)return {phase:'ATTERRI',landing:hhmm(m[1]),raw:m[0]}}
  if(/EMBARQUEMENT\s+CLOS|BOARDING\s+CLOSED|GATE\s+CLOSED/.test(u))return {phase:'EMBARQUEMENT CLOS',raw:'Embarquement clos'};
  if(/EMBARQUEMENT\s+EN\s+COURS|BOARDING\s+IN\s+PROGRESS|\bBOARDING\b/.test(u))return {phase:'EMBARQUEMENT',raw:'Embarquement en cours'};
  if(/RETARD|DELAY|LATE/.test(u))return {phase:'RETARDÉ',raw:'Retard confirmé'};
  return null}
function setField(x,field,value,source,at){if(!value||manual(x,field))return false;const before=clean(x[field]);if(before===value&&upper(x[field+'Source'])===source)return false;(x.flightInfoLog??=[]).unshift({at,source,field,from:before,to:value});x[field]=value;x[field+'Source']=source;x[field+'UpdatedAt']=at;return true}
export async function runParisAirportStatusFlow(env){if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};const date=today(),st=await fetchStructured(env),idx=st.rows.length?structuredIndex(st.rows,date):null,gn=idx?null:await fetchGatenavoRows(),gnIdx=gn?.rows?.length?new Map(gn.rows.filter(r=>!r.fetchedAt||Date.now()-Date.parse(r.fetchedAt)<20*60000).map(r=>[upper(r.flight).replace(/\s+/g,''),r])):null,board=idx?{text:'x',url:PARIS_PAGE}:gnIdx?.size?{text:'x',url:'https://gatenavo.com/en/airports/paris-cdg/departures'}:await fetchBoard();if(!board.text)return {ok:true,date,checked:0,updated:0,source:'PARIS_AEROPORT',status:'NO_DATA'};const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();let updated=0,matched=0;const at=new Date().toISOString(),items=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}if(upper(x.parisAeroportPhaseSource)==='MANUAL')continue;let hit;if(idx){const d=upper(x.flight||row.flight_number).replace(/\s+/g,''),r=idx.get(d+'|'+upper(x.destination||x.dest||''))||(!clean(x.destination||x.dest)?[...idx.entries()].find(([k])=>k.startsWith(d+'|'))?.[1]:null);if(!r)continue;hit=hitFromRow(r);if(!hit.phase&&!/^EMBARQUEMENT/.test(clean(x.parisAeroportPhase)))continue}else if(gnIdx?.size){const g=gnIdx.get(upper(x.flight||row.flight_number).replace(/\s+/g,''));if(!g||new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.scheduled))!==date)continue;hit={phase:gatenavoPhase(g.status),raw:clean(g.raw),via:'GATENAVO'};if(!hit.phase&&!/^EMBARQUEMENT/.test(clean(x.parisAeroportPhase)))continue}else{hit=parseStatus(board.text,row,x)}if(!hit)continue;matched++;let changed=false;if(hit.takeoff&&setField(x,'takeoff',hit.takeoff,'PARIS_AEROPORT',at))changed=true;if(hit.landing&&setField(x,'landing',hit.landing,'PARIS_AEROPORT',at))changed=true;
    if(clean(x.parisAeroportPhase)!==hit.phase){if(hit.phase)(x.flightInfoLog??=[]).unshift({at,source:hit.via==='GATENAVO'?'GATENAVO':'PARIS_AEROPORT',field:'boarding',from:clean(x.parisAeroportPhase),to:hit.phase});x.parisAeroportPhase=hit.phase;x.parisAeroportPhaseSource='PARIS_AEROPORT';x.parisAeroportPhaseUpdatedAt=at;changed=true}
    if(hit.via&&clean(x.parisAeroportVia)!==hit.via){x.parisAeroportVia=hit.via;changed=true}
    if(clean(x.parisAeroportStatusRaw)!==hit.raw){x.parisAeroportStatusRaw=hit.raw;changed=true}
    x.parisAeroportStatusCheckedAt=at;if(Array.isArray(x.flightInfoLog))x.flightInfoLog=x.flightInfoLog.slice(0,240);if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}items.push({flight:flightDesignator(row,x),phase:hit.phase,takeoff:hit.takeoff||'',landing:hit.landing||'',changed})}
  return {ok:true,date,source:'PARIS_AEROPORT',mode:idx?'STRUCTURED':gnIdx?.size?'GATENAVO':'HTML',gatenavoError:gn?.error||'',gatenavoRows:gn?.rows?.length||0,structuredError:st.error||'',structuredRows:st.rows.length,boardUrl:board.url,checked:results.length,matched,updated,items}}

// Lecture seule : l'appel structuré répond-il, combien de nos vols du jour sont retrouvés, et quels statuts ressortent.
export async function probeParisAirport(env){const date=today(),st=await fetchStructured(env),out={ok:true,mode:'PARIS_AEROPORT_PROBE_NO_WRITE',date,structuredRows:st.rows.length,structuredError:st.error||'',structuredDebug:st.debug,actionIdOverride:Boolean(clean(env?.PARIS_ACTION_ID))};if(!st.rows.length)return out;
  const idx=structuredIndex(st.rows,date),byStatus={};for(const r of st.rows)if(upper(r?.departureIataCode)==='CDG'&&clean(r.departureDate)===date)byStatus[clean(r.departureStatus)]=(byStatus[clean(r.departureStatus)]||0)+1;out.cdgByStatus=byStatus;
  if(!env?.OPS_DB)return out;const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();let matched=0;const missing=[],phases=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}const d=upper(x.flight||row.flight_number).replace(/\s+/g,''),r=idx.get(d+'|'+upper(x.destination||x.dest||''));if(!r){if(missing.length<15)missing.push(d);continue}matched++;const h=hitFromRow(r);if(h.phase&&phases.length<30)phases.push({flight:d,site:clean(r.departureStatus),label:h.raw,ours:clean(x.parisAeroportPhase),status:clean(x.status)})}
  return {...out,ourFlights:results.length,matched,notFound:results.length-matched,notFoundSample:missing,phases}}
