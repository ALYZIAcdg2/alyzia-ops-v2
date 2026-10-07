// Lecture seule : état de FlightStats (disjoncteurs enregistrés, lectures du jour par vol, valeurs apportées). Rien n'est écrit, aucun appel FlightStats.
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const parisMin=ms=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)};
const mins=v=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(v||""));return m?Number(m[1])*60+Number(m[2]):null};
const hm=ms=>new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit"}).format(new Date(ms));

export function summarizeFlightStats(rows,{nowMs=Date.now(),date}={}){
  const out={flights:0,idKnown:0,readThisHour:0,neverRead:0,lastStatus:{},refusedFlag:0,atdFromFS:0,ataFromFS:0,etaFromFS:0,inWindowNotRead:[],lastAt:null};
  const nowMin=parisMin(nowMs);let last=0;
  for(const x of rows){
    out.flights++;
    if(/^\d+$/.test(String(x.flightStatsId||"")))out.idKnown++;
    if(x.flightStatsRefusedAt)out.refusedFlag++;
    if(/FLIGHTSTATS/i.test(x.atdSource||""))out.atdFromFS++;
    if(/FLIGHTSTATS/i.test(x.ataSource||""))out.ataFromFS++;
    if(/FLIGHTSTATS/i.test(x.etaSource||""))out.etaFromFS++;
    const att=(x.publicLiveBackfill?.attempts||[]).filter(a=>a.source==="FLIGHTSTATS"),a=att[att.length-1];
    if(!a){out.neverRead++;const s=mins(x.std);if(s!==null&&s-nowMin<=90&&s-nowMin>=-240&&!x.atd&&out.inWindowNotRead.length<15)out.inWindowNotRead.push(x.flight+" "+x.std);continue}
    const k=a.status+(a.httpStatus?" "+a.httpStatus:"");out.lastStatus[k]=(out.lastStatus[k]||0)+1;
    const t=Date.parse(a.checkedAt||"");if(Number.isFinite(t)){if(t>last)last=t;if(nowMs-t<=3600000)out.readThisHour++}
  }
  out.lastAt=last?new Date(last).toISOString():null;out.lastAtParis=last?hm(last):null;
  return out;
}

export async function flightStatsStatus(env,{nowMs=Date.now(),date=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=date||parisDate(nowMs);
  let saved=null;
  try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='runtime_state_v1'`).first();if(r?.v){const st=JSON.parse(r.v);saved={savedAt:st.at?new Date(st.at).toISOString():null,breakers:st.fs||null}}}catch{}
  if(saved?.breakers&&typeof saved.breakers==="object"){const b=saved.breakers;for(const k of Object.keys(b)){const v=b[k];if(v&&typeof v==="object"&&Number(v.until)>0)v.pausedUntilParis=Number(v.until)>nowMs?hm(Number(v.until)):"terminée"}}
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{try{return JSON.parse(r.data_json||"{}")}catch{return {}}});
  return {ok:true,mode:"FLIGHTSTATS_STATUS_NO_WRITE",nowParis:hm(nowMs),date:day,saved,today:summarizeFlightStats(rows,{nowMs,date:day})};
}
