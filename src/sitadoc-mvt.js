// Messages MVT reçus dans Sitadoc CDG (intranet de l'aéroport) : heures réelles de départ / d'arrivée envoyées par les compagnies.
// Format IATA : « LO334/06.SPLVN.WAW » (vol/jour.immatriculation.escale) puis « AD0615/0630 » (calage retiré / décollage, UTC),
// « EA0745 » (arrivée estimée), « AA0718/0724 » (atterrissage / calage mis, UTC). Seules les heures sont gardées, jamais le message.
import {AIRPORT_TZ} from "./airport-tz.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const hhmm=s=>{const m=/^(\d{2})(\d{2})$/.exec(String(s||""));return m&&Number(m[1])<24&&Number(m[2])<60?[Number(m[1]),Number(m[2])]:null};

export function parseMvt(text){
  const lines=String(text||"").toUpperCase().replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean);
  const head=lines.map(l=>/^([A-Z0-9]{2})(\d{1,4})([A-Z]?)\/(\d{1,2})\.([A-Z0-9-]{2,7})\.([A-Z]{3})\b/.exec(l)).find(Boolean);
  if(!head)return null;
  const out={airline:head[1],number:head[2],day:Number(head[4]),reg:head[5].replace(/-/g,""),station:head[6],ad:null,ea:"",ed:"",aa:null};
  for(const line of lines)for(const tok of line.split(/\s+/)){
    let m;
    if((m=/^AD(\d{4})(?:\/(\d{4}))?$/.exec(tok)))out.ad={off:m[1],air:m[2]||""};
    else if((m=/^AA(\d{4})(?:\/(\d{4}))?$/.exec(tok)))out.aa={land:m[1],block:m[2]||""};
    else if((m=/^EA(\d{4})(?:\/\d{2})?$/.exec(tok)))out.ea=m[1];
    else if((m=/^ED(\d{4})(?:\/\d{2})?$/.exec(tok)))out.ed=m[1];
  }
  return out.ad||out.aa||out.ea?out:null;
}

// « 0718 » UTC le jour donné -> « 09:18 » dans le fuseau demandé.
export function utcToLocal(hhmmUtc,date,zone){
  const t=hhmm(hhmmUtc),d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||"");if(!t||!d)return "";
  const at=new Date(Date.UTC(+d[1],+d[2]-1,+d[3],t[0],t[1]));
  try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(at).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}
}

// Jour « 06 » du message + date de réception (heure de Paris, « 2026/10/06 09:30 » ou ISO) -> date du vol (AAAA-MM-JJ).
export function flightDateFromDay(day,receivedAt){
  const m=/^(\d{4})[/-](\d{2})[/-](\d{2})/.exec(clean(receivedAt));if(!m||!(day>=1&&day<=31))return "";
  const base=Date.UTC(+m[1],+m[2]-1,+m[3]);let best="",gap=1e18;
  for(const mo of [-1,0,1]){const d=new Date(Date.UTC(+m[1],+m[2]-1+mo,day));if(d.getUTCDate()!==day)continue;const g=Math.abs(d.getTime()-base);if(g<gap){gap=g;best=d.toISOString().slice(0,10)}}
  return best;
}

const PROVISIONAL=/FIDS|DERIVED|CALC|ONTIME/;
function put(x,field,value,at,summary){
  if(!value||manual(x,field))return false;
  const before=clean(x[field]);if(before===value)return false;
  const src=upper(x[field+"Source"]);
  if(before&&!PROVISIONAL.test(src)&&!/SITADOC/.test(src)){summary.kept.push({field,kept:before,mvt:value});return false}
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"SITADOC_MVT",field,from:before,to:value});x.flightInfoLog=log.slice(0,240);
  x[field]=value;x[field+"Source"]="SITADOC_MVT";x[field+"UpdatedAt"]=at;summary.set.push(field);return true;
}

// Applique un MVT à un vol CDG au départ. ATD = calage retiré, ATA = calage mis (heure d'arrivée à la porte), en heure locale de chaque aéroport.
export function applyMvt(x,mvt,date,at=new Date().toISOString()){
  const summary={set:[],kept:[]},origin=upper(x.dep||x.origin||"CDG"),dest=upper(x.dest||x.destination||""),oz=AIRPORT_TZ[origin]||"Europe/Paris",dz=AIRPORT_TZ[dest]||oz;
  let changed=false;
  if(mvt.station===origin&&mvt.ad){
    changed=put(x,"atd",utcToLocal(mvt.ad.off,date,oz),at,summary)||changed;
    if(mvt.ad.air)changed=put(x,"takeoff",utcToLocal(mvt.ad.air,date,oz),at,summary)||changed;
    if(mvt.ea&&!clean(x.ata))changed=put(x,"eta",utcToLocal(mvt.ea,date,dz),at,summary)||changed;
  }
  if(dest&&mvt.station===dest&&mvt.aa){
    if(mvt.aa.land)changed=put(x,"landing",utcToLocal(mvt.aa.land,date,dz),at,summary)||changed;
    if(mvt.aa.block)changed=put(x,"ata",utcToLocal(mvt.aa.block,date,dz),at,summary)||changed;
  }
  return {changed,...summary};
}

const sameToken=(a,b)=>{a=String(a||"");b=String(b||"");if(!a||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
export function sitadocAuthorized(request,env){return Boolean(env?.SITADOC_TOKEN)&&sameToken(request.headers.get("x-sitadoc-token"),env.SITADOC_TOKEN)}

// messages: [{flight:"LO334/06", text:"LO334/06.SPLVN.WAW\nAA0718/0724", receivedAt:"2026/10/06 09:30"}]
export async function ingestMvt(env,messages,{nowIso=new Date().toISOString(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const list=(Array.isArray(messages)?messages:[]).slice(0,100),results=[],byDate=new Map();
  for(const m of list){
    const mvt=parseMvt(m?.text);if(!mvt){results.push({flight:clean(m?.flight),status:"NOT_MVT"});continue}
    const date=flightDateFromDay(mvt.day,m?.receivedAt||nowIso.slice(0,10).replace(/-/g,"/"));
    if(!date){results.push({flight:mvt.airline+mvt.number,status:"NO_DATE"});continue}
    if(!byDate.has(date)){const {results:rows=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();byDate.set(date,rows)}
    const wanted=mvt.airline+String(Number(mvt.number)),row=byDate.get(date).find(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}const a=upper(x.airline||r.airline),f=upper(x.flight||r.flight_number),n=(f.startsWith(a)?f.slice(a.length):f).replace(/\D/g,"");return a+String(Number(n))===wanted});
    if(!row){results.push({flight:wanted,date,status:"NO_FLIGHT"});continue}
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const r=applyMvt(x,mvt,date,nowIso);
    if(r.changed&&!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();
    results.push({flight:wanted,date,status:r.changed?"UPDATED":"NO_CHANGE",set:r.set,kept:r.kept});
  }
  return {ok:true,received:list.length,updated:results.filter(r=>r.status==="UPDATED").length,results};
}
