const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();

const FIELD_ORDER=["std","etd","atd","takeoff","sta","eta","landing","ata","terminal","gate","aircraft","reg","status"];
const SOURCE_PRIORITY={
  std:["PARIS_AEROPORT","FLIGHTSTATS","FLIGHTAWARE","FR24","PLANEFINDER","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTERA","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  etd:["PARIS_AEROPORT","FLIGHTSTATS","FLIGHTAWARE","FR24","PLANEFINDER","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTERA","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  atd:["FLIGHTAWARE","FLIGHTSTATS","PARIS_AEROPORT","FR24","PLANEFINDER","FLIGHTERA","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  takeoff:["FR24","FLIGHTAWARE","PLANEFINDER","FLIGHTERA","FLIGHTSTATS","PARIS_AEROPORT","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  sta:["FLIGHTSTATS","FLIGHTAWARE","FR24","PLANEFINDER","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTERA","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  eta:["FLIGHTAWARE","FLIGHTSTATS","FR24","PLANEFINDER","FLIGHTERA","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  landing:["FR24","FLIGHTAWARE","PLANEFINDER","FLIGHTERA","FLIGHTSTATS","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  ata:["FLIGHTAWARE","FLIGHTSTATS","FR24","PLANEFINDER","FLIGHTERA","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  terminal:["PARIS_AEROPORT","FLIGHTSTATS","FLIGHTAWARE","SKYSCANNER","FLIGHTVIEW","FR24","PLANEFINDER","FLIGHTERA","WEGO","IXIGO","KAYAK","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  gate:["PARIS_AEROPORT","FLIGHTSTATS","FLIGHTAWARE","SKYSCANNER","FLIGHTVIEW","FR24","PLANEFINDER","FLIGHTERA","WEGO","IXIGO","KAYAK","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  aircraft:["FR24","FLIGHTAWARE","PLANEFINDER","FLIGHTSTATS","FLIGHTERA","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  reg:["FR24","FLIGHTAWARE","PLANEFINDER","FLIGHTSTATS","FLIGHTERA","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTY","PARIS_AEROPORT","FLIGHTRADARS24_FR","SIMPLEFLYING"],
  status:["PARIS_AEROPORT","FLIGHTSTATS","FLIGHTAWARE","FR24","PLANEFINDER","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTERA","FLIGHTY","FLIGHTRADARS24_FR","SIMPLEFLYING"]
};

function firstTime(text,patterns){
  const s=String(text||"");
  for(const p of patterns){
    const m=s.match(p);
    if(m)return m[1].replace("h",":");
  }
  return "";
}
function normalizeAircraft(v){
  const x=upper(v).replace(/[^A-Z0-9]/g,"");
  const map={"32Q":"A21N","321NEO":"A21N","A321NEO":"A21N","359":"A359","350":"A359","A350900":"A359","333":"A333","A330300":"A333","332":"A332","A330200":"A332","77W":"B77W","777300ER":"B77W","B777300ER":"B77W","789":"B789","7879":"B789","B7879":"B789","788":"B788","7878":"B788","B7878":"B788","320":"A320","321":"A321"};
  return map[x]||x;
}
function normalizeStatus(v){
  const x=upper(v);
  if(/CANCEL/.test(x))return "CANCELLED";
  if(/ARRIV|LANDED/.test(x))return "ARRIVED";
  if(/DEPART|EN VOL|AIRBORNE/.test(x))return "EN VOL";
  if(/DELAY|RETARD/.test(x))return "DELAYED";
  if(/BOARD/.test(x))return "BOARDING";
  if(/ON TIME/.test(x))return "ON TIME";
  if(/SCHEDULED/.test(x))return "SCHEDULED";
  return x;
}
function semanticFromResult(row){
  let c={};try{c=JSON.parse(row.candidates_json||"{}")}catch{}
  const e=String(c.excerpt||"");
  const out={};
  const timePatterns={
    std:[/(?:scheduled departure|departure scheduled|std)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i,/(?:scheduled|prévu)[^0-9]{0,16}(\d{1,2}[:h]\d{2})[^\n]{0,80}(?:departure|départ)/i],
    etd:[/(?:estimated departure|departure estimate|etd|départ estimé)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    atd:[/(?:actual departure|gate out|departed(?: at)?|atd|départ réel)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    takeoff:[/(?:takeoff|take-off|took off|airborne|décoll(?:age|é|e))[ ^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    sta:[/(?:scheduled arrival|arrival scheduled|sta)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    eta:[/(?:estimated arrival|arrival estimate|eta|arrivée estimée)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    landing:[/(?:landing|landed(?: at)?|atterri(?: à)?|atterrissage)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i],
    ata:[/(?:actual arrival|gate in|arrived at gate|ata|arrivée réelle)[^0-9]{0,30}(\d{1,2}[:h]\d{2})/i]
  };
  for(const [k,p] of Object.entries(timePatterns)){const v=firstTime(e,p);if(v)out[k]=v.padStart(5,"0")}
  if(Array.isArray(c.terminals)&&c.terminals[0])out.terminal=upper(c.terminals[0]);
  if(Array.isArray(c.gates)&&c.gates[0])out.gate=upper(c.gates[0]);
  if(Array.isArray(c.aircraft)&&c.aircraft[0])out.aircraft=normalizeAircraft(c.aircraft[0]);
  if(Array.isArray(c.registrations)&&c.registrations[0])out.reg=upper(c.registrations[0]);
  if(Array.isArray(c.statuses)&&c.statuses[0])out.status=normalizeStatus(c.statuses[0]);
  return out;
}
function priorityScore(field,source){
  const arr=SOURCE_PRIORITY[field]||[];
  const i=arr.indexOf(source);
  return i<0?1:(arr.length-i)*10;
}
function chooseField(field,rows){
  const evidence=[];
  for(const row of rows){
    if(row.status!=="OK"||!Number(row.mentions_flight))continue;
    const sem=semanticFromResult(row),value=clean(sem[field]);
    if(!value)continue;
    evidence.push({source:row.source,value,score:priorityScore(field,row.source)});
  }
  if(!evidence.length)return {field,value:"",state:"MISSING",source:"",evidence:[]};
  const groups=new Map();
  for(const e of evidence){const key=field==="aircraft"?normalizeAircraft(e.value):field==="status"?normalizeStatus(e.value):upper(e.value);const g=groups.get(key)||{value:e.value,score:0,sources:[]};g.score+=e.score;g.sources.push(e.source);if(e.score>priorityScore(field,g.source||"")){g.value=e.value;g.source=e.source}groups.set(key,g)}
  let best=null;for(const g of groups.values())if(!best||g.score>best.score)best=g;
  const source=(SOURCE_PRIORITY[field]||[]).find(s=>best.sources.includes(s))||best.sources[0];
  let state="CONFIRMED";
  if(field==="aircraft"||field==="reg"){
    const hasFr24=best.sources.includes("FR24");
    const hasSecond=best.sources.some(s=>s!=="FR24");
    state=hasFr24&&hasSecond?"CONFIRMED":"PROVISIONAL";
  }
  return {field,value:best.value,state,source,evidence};
}
function manualProtected(x,field){
  const source=upper(x?.[field+"Source"]);
  if(source.includes("MANUAL"))return true;
  if(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field])return true;
  const changes=Array.isArray(x?.manualChanges)?x.manualChanges:[];
  return changes.some(m=>upper(m?.field)===upper(field)&&m?.active!==false);
}
function targetField(field){return ({aircraft:"aircraft",reg:"reg",terminal:"terminal",gate:"gate",status:"status",etd:"etd",atd:"atd",takeoff:"takeoff",eta:"eta",landing:"landing",ata:"ata"})[field]||null}

async function ensureSchema(env){
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS public_web_consolidated(
    run_id TEXT NOT NULL,
    flight_identity TEXT NOT NULL,
    field TEXT NOT NULL,
    chosen_value TEXT,
    state TEXT NOT NULL,
    source TEXT,
    evidence_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(run_id,flight_identity,field)
  )`).run();
}
async function runInfo(env,runId){return env.OPS_DB.prepare(`SELECT * FROM public_web_test_runs WHERE run_id=?`).bind(runId).first()}
async function consolidateOne(env,runId,identity){
  const flight=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE identity=?`).bind(identity).first();
  if(!flight)return null;
  const {results=[]}=await env.OPS_DB.prepare(`SELECT source,status,mentions_flight,candidates_json FROM public_web_test_results WHERE run_id=? AND flight_identity=? ORDER BY source`).bind(runId,identity).all();
  const fields={};
  for(const field of FIELD_ORDER){
    const chosen=chooseField(field,results);fields[field]=chosen;
    await env.OPS_DB.prepare(`INSERT INTO public_web_consolidated(run_id,flight_identity,field,chosen_value,state,source,evidence_json,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(run_id,flight_identity,field) DO UPDATE SET chosen_value=excluded.chosen_value,state=excluded.state,source=excluded.source,evidence_json=excluded.evidence_json,updated_at=CURRENT_TIMESTAMP`).bind(runId,identity,field,chosen.value||null,chosen.state,chosen.source||null,JSON.stringify(chosen.evidence)).run();
  }
  return {identity,sourcesAttempted:results.length,fields};
}
export async function consolidateRun(env,runId){
  await ensureSchema(env);
  const run=await runInfo(env,runId);
  if(!run)return {ok:false,error:"RUN_NOT_FOUND"};
  if(run.status!=="DONE")return {ok:false,error:"RUN_NOT_DONE",status:run.status};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT DISTINCT flight_identity FROM public_web_test_results WHERE run_id=? ORDER BY flight_identity`).bind(runId).all();
  let confirmed=0,provisional=0,missing=0;
  for(const r of results){const one=await consolidateOne(env,runId,r.flight_identity);for(const f of Object.values(one?.fields||{})){if(f.state==="CONFIRMED")confirmed++;else if(f.state==="PROVISIONAL")provisional++;else missing++}}
  return {ok:true,runId,flightDate:run.flight_date,flights:results.length,confirmed,provisional,missing};
}
export async function consolidationPreview(env,runId){
  await ensureSchema(env);
  const run=await runInfo(env,runId);if(!run)return {ok:false,error:"RUN_NOT_FOUND"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT c.flight_identity,f.flight_number,f.airline,c.field,c.chosen_value,c.state,c.source,c.evidence_json FROM public_web_consolidated c JOIN flights f ON f.identity=c.flight_identity WHERE c.run_id=? ORDER BY f.std,f.flight_number,c.field`).bind(runId).all();
  const flights={};for(const r of results){const k=r.flight_identity;flights[k]??={identity:k,flight:`${r.airline}${String(r.flight_number||"").replace(new RegExp('^'+r.airline,'i'),'')}`,fields:{}};flights[k].fields[r.field]={value:r.chosen_value||"",state:r.state,source:r.source||"",evidence:(()=>{try{return JSON.parse(r.evidence_json||"[]")}catch{return []}})()}}
  return {ok:true,runId,flightDate:run.flight_date,flights:Object.values(flights)};
}
export async function applyConsolidatedRun(env,runId){
  await ensureSchema(env);
  const run=await runInfo(env,runId);if(!run)return {ok:false,error:"RUN_NOT_FOUND"};if(run.status!=="DONE")return {ok:false,error:"RUN_NOT_DONE"};
  const {results:ids=[]}=await env.OPS_DB.prepare(`SELECT DISTINCT flight_identity FROM public_web_consolidated WHERE run_id=? ORDER BY flight_identity`).bind(runId).all();
  const now=new Date().toISOString();let flightsChanged=0,fieldsChanged=0,manualSkipped=0;
  for(const it of ids){
    const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=?`).bind(it.flight_identity).first();if(!row)continue;
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const {results=[]}=await env.OPS_DB.prepare(`SELECT field,chosen_value,state,source,evidence_json FROM public_web_consolidated WHERE run_id=? AND flight_identity=?`).bind(runId,it.flight_identity).all();
    const applied={};let changed=false;
    for(const r of results){
      if(r.state!=="CONFIRMED"||!clean(r.chosen_value))continue;
      const target=targetField(r.field);if(!target)continue;
      if(manualProtected(x,target)){manualSkipped++;continue}
      const next=clean(r.chosen_value),before=clean(x[target]);if(before===next)continue;
      x[target]=next;x[target+"Source"]=`PUBLIC_WEB:${r.source}`;x[target+"UpdatedAt"]=now;
      const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at:now,source:`PUBLIC_WEB:${r.source}`,field:target,from:before,to:next,runId});x.flightInfoLog=log.slice(0,160);
      applied[target]={value:next,source:r.source};fieldsChanged++;changed=true;
    }
    x.publicWebEnrichment={runId,appliedAt:now,fields:applied};
    if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),it.flight_identity).run();flightsChanged++}
  }
  return {ok:true,runId,flightDate:run.flight_date,flightsChanged,fieldsChanged,manualSkipped,note:"STD/STA restent le planning de référence; les valeurs consolidées correspondantes restent disponibles dans public_web_consolidated."};
}
