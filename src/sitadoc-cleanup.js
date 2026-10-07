// Nettoyage des données reçues de Sitadoc : bloc `sitadoc` (immat, type, parc, porte, passagers, TSAT), valeurs d'heures dont la source est Sitadoc
// (la valeur est vidée pour que les autres sources la reprennent) et lignes correspondantes du journal du vol. Ne touche à rien d'autre.
const FIELDS=["atd","takeoff","etd","eta","ata","landing"];
const isSitadoc=v=>/SITADOC/i.test(String(v||""));

export function cleanSitadocFlight(x){
  const res={removedBlock:false,fieldsCleared:[],logRemoved:0};
  if(x&&typeof x==="object"){
    if("sitadoc" in x){delete x.sitadoc;res.removedBlock=true}
    for(const f of FIELDS){
      if(isSitadoc(x[f+"Source"])){delete x[f];delete x[f+"Source"];delete x[f+"UpdatedAt"];res.fieldsCleared.push(f)}
    }
    if(Array.isArray(x.flightInfoLog)){const before=x.flightInfoLog.length;x.flightInfoLog=x.flightInfoLog.filter(e=>!isSitadoc(e?.source));res.logRemoved=before-x.flightInfoLog.length}
  }
  res.changed=res.removedBlock||res.fieldsCleared.length>0||res.logRemoved>0;
  return res;
}

export async function cleanupSitadoc(env,{apply=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,data_json FROM flights WHERE data_json LIKE '%SITADOC%' OR data_json LIKE '%"sitadoc"%'`).all();
  const out={ok:true,mode:apply?"SITADOC_CLEANUP_APPLIED":"SITADOC_CLEANUP_DRY_RUN",candidates:results.length,cleaned:0,blocks:0,fields:{},logRemoved:0,flights:[]};
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    const c=cleanSitadocFlight(x);if(!c.changed)continue;
    out.cleaned++;if(c.removedBlock)out.blocks++;out.logRemoved+=c.logRemoved;for(const f of c.fieldsCleared)out.fields[f]=(out.fields[f]||0)+1;
    if(out.flights.length<30)out.flights.push({date:r.flight_date,flight:r.flight_number,fieldsCleared:c.fieldsCleared});
    if(apply)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  return out;
}
