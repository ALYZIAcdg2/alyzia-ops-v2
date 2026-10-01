const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const TIME_FIELDS=new Set(["etd","atd","takeoff","sta","eta","landing","ata"]);
const APPLY_FIELDS=["etd","atd","takeoff","sta","eta","landing","ata","terminal","gate","aircraft","reg","status"];
const TRUSTED_TIME=new Set(["FR24","FLIGHTAWARE","FLIGHTSTATS","PLANEFINDER","PARIS_AEROPORT"]);
const TRUSTED_STATIC=new Set(["FR24","FLIGHTAWARE","FLIGHTSTATS","PLANEFINDER","PARIS_AEROPORT","SKYSCANNER"]);

function minutes(v){const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function circularDiff(a,b){const x=minutes(a),y=minutes(b);if(x==null||y==null)return 999;const d=Math.abs(x-y);return Math.min(d,1440-d)}
function normalizeAircraft(v){const x=upper(v).replace(/[^A-Z0-9]/g,"");const map={"32Q":"A21N","321NEO":"A21N","A321NEO":"A21N","359":"A359","350":"A359","A350900":"A359","333":"A333","A330300":"A333","332":"A332","A330200":"A332","77W":"B77W","777300ER":"B77W","B777300ER":"B77W","789":"B789","7879":"B789","B7879":"B789","788":"B788","7878":"B788","B7878":"B788","320":"A320","321":"A321"};return map[x]||x}
function normalizeStatus(v){const x=upper(v);if(/CANCEL/.test(x))return "CANCELLED";if(/ARRIV|LANDED/.test(x))return "ARRIVED";if(/DEPART|EN VOL|AIRBORNE/.test(x))return "EN VOL";if(/DELAY|RETARD/.test(x))return "DELAYED";if(/BOARD/.test(x))return "BOARDING";if(/ON TIME/.test(x))return "ON TIME";if(/SCHEDULED/.test(x))return "SCHEDULED";return x}
function firstMatch(text,patterns){for(const p of patterns){const m=String(text||"").match(p);if(m)return clean(m[1]).replace("h",":")}return ""}
function semantic(row){let c={};try{c=JSON.parse(row.candidates_json||"{}")}catch{}const e=String(c.excerpt||"");const out={};
  const p={
    etd:[/(?:estimated departure|departure estimate|etd|départ estimé)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    atd:[/(?:gate out|actual departure|departed at|atd|départ réel)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    takeoff:[/(?:takeoff|take-off|took off|airborne|décoll(?:age|é|e))[ ^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    sta:[/(?:scheduled arrival|arrival scheduled|sta)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    eta:[/(?:estimated arrival|arrival estimate|eta|arrivée estimée)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    landing:[/(?:landing|landed at|atterri(?: à)?|atterrissage)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i],
    ata:[/(?:gate in|actual arrival|arrived at gate|ata|arrivée réelle)[^0-9]{0,24}(\d{1,2}[:h]\d{2})/i]
  };
  for(const [k,ps] of Object.entries(p)){const v=firstMatch(e,ps);if(v&&/^\d{1,2}:\d{2}$/.test(v))out[k]=v.padStart(5,"0")}
  if(Array.isArray(c.terminals)&&c.terminals[0])out.terminal=upper(c.terminals[0]);
  if(Array.isArray(c.gates)&&c.gates[0])out.gate=upper(c.gates[0]);
  if(Array.isArray(c.aircraft)&&c.aircraft[0])out.aircraft=normalizeAircraft(c.aircraft[0]);
  if(Array.isArray(c.registrations)&&c.registrations[0])out.reg=upper(c.registrations[0]);
  if(Array.isArray(c.statuses)&&c.statuses[0])out.status=normalizeStatus(c.statuses[0]);
  return out;
}
function rowsEvidence(rows,field){const out=[];for(const r of rows){if(r.status!=="OK"||!Number(r.mentions_flight))continue;const s=semantic(r),v=clean(s[field]);if(v)out.push({source:r.source,value:v})}return out}
function chooseTime(field,ev){const trusted=ev.filter(e=>TRUSTED_TIME.has(e.source));let best=null;const tolerance=(field==="ata"||field==="atd")?12:5;
  for(let i=0;i<trusted.length;i++)for(let j=i+1;j<trusted.length;j++){if(circularDiff(trusted[i].value,trusted[j].value)<=tolerance){const pair=[trusted[i],trusted[j]];const score=pair.some(x=>x.source==="FR24")?3:pair.some(x=>x.source==="FLIGHTAWARE")?2:1;if(!best||score>best.score)best={value:pair[0].value,sources:pair.map(x=>x.source),score}}}
  return best?{value:best.value,state:"CONFIRMED",source:best.sources[0],evidence:ev}:{value:"",state:ev.length?"PROVISIONAL":"MISSING",source:"",evidence:ev};
}
function chooseStatic(field,ev){if(!ev.length)return {value:"",state:"MISSING",source:"",evidence:ev};const norm=v=>field==="aircraft"?normalizeAircraft(v):field==="status"?normalizeStatus(v):upper(v);const groups=new Map();for(const e of ev){const k=norm(e.value);if(!k)continue;const g=groups.get(k)||{value:e.value,sources:[]};if(!g.sources.includes(e.source))g.sources.push(e.source);groups.set(k,g)}
  let best=null;for(const g of groups.values()){const trusted=g.sources.filter(s=>TRUSTED_STATIC.has(s));const score=trusted.length*10+(g.sources.includes("FR24")?4:0)+(g.sources.includes("PARIS_AEROPORT")?4:0);if(!best||score>best.score)best={...g,score,trusted}}
  if(!best)return {value:"",state:"MISSING",source:"",evidence:ev};
  let confirmed=false;
  if(field==="aircraft"||field==="reg")confirmed=best.sources.includes("FR24")&&best.trusted.some(s=>s!=="FR24");
  else if(field==="gate"||field==="terminal")confirmed=(best.sources.includes("PARIS_AEROPORT")&&best.trusted.length>=1)||best.trusted.length>=2;
  else confirmed=best.trusted.length>=2;
  return {value:best.value,state:confirmed?"CONFIRMED":"PROVISIONAL",source:best.sources[0],evidence:ev};
}
function manualProtected(x,field){const src=upper(x?.[field+"Source"]);if(src.includes("MANUAL"))return true;if(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field])return true;const arr=Array.isArray(x?.manualChanges)?x.manualChanges:[];return arr.some(m=>upper(m?.field)===upper(field)&&m?.active!==false)}
function restoreBadPublicValue(x,field){const src=upper(x?.[field+"Source"]);if(!src.startsWith("PUBLIC_WEB"))return false;const cur=clean(x[field]);const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];const hit=log.find(e=>upper(e?.field)===upper(field)&&upper(e?.source).startsWith("PUBLIC_WEB")&&clean(e?.to)===cur);if(hit){if(clean(hit.from))x[field]=hit.from;else delete x[field]}else delete x[field];delete x[field+"Source"];delete x[field+"UpdatedAt"];return true}
function pushLog(x,field,from,to,source,at){const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source,field,from:clean(from),to:clean(to)});x.flightInfoLog=log.slice(0,200)}

async function ensure(env){await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS public_web_consolidated_v2(run_id TEXT NOT NULL,flight_identity TEXT NOT NULL,field TEXT NOT NULL,chosen_value TEXT,state TEXT NOT NULL,source TEXT,evidence_json TEXT NOT NULL DEFAULT '[]',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(run_id,flight_identity,field))`).run()}
async function runInfo(env,runId){return env.OPS_DB.prepare(`SELECT * FROM public_web_test_runs WHERE run_id=?`).bind(runId).first()}
async function completeSources(env,runId,identity){const row=await env.OPS_DB.prepare(`SELECT COUNT(DISTINCT source) n FROM public_web_test_results WHERE run_id=? AND flight_identity=?`).bind(runId,identity).first();return Number(row?.n||0)>=14}

export async function consolidateRunV2(env,runId){await ensure(env);const run=await runInfo(env,runId);if(!run)return {ok:false,error:"RUN_NOT_FOUND"};if(run.status!=="DONE")return {ok:false,error:"RUN_NOT_DONE"};const {results:ids=[]}=await env.OPS_DB.prepare(`SELECT DISTINCT flight_identity FROM public_web_test_results WHERE run_id=? ORDER BY flight_identity`).bind(runId).all();let confirmed=0,provisional=0,missing=0,incompleteFlights=0;
  for(const it of ids){const complete=await completeSources(env,runId,it.flight_identity);if(!complete)incompleteFlights++;const {results:rows=[]}=await env.OPS_DB.prepare(`SELECT source,status,mentions_flight,candidates_json FROM public_web_test_results WHERE run_id=? AND flight_identity=?`).bind(runId,it.flight_identity).all();const chosen={};
    for(const field of APPLY_FIELDS.filter(f=>f!=="status")){const ev=rowsEvidence(rows,field);let c=TIME_FIELDS.has(field)?chooseTime(field,ev):chooseStatic(field,ev);if(!complete&&c.state==="CONFIRMED")c={...c,state:"PROVISIONAL"};chosen[field]=c}
    let status={value:"",state:"MISSING",source:"DERIVED",evidence:[]};if(chosen.ata?.state==="CONFIRMED")status={value:"ARRIVED",state:"CONFIRMED",source:"DERIVED_FROM_ATA",evidence:[]};else if(chosen.atd?.state==="CONFIRMED"||chosen.takeoff?.state==="CONFIRMED")status={value:"EN VOL",state:"CONFIRMED",source:"DERIVED_FROM_DEPARTURE",evidence:[]};else{const ev=rowsEvidence(rows,"status");status=chooseStatic("status",ev)}chosen.status=status;
    for(const [field,c] of Object.entries(chosen)){await env.OPS_DB.prepare(`INSERT INTO public_web_consolidated_v2(run_id,flight_identity,field,chosen_value,state,source,evidence_json,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(run_id,flight_identity,field) DO UPDATE SET chosen_value=excluded.chosen_value,state=excluded.state,source=excluded.source,evidence_json=excluded.evidence_json,updated_at=CURRENT_TIMESTAMP`).bind(runId,it.flight_identity,field,c.value||null,c.state,c.source||null,JSON.stringify(c.evidence||[])).run();if(c.state==="CONFIRMED")confirmed++;else if(c.state==="PROVISIONAL")provisional++;else missing++}
  }
  return {ok:true,runId,flightDate:run.flight_date,flights:ids.length,confirmed,provisional,missing,incompleteFlights,mode:"STRICT_V2"};
}

export async function previewRunV2(env,runId){await ensure(env);const {results=[]}=await env.OPS_DB.prepare(`SELECT c.flight_identity,f.airline,f.flight_number,c.field,c.chosen_value,c.state,c.source,c.evidence_json FROM public_web_consolidated_v2 c JOIN flights f ON f.identity=c.flight_identity WHERE c.run_id=? ORDER BY f.std,f.flight_number,c.field`).bind(runId).all();const flights={};for(const r of results){const k=r.flight_identity;flights[k]??={identity:k,flight:`${r.airline}${String(r.flight_number||"").replace(new RegExp('^'+r.airline,'i'),'')}`,fields:{}};flights[k].fields[r.field]={value:r.chosen_value||"",state:r.state,source:r.source||"",evidence:(()=>{try{return JSON.parse(r.evidence_json||"[]")}catch{return []}})()}}return {ok:true,runId,flights:Object.values(flights)}}

export async function applyRunV2(env,runId){await ensure(env);const run=await runInfo(env,runId);if(!run||run.status!=="DONE")return {ok:false,error:"RUN_NOT_DONE"};const {results:ids=[]}=await env.OPS_DB.prepare(`SELECT DISTINCT flight_identity FROM public_web_consolidated_v2 WHERE run_id=?`).bind(runId).all();const now=new Date().toISOString();let flightsChanged=0,fieldsChanged=0,rolledBack=0,manualSkipped=0;
  for(const it of ids){const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=?`).bind(it.flight_identity).first();if(!row)continue;let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const {results:vals=[]}=await env.OPS_DB.prepare(`SELECT field,chosen_value,state,source FROM public_web_consolidated_v2 WHERE run_id=? AND flight_identity=?`).bind(runId,it.flight_identity).all();const by=Object.fromEntries(vals.map(v=>[v.field,v]));let changed=false;
    for(const field of APPLY_FIELDS){if(manualProtected(x,field)){manualSkipped++;continue}const r=by[field];if(!r||r.state!=="CONFIRMED"||!clean(r.chosen_value)){if(restoreBadPublicValue(x,field)){rolledBack++;changed=true}continue}const next=clean(r.chosen_value),before=clean(x[field]);if(before===next&&upper(x[field+"Source"]).startsWith("PUBLIC_WEB_V2"))continue;pushLog(x,field,before,next,`PUBLIC_WEB_V2:${r.source||"CONSENSUS"}`,now);x[field]=next;x[field+"Source"]=`PUBLIC_WEB_V2:${r.source||"CONSENSUS"}`;x[field+"UpdatedAt"]=now;fieldsChanged++;changed=true}
    if(changed){x.publicWebV2AppliedAt=now;x.publicWebV2RunId=runId;await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),it.flight_identity).run();flightsChanged++}
  }
  return {ok:true,runId,flightsChanged,fieldsChanged,rolledBack,manualSkipped,mode:"STRICT_V2"};
}
