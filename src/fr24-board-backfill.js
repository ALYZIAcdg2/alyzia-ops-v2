// Rattrapage et contrôle depuis le tableau des départs FR24 de CDG (vols du jour, partis ou à venir) : portes, immatriculations, types d'avion.
// GET /api/admin/board-backfill?date=AAAA-MM-JJ[&fields=gate,reg,type]          : aperçu, n'écrit rien
// GET /api/admin/board-backfill?date=AAAA-MM-JJ[&fields=...]&apply=1            : écrit ce qui manque
// Seuls les champs vides sont remplis (jamais une saisie manuelle). Les immatriculations déjà présentes mais différentes du tableau sont seulement signalées (`regMismatch`).
import {fetchBoardRange,indexRows,matchRow,gateValue} from "./fr24-board.js";
import {isJunkRegistration} from "./registration-guard.js";
import {noteActualAircraft} from "./aircraft-change.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const PLACEHOLDER=/^(—|–|-+|n\/?a|tbd|\?+|null|none|unknown|non renseign[ée])$/i;
export const regValue=x=>{const v=clean(x?.reg||x?.registration||x?.aircraftRegistration);return !v||PLACEHOLDER.test(v)||isJunkRegistration(v)?"":v};
export const typeValue=x=>{const v=clean(x?.aircraftActual||x?.aircraft);return !v||PLACEHOLDER.test(v)?"":v};
const normReg=v=>upper(v).replace(/[^A-Z0-9]/g,"");

