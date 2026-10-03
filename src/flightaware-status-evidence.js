import {withIcaoFallback,publicPageStatus} from "./public-flight-alias.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

function decode(raw){
  return String(raw||"")
    .replace(/\\u0026/gi,"&")
    .replace(/\\u002F/gi,"/")
    .replace(/\\u003A/gi,":")
    .replace(/\\u003C/gi,"<")
    .replace(/\\u003E/gi,">")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&#39;/g,"'")
    .replace(/&quot;/gi,'"');
}

function textOnly(html){
  return decode(html)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function routeOk(text,f){
  const u=upper(text);
  return (!f.origin||u.includes(f.origin))&&(!f.destination||u.includes(f.destination));
}

function normalize(row,x){
  const airline=upper(x.airline||row.airline);
  const designator=upper(x.flight||row.flight_number);
  const number=designator.startsWith(airline)
    ? designator.slice(airline.length)
    : String(row.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
  return {
    date:row.flight_date,
    airline,
    number,
    designator,
    origin:upper(x.origin||"CDG"),
    destination:upper(x.destination||x.dest||"")
  };
}

function evidenceWindow(raw,candidate){
  const s=decode(raw),u=upper(s),keys=[upper(candidate.designator),`${upper(candidate.airline)}${upper(candidate.number)}`,`${upper(candidate.airline)} ${upper(candidate.number)}`].filter(Boolean);
  for(const key of keys){
    const i=u.indexOf(key);
    if(i>=0)return s.slice(Math.max(0,i-12000),Math.min(s.length,i+24000));
  }
  return s.slice(0,50000);
}

function phase(text){
  const s=upper(text).replace(/[{}\[\]",:_-]+/g," ").replace(/\s+/g," ");
  if(/\bARRIVED AT GATE\b|\bGATE ARRIVAL\b|\bARRIVED\b|\bCOMPLETED\b/.test(s))return "ARRIVED";
  if(/\bLANDED\b|\bTOUCHDOWN\b|\bWHEELS DOWN\b/.test(s))return "LANDED";
  if(/\bIN AIR\b|\bAIRBORNE\b|\bIN FLIGHT\b|\bEN ROUTE\b|\bEN VOL\b|\bTOOK OFF\b|\bWHEELS UP\b/.test(s))return "AIRBORNE";
  if(/\bDEPARTED\b|\bGATE OUT\b|\bLEFT GATE\b/.test(s))return "DEPARTED";
  return "";
}

async function fetchEvidence(f){
  const build=c=>`https://www.flightaware.com/live/flight/${encodeURIComponent(c.designator)}`;
  return withIcaoFallback(f,build,async candidate=>{
    const url=build(candidate);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7000);
    try{
      const response=await fetch(url,{
        redirect:"follow",
        signal:controller.signal,
        headers:{
          accept:"text/html,application/xhtml+xml",
          "accept-language":"en-US,en;q=0.9,fr;q=0.7",
          "user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-StatusEvidence/1.2)"
        }
      });
      const raw=await response.text();
      const visible=textOnly(raw);
      const window=evidenceWindow(raw,candidate);
      const searchable=`${visible} ${window}`;
      const rawUpper=upper(raw);
      const mentions=rawUpper.includes(upper(candidate.designator))||rawUpper.includes(`${upper(candidate.airline)} ${upper(candidate.number)}`)||rawUpper.includes(`${upper(candidate.airline)}${upper(candidate.number)}`);
      const detectedPhase=phase(searchable);
      const routeMatched=routeOk(raw,candidate)||routeOk(searchable,candidate);
      let status=publicPageStatus("FLIGHTAWARE",searchable,response.status,mentions,routeMatched||Boolean(detectedPhase));
      if(response.ok&&mentions&&detectedPhase)status="OK";
      return {
        status,
        phase:status==="OK"?detectedPhase:"",
        url:response.url||url,
        httpStatus:response.status
      };
    }catch(error){
      return {
        status:error?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",
        phase:"",
        url,
        httpStatus:0
      };
    }finally{
      clearTimeout(timer);
    }
  });
}

async function processCandidate(env,item,index,items){
  const {row,x}=item;
  const f=normalize(row,x);
  const hit=await fetchEvidence(f);
  const at=new Date().toISOString();

  const currentRow=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(row.identity).first();
  if(!currentRow){
    items[index]={flight:f.designator,status:"DISAPPEARED",phase:hit.phase||""};
    return 0;
  }

  let current={};
  try{current=JSON.parse(currentRow.data_json||"{}")}catch{}
  const ev={...(current.statusModelEvidence||{})};
  const before=JSON.stringify(ev);

  ev.flightAwareCheckedAt=at;
  ev.flightAwareFetchStatus=hit.status||"";
  ev.flightAwareUrl=hit.url||"";
  if(hit.phase){
    ev.flightAwarePhase=hit.phase;
    if(hit.phase==="AIRBORNE")ev.airborneSource="FLIGHTAWARE";
    if(hit.phase==="LANDED")ev.landingSource="FLIGHTAWARE";
    if(hit.phase==="ARRIVED")ev.arrivalSource="FLIGHTAWARE";
  }

  current.statusModelEvidence=ev;
  const changed=JSON.stringify(ev)!==before;
  if(changed){
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  }
  items[index]={flight:f.designator,status:hit.status,phase:hit.phase||"",changed};
  return changed?1:0;
}

export async function runFlightAwareStatusEvidence(env,{limit=36,concurrency=4}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=today();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();

  const candidates=[];
  for(const row of results){
    let x={};
    try{x=JSON.parse(row.data_json||"{}")}catch{}
    if(clean(x.ata))continue;
    if(!clean(x.atd)&&!clean(x.takeoff))continue;
    candidates.push({row,x});
  }

  const chosen=candidates.slice(0,Math.max(1,Math.min(60,Number(limit)||36)));
  const items=[];
  let nextIndex=0;
  let updated=0;
  const workerCount=Math.min(Math.max(1,Number(concurrency)||4),chosen.length||1);

  async function worker(){
    for(;;){
      const index=nextIndex++;
      if(index>=chosen.length)return;
      updated+=await processCandidate(env,chosen[index],index,items);
    }
  }

  await Promise.all(Array.from({length:workerCount},()=>worker()));
  return {ok:true,date,checked:chosen.length,updated,source:"FLIGHTAWARE",items:items.filter(Boolean)};
}
