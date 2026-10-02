const EXACT_OCCURRENCES={
  "CTM21|2026-10-01":"41ea23a2"
};

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const uniq=(values,max=32)=>[...new Set(values.filter(Boolean))].slice(0,max);

export function fr24OccurrenceId(flight){
  return EXACT_OCCURRENCES[`${upper(flight?.designator)}|${clean(flight?.date)}`]||clean(flight?.raw?.fr24OccurrenceId||flight?.raw?.fr24_occurrence_id);
}

export function fr24PublicUrls(flight){
  const designator=upper(flight?.designator);
  const id=fr24OccurrenceId(flight);
  const urls=[];
  if(id&&designator)urls.push(`https://www.flightradar24.com/${encodeURIComponent(designator)}/${encodeURIComponent(id)}`);
  if(designator)urls.push(`https://www.flightradar24.com/data/flights/${encodeURIComponent(designator.toLowerCase())}`);
  return {id,urls};
}

function textOnly(html){
  return String(html||"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"')
    .replace(/\\u002F/g,"/").replace(/\\u003A/g,":").replace(/\\u002D/g,"-")
    .replace(/\s+/g," ").trim();
}

function deescape(raw){
  return String(raw||"")
    .replace(/\\\"/g,'"')
    .replace(/\\u002F/g,"/").replace(/\\u003A/g,":").replace(/\\u002D/g,"-")
    .replace(/\\n/g," ").replace(/\\t/g," ");
}

function occurrenceWindow(source,flight,id){
  const s=String(source||"");
  const keys=[id,flight?.designator,`${flight?.airline}${flight?.number}`].filter(Boolean).map(upper);
  let idx=-1;
  for(const key of keys){idx=upper(s).indexOf(key);if(idx>=0)break}
  if(idx<0)return "";
  return s.slice(Math.max(0,idx-12000),Math.min(s.length,idx+26000));
}

function extract(raw,flight,id){
  const source=deescape(raw);
  const scoped=occurrenceWindow(source,flight,id);
  const text=textOnly(scoped);
  const combined=`${text} ${scoped}`;
  const times=uniq([...combined.matchAll(/\b(?:[01]?\d|2[0-3])[:h][0-5]\d\b/g)].map(m=>m[0].replace("h",":")),40);
  const registrations=uniq([
    ...combined.matchAll(/\b(?:F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|JA\d{3,4}[A-Z]|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z]{3,5})\b/g)
  ].map(m=>upper(m[0])).filter(v=>!/(?:AUTO|FULL|GRAY|BLACK|GREEN|ICON|DATE|TIME|FIT|RES)$/.test(v)),12);
  const aircraft=uniq([...combined.matchAll(/\b(?:A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A400M|A400|A380|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|C130|C30J|F900|F2TH|F3TH|GLF5|GLF6|32Q|77W|788|789|359|333|332|320|321)\b/g)].map(m=>upper(m[0])),12);
  const terminals=uniq([...combined.matchAll(/(?:\"terminal\"\s*:\s*\"?|\bterminal\s+)([0-9][A-Z]?|[A-Z][0-9])\b/gi)].map(m=>upper(m[1])),8);
  const gates=uniq([...combined.matchAll(/(?:\"gate\"\s*:\s*\"?|\bgate\s+)([A-Z]?\d{1,3}[A-Z]?)\b/gi)].map(m=>upper(m[1])),8);
  const statuses=uniq([...combined.matchAll(/\b(?:scheduled|on time|delayed|departed|arrived|landed|cancelled|canceled|airborne)\b/gi)].map(m=>upper(m[0])),10);
  const occurrenceMatched=Boolean(id&&upper(source).includes(upper(id)));
  const marker=upper(flight.designator);
  const flightMatched=upper(scoped).includes(marker)||upper(scoped).includes(`${upper(flight.airline)} ${upper(flight.number)}`);
  const useful=times.length+registrations.length+aircraft.length+terminals.length+gates.length;
  return {times,registrations,aircraft,terminals,gates,statuses,excerpt:text.slice(0,3200),fr24OccurrenceId:id||"",occurrenceMatched,flightMatched,useful};
}

const nested=(obj,path)=>path.reduce((v,k)=>v!=null?v[k]:null,obj);
const epoch=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const iso=v=>{const n=epoch(v);return n?new Date(n*1000).toISOString():null};

function playbackFlight(json){
  const data=nested(json,["result","response","data"]);
  if(data?.flight&&typeof data.flight==="object")return data.flight;
  if(Array.isArray(data))return data[0]||null;
  return null;
}

function inferTakeoffFromTrack(track){
  if(!Array.isArray(track)||track.length<2)return null;
  const rows=track.filter(p=>epoch(p?.timestamp)).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
  let sawGround=false;
  for(const p of rows){
    const alt=Number(nested(p,["altitude","feet"]));
    const speed=Number(nested(p,["speed","kts"]));
    if(Number.isFinite(alt)&&alt<=50){sawGround=true;continue}
    if(sawGround&&Number.isFinite(alt)&&alt>=200&&Number.isFinite(speed)&&speed>=80)return epoch(p.timestamp);
  }
  return null;
}

function inferLandingFromTrack(track){
  if(!Array.isArray(track)||track.length<2)return null;
  const rows=track.filter(p=>epoch(p?.timestamp)).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
  let airborne=false;
  for(const p of rows){
    const alt=Number(nested(p,["altitude","feet"]));
    const speed=Number(nested(p,["speed","kts"]));
    if(Number.isFinite(alt)&&alt>=200&&Number.isFinite(speed)&&speed>=80){airborne=true;continue}
    if(airborne&&Number.isFinite(alt)&&alt<=50&&Number.isFinite(speed)&&speed<=80)return epoch(p.timestamp);
  }
  return null;
}

function playbackCandidates(data,flight,id){
  const f=playbackFlight(data);
  if(!f)return null;
  const number=upper(nested(f,["identification","number","default"])||nested(f,["identification","callsign"]));
  const requested=upper(flight.designator);
  const identificationMatched=!number||number===requested||number.replace(/\s+/g,"")===requested;
  const scheduledDeparture=epoch(nested(f,["time","scheduled","departure"]));
  const estimatedDeparture=epoch(nested(f,["time","estimated","departure"]));
  const realDeparture=epoch(nested(f,["time","real","departure"]));
  const scheduledArrival=epoch(nested(f,["time","scheduled","arrival"]));
  const estimatedArrival=epoch(nested(f,["time","estimated","arrival"]));
  const realArrival=epoch(nested(f,["time","real","arrival"]));
  const track=nested(f,["track"]);
  const takeoff=realDeparture||inferTakeoffFromTrack(track);
  const status=clean(nested(f,["status","generic","status","text"])||nested(f,["status","text"]));
  const statusEvent=epoch(nested(f,["status","generic","eventTime","utc"]));
  const landing=realArrival||(/^landed$/i.test(status)&&statusEvent)||inferLandingFromTrack(track);
  const registration=upper(nested(f,["aircraft","identification","registration"])||nested(f,["aircraft","registration"]));
  const aircraft=upper(nested(f,["aircraft","model","code"]));
  const origin=upper(nested(f,["airport","origin","code","iata"])||nested(f,["airport","origin","code","icao"]));
  const destination=upper(nested(f,["airport","destination","code","iata"])||nested(f,["airport","destination","code","icao"]));
  const terminalOrigin=upper(nested(f,["airport","origin","info","terminal"]));
  const terminalDestination=upper(nested(f,["airport","destination","info","terminal"]));
  const gateOrigin=upper(nested(f,["airport","origin","info","gate"]));
  const gateDestination=upper(nested(f,["airport","destination","info","gate"]));
  const semantic={
    std:iso(scheduledDeparture),
    etd:iso(estimatedDeparture),
    takeoff:iso(takeoff),
    sta:iso(scheduledArrival),
    eta:iso(estimatedArrival),
    landing:iso(landing),
    type:aircraft||null,
    reg:registration||null,
    status:status||null,
    origin:origin||null,
    destination:destination||null,
    terminalOrigin:terminalOrigin||null,
    terminalDestination:terminalDestination||null,
    gateOrigin:gateOrigin||null,
    gateDestination:gateDestination||null
  };
  const times=[scheduledDeparture,estimatedDeparture,takeoff,scheduledArrival,estimatedArrival,landing].filter(Boolean).map(iso);
  const useful=times.length+(registration?1:0)+(aircraft?1:0)+(status?1:0)+(origin?1:0)+(destination?1:0);
  return {
    times,
    registrations:registration?[registration]:[],
    aircraft:aircraft?[aircraft]:[],
    terminals:uniq([terminalOrigin,terminalDestination]),
    gates:uniq([gateOrigin,gateDestination]),
    statuses:status?[upper(status)]:[],
    excerpt:"FR24 public playback data for exact occurrence",
    semantic,
    fr24OccurrenceId:id||"",
    occurrenceMatched:true,
    flightMatched:identificationMatched,
    useful
  };
}

async function fetchPlayback(flight,id){
  if(!id)return null;
  const url=`https://api.flightradar24.com/common/v1/flight-playback.json?flightId=${encodeURIComponent(id)}`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{
      "accept":"application/json,text/plain,*/*",
      "accept-language":"fr-FR,fr;q=0.9,en;q=0.8",
      "origin":"https://www.flightradar24.com",
      "referer":`https://www.flightradar24.com/${encodeURIComponent(upper(flight.designator))}/${encodeURIComponent(id)}`,
      "sec-fetch-dest":"empty",
      "sec-fetch-mode":"cors",
      "sec-fetch-site":"same-site",
      "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36"
    }});
    const ct=clean(r.headers.get("content-type")).toLowerCase();
    if(!r.ok)return {url,finalUrl:r.url,httpStatus:r.status,status:r.status===403?"PLAYBACK_BLOCKED":"PLAYBACK_HTTP_ERROR",candidates:null};
    if(!ct.includes("json"))return {url,finalUrl:r.url,httpStatus:r.status,status:"PLAYBACK_NOT_JSON",candidates:null};
    const data=await r.json();
    const candidates=playbackCandidates(data,flight,id);
    if(!candidates)return {url,finalUrl:r.url,httpStatus:r.status,status:"PLAYBACK_NO_FLIGHT",candidates:null};
    const usable=candidates.flightMatched&&candidates.useful>0;
    return {url,finalUrl:r.url,httpStatus:r.status,status:usable?"OK":"PLAYBACK_NO_USABLE_DATA",candidates};
  }catch(e){
    return {url,finalUrl:url,httpStatus:0,status:e?.name==="AbortError"?"PLAYBACK_TIMEOUT":"PLAYBACK_FETCH_ERROR",candidates:null,error:String(e?.message||e).slice(0,200)};
  }finally{clearTimeout(timer)}
}

export async function fetchFr24Public(flight){
  const {id,urls}=fr24PublicUrls(flight);
  const checkedAt=new Date().toISOString();
  const attempts=[];
  if(id){
    const playback=await fetchPlayback(flight,id);
    attempts.push({url:playback.url,finalUrl:playback.finalUrl,httpStatus:playback.httpStatus,status:playback.status,candidates:playback.candidates,error:playback.error});
    if(playback.status==="OK"){
      return {name:"FR24",url:playback.url,status:"OK",httpStatus:playback.httpStatus,finalUrl:playback.finalUrl,mentionsFlight:true,candidates:{...playback.candidates,method:"PUBLIC_PLAYBACK",attempts:attempts.map(a=>({url:a.url,finalUrl:a.finalUrl,httpStatus:a.httpStatus,status:a.status,useful:a.candidates?.useful||0,error:a.error||""}))},checkedAt};
    }
  }
  for(const url of urls){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{"accept":"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-PublicSourceTest/2.3; public-web-page)"}});
      const ct=clean(r.headers.get("content-type")).toLowerCase();
      const body=(ct.includes("text")||ct.includes("json")||ct.includes("javascript"))?await r.text():"";
      const candidates=extract(body,flight,id);
      const exactOk=id?candidates.occurrenceMatched:true;
      const usable=r.ok&&candidates.flightMatched&&exactOk&&candidates.useful>0;
      const attempt={url,finalUrl:r.url,httpStatus:r.status,status:usable?"OK":"HTML_NO_USABLE_DATA",ok:r.ok,candidates};
      attempts.push(attempt);
      if(usable){
        return {name:"FR24",url,status:"OK",httpStatus:r.status,finalUrl:r.url,mentionsFlight:true,candidates:{...candidates,method:"PUBLIC_HTML",attempts:attempts.map(a=>({url:a.url,finalUrl:a.finalUrl,httpStatus:a.httpStatus,status:a.status,occurrenceMatched:a.candidates?.occurrenceMatched||false,useful:a.candidates?.useful||0,error:a.error||""}))},checkedAt};
      }
    }catch(e){attempts.push({url,finalUrl:url,httpStatus:0,status:e?.name==="AbortError"?"HTML_TIMEOUT":"HTML_FETCH_ERROR",error:String(e?.message||e).slice(0,200)});
    }finally{clearTimeout(timer)}
  }
  const best=[...attempts].sort((a,b)=>(b.candidates?.useful||0)-(a.candidates?.useful||0))[0];
  const playbackAttempt=attempts.find(a=>String(a.status||"").startsWith("PLAYBACK_"));
  const reason=playbackAttempt?.status||((id&&!best?.candidates?.occurrenceMatched)?"EXACT_OCCURRENCE_NOT_EXTRACTED":"FR24_NO_USABLE_DATA");
  return {name:"FR24",url:best?.url||urls[0]||"",status:reason,httpStatus:Number(best?.httpStatus||0),finalUrl:best?.finalUrl||urls[0]||"",mentionsFlight:Boolean(best?.candidates?.flightMatched),candidates:{...(best?.candidates||{}),fr24OccurrenceId:id||"",method:"NONE",attempts:attempts.map(a=>({url:a.url,finalUrl:a.finalUrl,httpStatus:a.httpStatus,status:a.status,occurrenceMatched:a.candidates?.occurrenceMatched||false,useful:a.candidates?.useful||0,error:a.error||""}))},error:reason,checkedAt};
}
