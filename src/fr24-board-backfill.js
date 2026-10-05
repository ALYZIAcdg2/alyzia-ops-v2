// Rattrapage des portes manquantes depuis le tableau des départs FR24 de CDG (vols partis ou à venir du jour).
// GET /api/admin/board-backfill?date=AAAA-MM-JJ        : aperçu, n'écrit rien
// GET /api/admin/board-backfill?date=AAAA-MM-JJ&apply=1 : écrit les portes trouvées
import {fetchBoardRange,indexRows,matchRow,gateValue} from "./fr24-board.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};

export async function backfillBoardGates(env,{date,apply=false,fetchImpl=fetch,maxPages=8}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return {ok:false,error:"date=AAAA-MM-JJ requis"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std`).bind(day).all();
  const todo=[];
  for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}
    if(upper(x.origin||"CDG")!=="CDG"||gateValue(x)||manual(x,"gate"))continue;
    const airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    todo.push({r,x,f:{date:day,airline,number,designator,std:hhmm(x.std||r.std)}});
  }
  const stdList=todo.map(z=>hhmm(z.f.std)).filter(Boolean).sort(),base={ok:true,mode:apply?"BOARD_GATE_BACKFILL_APPLY":"BOARD_GATE_BACKFILL_PREVIEW",date:day,flights:results.length,withoutGate:todo.length,missingStdRange:stdList.length?[stdList[0],stdList[stdList.length-1]]:null,missingSample:todo.slice(0,8).map(z=>z.f.designator+" "+z.f.std)};
  if(!todo.length)return {...base,filled:0,note:"Aucun vol sans porte"};
  const [y,mo,d]=day.split("-").map(Number),dayUtc=Date.UTC(y,mo-1,d)/1000,stds=todo.map(z=>hhmm(z.f.std)).filter(Boolean).map(t=>Number(t.slice(0,2))*3600+Number(t.slice(3))*60);
  const first=stds.length?Math.min(...stds):0,last=stds.length?Math.max(...stds):86399;
  const nowSec=Math.floor(Date.now()/1000),fromSec=Math.max(dayUtc+first-3*3600,nowSec-20*3600),stopAfter=dayUtc+last-3600; // marge UTC/Paris : la page commence à fromSec, on s'arrête après le dernier vol à rattraper
  const range=await fetchBoardRange({fromSec,stopAfterSec:stopAfter,maxPages,fetchImpl});
  if(!range.rows.length)return {...base,filled:0,verdict:range.verdict,httpStatus:range.httpStatus,fromSec,fromIso:new Date(fromSec*1000).toISOString(),pagesInfo:range.info,note:"Le tableau FR24 n'a rien renvoyé"};
  const index=indexRows(range.rows),at=new Date().toISOString(),filled=[];let notFound=0;
  for(const z of todo){
    const row=matchRow(index,z.f),g=upper(row?.gate);
    if(!g){notFound++;continue}
    z.x.gate=g;z.x.gateSource="PUBLIC_LIVE:FR24BOARD";z.x.gateUpdatedAt=at;
    const log=Array.isArray(z.x.flightInfoLog)?z.x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"gate",from:"",to:g});z.x.flightInfoLog=log.slice(0,240);
    if(apply)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(z.x),z.r.identity).run();
    filled.push({flight:z.f.designator,std:z.f.std,gate:g});
  }
  return {...base,verdict:range.verdict,pages:range.pages,boardRows:range.rows.length,fromIso:new Date(fromSec*1000).toISOString(),pagesInfo:range.info,filled:filled.length,notFoundOnBoard:notFound,written:apply,sample:filled.slice(0,15)};
}
