// Lecture seule : ce que le collecteur Sitadoc a enregistré pour les vols du jour, comparé à nos valeurs (immat, porte, type, ATD, décollage, ETD).
import {sameAircraft} from "./aircraft-change.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase(),norm=v=>upper(v).replace(/[^A-Z0-9]/g,"");
// Type Sitadoc : une ou deux lignes de codes IATA de 3 caractères, parfois collées (« 32032A » = 320 + 32A, « 7M8320 » = 7M8 + 320).
export function sitadocTypes(raw){const t=upper(raw);if(!t)return [];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);return t.length>3&&t.length%3===0?t.match(/.{3}/g):[t]}
// Porte Sitadoc : « 04/BUS » = porte bus 4 ; « D69 » ; les zéros de tête et le suffixe /BUS ne comptent pas.
export function normGate(v){return upper(v).replace(/\/BUS$/,"").replace(/^0+(?=\d)/,"").replace(/[^A-Z0-9]/g,"")}
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function compareSitadoc(rows){
  const out={flights:rows.length,withSitadoc:0,lastAt:null,identical:{reg:0,gate:0,type:0},different:{reg:[],gate:[],type:[]},atd:{fromSitadoc:0,other:[]},takeoff:{fromSitadoc:0},etdFromSitadoc:0,tsatLater:[]};
  for(const x of rows){
    const s=x.sitadoc;if(!s)continue;out.withSitadoc++;
    if(!out.lastAt||s.at>out.lastAt)out.lastAt=s.at;
    const name=x.flight||"?";
    const info=(field)=>({ours:clean(x[field]),source:clean(x[field+"Source"]),at:clean(x[field+"UpdatedAt"])});
    const cmp=(key,ours,theirs,same)=>{if(!norm(theirs)||!norm(ours))return;if(same(ours,theirs))out.identical[key]++;else out.different[key].push({flight:name,ours:clean(ours),sitadoc:clean(theirs),oursSource:key==="reg"?clean(x.regSource||x.registrationSource):key==="gate"?clean(x.gateSource):clean(x.aircraftActualSource||x.aircraftSource),oursAt:key==="reg"?clean(x.regUpdatedAt):key==="gate"?clean(x.gateUpdatedAt):clean(x.aircraftActualUpdatedAt||x.aircraftUpdatedAt)})};
    cmp("reg",x.reg||x.registration,s.reg,(a,b)=>norm(a)===norm(b));
    cmp("gate",x.gate,s.gate,(a,b)=>normGate(a)===normGate(b));
    const ot=upper(x.aircraftActual||x.aircraft),codes=sitadocTypes(s.type);cmp("type",ot,codes.join(" "),(a)=>codes.some(c=>sameAircraft(a,c)));
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