export async function backfillBoardGates(env,{date,apply=false,fields="gate,reg,type",fetchImpl=fetch,maxPages=8,nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return {ok:false,error:"date=AAAA-MM-JJ requis"};
  const want=new Set(String(fields||"").toLowerCase().split(/[,\s]+/).filter(f=>["gate","reg","type"].includes(f)));if(!want.size)return {ok:false,error:"fields = gate, reg et/ou type"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std`).bind(day).all();
  const todo=[],count={gate:0,reg:0,type:0};
  for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}
    if(upper(x.origin||"CDG")!=="CDG")continue;
    const miss={gate:want.has("gate")&&!gateValue(x)&&!manual(x,"gate"),reg:want.has("reg")&&!regValue(x)&&!manual(x,"reg"),type:want.has("type")&&!typeValue(x)&&!manual(x,"aircraftActual")};
    const check=want.has("reg")&&Boolean(regValue(x));
    if(!miss.gate&&!miss.reg&&!miss.type&&!check)continue;
    for(const k of Object.keys(miss))if(miss[k])count[k]++;
    const airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    todo.push({r,x,miss,f:{date:day,airline,number,designator,std:hhmm(x.std||r.std)}});
  }
  const needFill=todo.filter(z=>z.miss.gate||z.miss.reg||z.miss.type);
  const base={ok:true,mode:apply?"BOARD_BACKFILL_APPLY":"BOARD_BACKFILL_PREVIEW",date:day,fields:[...want],flights:results.length,withoutGate:count.gate,withoutReg:count.reg,withoutType:count.type,missingSample:needFill.slice(0,8).map(z=>z.f.designator+" "+z.f.std+" ["+Object.keys(z.miss).filter(k=>z.miss[k]).join("+")+"]")};
  if(!todo.length)return {...base,filled:0,note:"Rien à rattraper ni à contrôler"};
  // Heure UTC approximative de chaque vol (Paris = UTC+2 l'été, +1 l'hiver : marge d'une heure). FR24 gratuit ne lit pas plus de ~12 h en arrière : les vols plus anciens ne sont pas rattrapables.
  const [y,mo,d]=day.split("-").map(Number),dayUtc=Date.UTC(y,mo-1,d)/1000,nowSec=Math.floor(nowMs/1000),minStart=nowSec-12*3600;
  const withTime=todo.map(z=>{const t=hhmm(z.f.std);return {z,utc:t?dayUtc+Number(t.slice(0,2))*3600+Number(t.slice(3))*60-7200:0}}).filter(w=>w.utc);
  const tooOld=withTime.filter(w=>w.utc-1800<minStart),recoverable=withTime.filter(w=>w.utc-1800>=minStart);
  base.tooOld=tooOld.filter(w=>w.z.miss.gate||w.z.miss.reg||w.z.miss.type).map(w=>w.z.f.designator+" "+w.z.f.std);
  if(!recoverable.length)return {...base,filled:0,note:"Les vols concernés sont trop anciens pour le tableau FR24 (fenêtre gratuite d'environ 12 h)"};
  const fromSec=Math.min(...recoverable.map(w=>w.utc))-1800,stopAfter=Math.max(...recoverable.map(w=>w.utc))+3600;
  const inWindow=new Set(recoverable.map(w=>w.z.r.identity));
  const range=await fetchBoardRange({fromSec,stopAfterSec:stopAfter,maxPages,fetchImpl});
  const common={verdict:range.verdict,pages:range.pages,boardRows:range.rows.length,fromIso:new Date(range.fromSecUsed*1000).toISOString(),pagesInfo:range.info};
  if(!range.rows.length)return {...base,...common,filled:0,note:"Le tableau FR24 n'a rien renvoyé"};
  const index=indexRows(range.rows),at=new Date().toISOString(),done={gate:0,reg:0,type:0},sample=[],mismatch=[],unfilled=[];let notFound=0;
  const logTo=(x,field,from,to)=>{const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field,from,to});x.flightInfoLog=log.slice(0,240)};
  for(const z of todo){
    if(!inWindow.has(z.r.identity))continue;
    const row=matchRow(index,z.f),needs=Object.keys(z.miss).filter(k=>z.miss[k]);if(!row){if(needs.length){notFound++;unfilled.push({flight:z.f.designator,std:z.f.std,missing:needs.join("+"),reason:"absent du tableau FR24 (autre jour, autre heure prévue ou non listé)"})}continue}
    let changed=false;const got={};
    const g=upper(row.gate);if(z.miss.gate&&g){z.x.gate=g;z.x.gateSource="PUBLIC_LIVE:FR24BOARD";z.x.gateUpdatedAt=at;logTo(z.x,"gate","",g);done.gate++;got.gate=g;changed=true}
    const rg=upper(row.reg);
    if(z.miss.reg&&rg&&!isJunkRegistration(rg)){z.x.reg=rg;z.x.registration=rg;z.x.aircraftRegistration=rg;z.x.regSource="PUBLIC_LIVE:FR24BOARD";z.x.regUpdatedAt=at;logTo(z.x,"reg","",rg);done.reg++;got.reg=rg;changed=true}
    else if(!z.miss.reg&&rg&&want.has("reg")&&normReg(regValue(z.x))!==normReg(rg))mismatch.push({flight:z.f.designator,std:z.f.std,adminReg:regValue(z.x),fr24Reg:rg});
    const ty=upper(row.type);if(z.miss.type&&ty&&noteActualAircraft(z.x,ty,"PUBLIC_LIVE:FR24BOARD",at)){logTo(z.x,"aircraft","",ty);done.type++;got.type=ty;changed=true}
    {const still=needs.filter(k=>!got[k]);if(still.length)unfilled.push({flight:z.f.designator,std:z.f.std,missing:still.join("+"),reason:"FR24 n'a pas encore cette information ("+still.map(k=>k==='gate'?'porte':k==='reg'?'immatriculation':'type').join(', ')+")"})}
    if(changed){if(apply)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(z.x),z.r.identity).run();sample.push({flight:z.f.designator,std:z.f.std,...got})}
  }
  return {...base,...common,filled:done.gate+done.reg+done.type,filledGate:done.gate,filledReg:done.reg,filledType:done.type,notFoundOnBoard:notFound,unfilled:unfilled.slice(0,25),regMismatch:mismatch.slice(0,20),regMismatchCount:mismatch.length,written:apply,sample:sample.slice(0,15)};
}
