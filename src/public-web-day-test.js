const PUBLIC_SOURCES=[
  ["FR24",f=>`https://www.flightradar24.com/data/flights/${encodeURIComponent(f.designator.toLowerCase())}`],
  ["FLIGHTAWARE",f=>`https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`],
  ["FLIGHTSTATS",f=>`https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`],
  ["PLANEFINDER",f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`],
  ["SKYSCANNER",f=>`https://www.skyscanner.net/flight-tracker/${encodeURIComponent(f.designator.toLowerCase())}`],
  ["FLIGHTVIEW",f=>`https://www.flightview.com/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}`],
  ["WEGO",f=>`https://www.wego.com/schedules/${encodeURIComponent(f.designator)}?date=${encodeURIComponent(f.date)}`],
  ["IXIGO",f=>`https://www.ixigo.com/flight-status/${encodeURIComponent(f.airline.toLowerCase())}-${encodeURIComponent(f.number)}?date=${encodeURIComponent(f.date)}`],
  ["KAYAK",f=>`https://www.kayak.com/tracker/${encodeURIComponent(f.designator)}`],
  ["FLIGHTY",()=>`https://flighty.com/airports/paris-charles-de-gaulle-cdg/departures`],
  ["PARIS_AEROPORT",()=>`https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures`],
  ["SIMPLEFLYING",()=>`https://simpleflying.com/flight-tracker/`],
  ["FLIGHTRADARS24_FR",()=>`https://flightradars24.fr/aeroport-charles-de-gaulle/depart/`],
  ["FLIGHTERA",f=>`https://www.flightera.net/en/flight/${encodeURIComponent(f.designator)}`]
];

const SOURCE_NAMES=PUBLIC_SOURCES.map(([name])=>name);
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store","access-control-allow-origin":"*"}});

function flightNumberOnly(airline,flight){
  const a=upper(airline),f=upper(flight);
  return f.startsWith(a)?f.slice(a.length):f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
}
function normalizeFlight(row){
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const airline=upper(x.airline||row.airline);
  const number=flightNumberOnly(airline,x.flight||row.flight_number);
  const designator=`${airline}${number}`;
  return {identity:row.identity,date:clean(x.date||row.flight_date),airline,number,designator,origin:upper(x.origin||x.dep||"CDG"),destination:upper(x.destination||x.dest),std:clean(x.std||row.std),raw:x};
}
function htmlText(html){
  return String(html||"")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"')
    .replace(/\s+/g," ").trim();
}
function uniq(values,max=24){return [...new Set(values.filter(Boolean))].slice(0,max)}
function extractCandidates(text,flight){
  const t=String(text||"");
  const times=uniq([...t.matchAll(/\b(?:[01]?\d|2[0-3])[:h][0-5]\d\b/g)].map(m=>m[0].replace("h",":")),32);
  const registrations=uniq([...t.matchAll(/\b(?:TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|JA\d{3,4}[A-Z]|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z0-9]{3,5})\b/gi)].map(m=>m[0].toUpperCase()),12);
  const aircraft=uniq([...t.matchAll(/\b(?:A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A380|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|32Q|77W|788|789|359|333|332|320|321)\b/gi)].map(m=>m[0].toUpperCase()),12);
  const terminals=uniq([...t.matchAll(/(?:terminal|term\.?)[\s:#-]*([0-9A-Z]{1,4})/gi)].map(m=>upper(m[1])),8);
  const gates=uniq([...t.matchAll(/(?:gate|porte|portal)[\s:#-]*([A-Z]?\d{1,3}[A-Z]?)/gi)].map(m=>upper(m[1])),8);
  const statuses=uniq([...t.matchAll(/\b(?:scheduled|on time|delayed|departed|arrived|landed|cancelled|canceled|boarding|en vol|retard[ée]?|arriv[ée]?|décoll[ée]?)\b/gi)].map(m=>m[0].toUpperCase()),10);
  const marker=upper(flight.designator);
  const idx=upper(t).indexOf(marker);
  const excerpt=(idx>=0?t.slice(Math.max(0,idx-500),idx+1800):t.slice(0,2300));
  return {times,registrations,aircraft,terminals,gates,statuses,excerpt};
}
async function fetchSource(name,buildUrl,flight){
  const url=buildUrl(flight);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  const checkedAt=new Date().toISOString();
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{"accept":"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-PublicSourceTest/1.0; +public-flight-status-test)"}});
    const ct=clean(r.headers.get("content-type")).toLowerCase();
    const body=(ct.includes("text")||ct.includes("json")||ct.includes("javascript"))?await r.text():"";
    const text=htmlText(body);
    const candidates=extractCandidates(text,flight);
    const mentionsFlight=upper(text).includes(upper(flight.designator))||upper(text).includes(`${flight.airline} ${flight.number}`);
    return {name,url,status:r.ok?(mentionsFlight?"OK":"FETCHED_NO_MATCH"):"HTTP_ERROR",httpStatus:r.status,finalUrl:r.url,mentionsFlight,candidates,checkedAt};
  }catch(e){
    return {name,url,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,finalUrl:url,mentionsFlight:false,candidates:{times:[],registrations:[],aircraft:[],terminals:[],gates:[],statuses:[],excerpt:""},error:String(e?.message||e).slice(0,300),checkedAt};
  }finally{clearTimeout(timer)}
}
async function ensureSchema(env){
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS public_web_test_runs(
    run_id TEXT PRIMARY KEY,
    flight_date TEXT NOT NULL,
    status TEXT NOT NULL,
    total_flights INTEGER NOT NULL DEFAULT 0,
    cursor INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS public_web_test_results(
    run_id TEXT NOT NULL,
    flight_identity TEXT NOT NULL,
    flight_designator TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    http_status INTEGER NOT NULL DEFAULT 0,
    url TEXT,
    final_url TEXT,
    mentions_flight INTEGER NOT NULL DEFAULT 0,
    candidates_json TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    checked_at TEXT NOT NULL,
    PRIMARY KEY(run_id,flight_identity,source)
  )`).run();
}
async function listFlights(env,date,limit=null,offset=0){
  const sql=`SELECT identity,flight_date,airline,flight_number,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number${limit!=null?" LIMIT ? OFFSET ?":""}`;
  const stmt=env.OPS_DB.prepare(sql);
  const res=limit!=null?await stmt.bind(date,limit,offset).all():await stmt.bind(date).all();
  return (res.results||[]).map(normalizeFlight).filter(f=>f.airline&&f.number);
}
async function startRun(env,date){
  await ensureSchema(env);
  const flights=await listFlights(env,date);
  const runId=`${date}-${Date.now().toString(36)}`;
  await env.OPS_DB.prepare(`INSERT INTO public_web_test_runs(run_id,flight_date,status,total_flights,cursor,updated_at) VALUES(?,?,?, ?,0,CURRENT_TIMESTAMP)`).bind(runId,date,"RUNNING",flights.length).run();
  return {ok:true,runId,date,totalFlights:flights.length,sources:SOURCE_NAMES};
}
async function stepRun(env,runId,limit=2){
  await ensureSchema(env);
  const run=await env.OPS_DB.prepare(`SELECT * FROM public_web_test_runs WHERE run_id=?`).bind(runId).first();
  if(!run)return {ok:false,error:"RUN_NOT_FOUND"};
  if(run.status==="DONE")return statusRun(env,runId);
  const flights=await listFlights(env,run.flight_date,Math.max(1,Math.min(3,limit)),Number(run.cursor||0));
  let processed=0;
  for(const flight of flights){
    const results=await Promise.all(PUBLIC_SOURCES.map(([name,buildUrl])=>fetchSource(name,buildUrl,flight)));
    for(const r of results){
      await env.OPS_DB.prepare(`INSERT INTO public_web_test_results(run_id,flight_identity,flight_designator,source,status,http_status,url,final_url,mentions_flight,candidates_json,error,checked_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(run_id,flight_identity,source) DO UPDATE SET status=excluded.status,http_status=excluded.http_status,url=excluded.url,final_url=excluded.final_url,mentions_flight=excluded.mentions_flight,candidates_json=excluded.candidates_json,error=excluded.error,checked_at=excluded.checked_at`)
        .bind(runId,flight.identity,flight.designator,r.name,r.status,r.httpStatus,r.url,r.finalUrl,r.mentionsFlight?1:0,JSON.stringify(r.candidates||{}),r.error||null,r.checkedAt).run();
    }
    processed++;
  }
  const next=Number(run.cursor||0)+processed;
  const done=next>=Number(run.total_flights||0);
  await env.OPS_DB.prepare(`UPDATE public_web_test_runs SET cursor=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE run_id=?`).bind(next,done?"DONE":"RUNNING",runId).run();
  return statusRun(env,runId);
}
async function statusRun(env,runId){
  await ensureSchema(env);
  const run=await env.OPS_DB.prepare(`SELECT * FROM public_web_test_runs WHERE run_id=?`).bind(runId).first();
  if(!run)return {ok:false,error:"RUN_NOT_FOUND"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT source,status,COUNT(*) n,SUM(mentions_flight) matched FROM public_web_test_results WHERE run_id=? GROUP BY source,status ORDER BY source,status`).bind(runId).all();
  const sourceStats={};for(const r of results){sourceStats[r.source]??={attempted:0,matched:0,statuses:{}};sourceStats[r.source].attempted+=Number(r.n||0);sourceStats[r.source].matched+=Number(r.matched||0);sourceStats[r.source].statuses[r.status]=Number(r.n||0)}
  return {ok:true,runId,flightDate:run.flight_date,status:run.status,totalFlights:Number(run.total_flights||0),processedFlights:Number(run.cursor||0),sourceCount:SOURCE_NAMES.length,sources:SOURCE_NAMES,sourceStats};
}
async function flightReport(env,runId,identity){
  const {results=[]}=await env.OPS_DB.prepare(`SELECT source,status,http_status,url,final_url,mentions_flight,candidates_json,error,checked_at FROM public_web_test_results WHERE run_id=? AND flight_identity=? ORDER BY source`).bind(runId,identity).all();
  return {ok:true,runId,identity,results:results.map(r=>({...r,candidates:(()=>{try{return JSON.parse(r.candidates_json||"{}")}catch{return {}}})()}))};
}
function dashboard(date){
  const sources=SOURCE_NAMES.map(esc).join(", ");
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test public ${esc(date)}</title><style>body{font-family:system-ui;background:#101317;color:#f5f7fa;margin:0;padding:20px}button{font:inherit;padding:12px 16px;border-radius:12px;border:0}.card{background:#1c222a;border-radius:16px;padding:16px;margin:12px 0}.muted{color:#a9b2bd}pre{white-space:pre-wrap;word-break:break-word}</style><h1>Test grandeur nature ${esc(date)}</h1><div class="card"><b>Sources (${SOURCE_NAMES.length})</b><div class="muted">${sources}</div></div><div class="card"><button id="go">Lancer / reprendre</button><pre id="out">Prêt.</pre></div><script>const DATE=${JSON.stringify(date)};let runId='';const out=document.getElementById('out');async function j(url,opt){const r=await fetch(url,opt);return r.json()}async function go(){document.getElementById('go').disabled=true;if(!runId){const s=await j('/api/v2/public-day-test/start?date='+DATE,{method:'POST'});runId=s.runId;out.textContent=JSON.stringify(s,null,2)}for(;;){const s=await j('/api/v2/public-day-test/step?runId='+encodeURIComponent(runId)+'&limit=2',{method:'POST'});out.textContent=JSON.stringify(s,null,2);if(s.status==='DONE'||!s.ok)break;await new Promise(r=>setTimeout(r,300))}document.getElementById('go').disabled=false}document.getElementById('go').onclick=go;</script></html>`;
}
export async function handlePublicWebDayTest(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==="/v2/public-day-test"){
    const date=clean(url.searchParams.get("date"))||"2026-10-01";
    return new Response(dashboard(date),{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store"}});
  }
  if(!p.startsWith("/api/v2/public-day-test/"))return null;
  const date=clean(url.searchParams.get("date"));
  if(p.endsWith("/start")){
    if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);
    if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return json({ok:false,error:"DATE_REQUIRED"},400);
    return json(await startRun(env,date));
  }
  const runId=clean(url.searchParams.get("runId"));
  if(!runId)return json({ok:false,error:"RUN_ID_REQUIRED"},400);
  if(p.endsWith("/step")){
    if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);
    return json(await stepRun(env,runId,Number(url.searchParams.get("limit")||2)));
  }
  if(p.endsWith("/status"))return json(await statusRun(env,runId));
  if(p.endsWith("/flight"))return json(await flightReport(env,runId,clean(url.searchParams.get("identity"))));
  return json({ok:false,error:"NOT_FOUND"},404);
}
