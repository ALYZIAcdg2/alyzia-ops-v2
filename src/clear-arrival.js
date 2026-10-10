// Outil de test : vide l'ATA et le LDG d'UN vol d'hier ou d'aujourd'hui pour voir les sources les reécrire. Sans `apply=OUI` = aperçu, avec `apply=OUI` (ou POST) = applique.
// Les champs saisis à la main ne sont jamais vidés (le vol est refusé). L'opération est notée dans l'historique du vol (source ADMIN_RESET).
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const addDays=(d,n)=>{const t=new Date(d+"T12:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const isManual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const FIELDS=["ata","landing"];

export function clearArrivalFields(x,at){
  const out={...x},log=Array.isArray(x.flightInfoLog)?x.flightInfoLog.slice():[];
  for(const f of FIELDS){
    const from=clean(x[f]);if(!from)continue;
    log.unshift({at,source:"ADMIN_RESET",field:f,from,to:""});
    for(const k of [f,f+"Source",f+"UpdatedAt",f+"Confirmed",f+"Sources",f+"Day"])delete out[k];
  }
  delete out.fsRepairAt;
  out.flightInfoLog=log.slice(0,240);
  if(out.publicLiveBackfill)out.publicLiveBackfill={...out.publicLiveBackfill,checkedAt:""};
  return out;
}

export async function clearArrival(env,{flight="",date="",dryRun=true,nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(nowMs),day=clean(date)||today,wanted=upper(flight).replace(/\s+/g,"");
  if(!wanted)return {ok:false,error:"flight requis"};
  if(day!==today&&day!==addDays(today,-1))return {ok:false,error:"DATE_REFUSEE (aujourd'hui ou hier seulement)",date:day};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const row=results.find(r=>upper(r.flight_number).replace(/\s+/g,"")===wanted);
  if(!row)return {ok:false,error:"FLIGHT_NOT_FOUND",date:day,flight:wanted};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const manual=FIELDS.filter(f=>clean(x[f])&&isManual(x,f));
  if(manual.length)return {ok:false,error:"CHAMP_MANUEL : "+manual.join(", ")+" saisi à la main, rien n'est vidé",date:day,flight:wanted};
  const before=Object.fromEntries(FIELDS.map(f=>[f,{value:clean(x[f]),source:clean(x[f+"Source"])}]));
  const at=new Date(nowMs).toISOString(),next=clearArrivalFields(x,at);
  if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(next),row.identity).run();
  return {ok:true,mode:dryRun?"CLEAR_ARRIVAL_PREVIEW":"CLEAR_ARRIVAL_APPLIED",date:day,flight:wanted,before,after:Object.fromEntries(FIELDS.map(f=>[f,{value:clean(next[f]),source:clean(next[f+"Source"])}])),note:dryRun?"Aperçu : rien n'est modifié. Ajoute &apply=OUI à l'adresse pour appliquer.":"Vidés. Les sources (FR24 pour le LDG, FIDS pour l'ATA) les réécrivent aux prochains passages."};
}
