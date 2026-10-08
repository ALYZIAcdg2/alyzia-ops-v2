// Fin des pauses automatiques par source (lecture seule). Les pauses vivent dans la mémoire du Worker et sont recopiées en base à chaque passage (runtime_state_v1) :
// FlightStats (page / API), FlightAware (général) et tableau FR24. Les pages FlightAware lues vol par vol ont en plus 45 min de pause après un 429.
const KEY="runtime_state_v1",FA_PAGE_PAUSE_MS=45*60000;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const FS_FLIGHT_RETRY_MS=20*60000;
export function buildPauses(state,faAttempts,now=Date.now(),fsRefusedAt=[]){
  const st=state||{},list=[];
  const add=(key,label,untilMs,note)=>{if(untilMs>now)list.push({key,label,until:new Date(untilMs).toISOString(),minutes:Math.ceil((untilMs-now)/60000),note})};
  // FlightStats : pause générale (disjoncteur) et attente de 20 min par vol refusé. On affiche la fin la plus tardive, et la plage des reprises par vol.
  {const gen=Math.max(num(st.fs?.page?.until),num(st.fs?.api?.until)),ends=(fsRefusedAt||[]).map(t=>t+FS_FLIGHT_RETRY_MS).filter(t=>t>now).sort((a,b)=>a-b);
   const end=Math.max(gen,ends.length?ends[ends.length-1]:0);
   if(end>now){const first=Math.min(...[gen>now?gen:Infinity,...(ends.length?[ends[0]]:[])]);
     list.push({key:"FLIGHTSTATS",label:"FlightStats",until:new Date(end).toISOString(),minutes:Math.ceil((end-now)/60000),from:Number.isFinite(first)?new Date(first).toISOString():"",waiting:ends.length,general:gen>now,note:(gen>now?"pause générale jusqu'à la fin indiquée":"")+(ends.length?(gen>now?" · ":"")+ends.length+" vol(s) refusé(s) attendent 20 min avant une nouvelle lecture":"")})}}
  add("FR24BOARD","FR24 tableau CDG",num(st.board?.pausedUntil),"pause 10 min après un refus");
  let fa=num(st.fa?.until),note="pause 45 min après un 429";
  for(const a of faAttempts||[]){const t=Date.parse(a?.checkedAt||0);if(Number(a?.httpStatus)===429&&Number.isFinite(t))fa=Math.max(fa,t+FA_PAGE_PAUSE_MS)}
  add("FLIGHTAWARE","FlightAware",fa,note);
  return list;
}
export async function readPauses(env,now=Date.now()){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  let state=null,faAttempts=[];const fsRefusedAt=[];
  try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(KEY).first();if(r?.v)state=JSON.parse(r.v)}catch{}
  try{const day=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
    const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
    for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const fr=Date.parse(x.flightStatsRefusedAt||0);if(Number.isFinite(fr)&&fr>0)fsRefusedAt.push(fr);const a=Array.isArray(x.flightAwareExactHistory?.attempts)?x.flightAwareExactHistory.attempts[0]:null;if(a&&Number(a.httpStatus)===429)faAttempts.push({httpStatus:429,checkedAt:a.checkedAt||x.flightAwareExactHistory.checkedAt})}}catch{}
  return {ok:true,now:new Date(now).toISOString(),stateAt:state?.at?new Date(state.at).toISOString():"",pauses:buildPauses(state,faAttempts,now,fsRefusedAt)};
}
