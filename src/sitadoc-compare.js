// Lecture seule : ce que le collecteur Sitadoc a enregistré pour les vols du jour, comparé à nos valeurs (immat, porte, type, ATD, décollage, ETD).
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase(),norm=v=>upper(v).replace(/[^A-Z0-9]/g,"");
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function compareSitadoc(rows){
  const out={flights:rows.length,withSitadoc:0,lastAt:null,identical:{reg:0,gate:0,type:0},different:{reg:[],gate:[],type:[]},atd:{fromSitadoc:0,other:[]},takeoff:{fromSitadoc:0},etdFromSitadoc:0,tsatLater:[]};
  for(const x of rows){
    const s=x.sitadoc;if(!s)continue;out.withSitadoc++;
    if(!out.lastAt||s.at>out.lastAt)out.lastAt=s.at;
    const name=x.flight||"?";
    const cmp=(key,ours,theirs)=>{if(!norm(theirs)||!norm(ours))return;if(norm(ours)===norm(theirs))out.identical[key]++;else out.different[key].push({flight:name,ours:clean(ours),sitadoc:clean(theirs)})};
    cmp("reg",x.reg||x.registration,s.reg);cmp("gate",x.gate,s.gate);
    const ot=upper(x.aircraftActual||x.aircraft),st=upper(s.type).split(/\s+/)[0];cmp("type",ot,st);
    if(/SITADOC/i.test(x.atdSource||""))out.atd.fromSitadoc++;else if(s.code==="HDB"||s.code==="QTN")out.atd.other.push({flight:name,ours:clean(x.atd),source:clean(x.atdSource)});
    if(/SITADOC/i.test(x.takeoffSource||""))out.takeoff.fromSitadoc++;
    if(/SITADOC/i.test(x.etdSource||""))out.etdFromSitadoc++;
    if(s.tsat&&clean(x.std)&&s.tsat>clean(x.std))out.tsatLater.push({flight:name,std:clean(x.std),tsat:s.tsat,etd:clean(x.etd)});
  }
  return out;
}

export async function sitadocCompare(env,{date="",nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=date||parisDate(nowMs);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{try{return JSON.parse(r.data_json||"{}")}catch{return {}}});
  return {ok:true,mode:"SITADOC_COMPARE_NO_WRITE",date:day,...compareSitadoc(rows)};
}
