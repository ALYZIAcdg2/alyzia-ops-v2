// Restaure l'immatriculation des vols qui l'ont perdue (nettoyage REG_DUPLICATE d'un D-AIHV recopié sur plusieurs vols) à partir de leur propre journal :
// la dernière valeur écrite par le TABLEAU FR24 (source FR24BOARD), la seule source fiable. Refusée si une autre valeur identique existe à moins de 2 h.
import {isJunkRegistration} from "./registration-guard.js";
import {normRegId,sameRegNearby} from "./reg-nearby.js";
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const regOf=x=>clean(x?.reg||x?.registration||x?.aircraftRegistration);
// Immatriculations connues pour être de mauvaises lectures de la page FR24 (D-AIHV recopiée sur des dizaines de vols CDG). Retirées si la source n'est ni le tableau FR24 ni une saisie manuelle.
export const KNOWN_BAD_REGS=new Set(["DAIHV"]);
const TRUSTED=/MANUAL|FR24BOARD/;
export const isKnownBad=v=>KNOWN_BAD_REGS.has(normRegId(v));
export function planClear(rows){return rows.filter(r=>{const x=r.x||{};return isKnownBad(regOf(x))&&!TRUSTED.test(upper(x.regSource||x.registrationSource))})}
const BLANK={reg:"",registration:"",aircraftRegistration:""};
export function lastBoardReg(x){
  const log=Array.isArray(x?.flightInfoLog)?x.flightInfoLog:[];
  const hit=log.find(l=>l&&l.field==="reg"&&/FR24BOARD/.test(upper(l.source))&&clean(l.to)&&!isJunkRegistration(l.to)&&!isKnownBad(l.to));
  return hit?{reg:upper(hit.to),at:hit.at}:null;
}
export function planRestore(rows,{clear=[]}={}){
  const clearSet=new Set(clear),parsed=rows.map(r=>({...r,x:clearSet.has(r)?{...(r.x||{}),...BLANK}:(r.x||{})})),cands=[];
  for(const r of parsed){if(regOf(r.x))continue;if(upper(r.x.origin||"CDG")!=="CDG")continue;const c=lastBoardReg(r.x);if(c)cands.push({r,...c})}
  const out=[],skipped=[];
  for(const c of cands){
    const others=parsed.filter(p=>p!==c.r&&regOf(p.x)).map(p=>({std:p.std||p.x.std,x:p.x})).concat(cands.filter(o=>o!==c).map(o=>({std:o.r.std||o.r.x.std,x:{reg:o.reg,origin:"CDG"}})));
    if(sameRegNearby(others,{reg:c.reg,std:c.r.std||c.r.x.std}))skipped.push({flight:c.r.flight_number,reg:c.reg,reason:"DUPLICATE_NEARBY"});
    else out.push(c);
  }
  return {restore:out,skipped};
}
export async function restoreRegs(env,{date="",dryRun=true}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date)||parisDate();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {identity:r.identity,flight_number:r.flight_number,std:r.std,x}});
  const clear=planClear(rows),{restore,skipped}=planRestore(rows,{clear}),at=new Date().toISOString();
  if(!dryRun)for(const r of clear){
    const x=r.x,from=regOf(x);
    for(const k of ["reg","registration","aircraftRegistration","regSource","registrationSource","regUpdatedAt","registrationUpdatedAt"])delete x[k];
    (x.flightInfoLog??=[]).unshift({at,source:"REG_CLEARED_KNOWN_BAD",field:"reg",from,to:""});x.flightInfoLog=x.flightInfoLog.slice(0,240);
    r.dirty=true;
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  if(!dryRun)for(const c of restore){
    const x=c.r.x;x.reg=c.reg;x.registration=c.reg;x.aircraftRegistration=c.reg;x.regSource="PUBLIC_LIVE:FR24BOARD";x.registrationSource="PUBLIC_LIVE:FR24BOARD";x.regUpdatedAt=at;
    (x.flightInfoLog??=[]).unshift({at,source:"REG_RESTORED",field:"reg",from:"",to:c.reg});x.flightInfoLog=x.flightInfoLog.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),c.r.identity).run();
  }
  return {ok:true,mode:dryRun?"REG_RESTORE_DRY_RUN":"REG_RESTORE_APPLIED",date:day,flights:rows.length,toClear:clear.length,cleared:dryRun?0:clear.length,clearItems:clear.map(r=>({flight:r.flight_number,reg:regOf(r.x)})),toRestore:restore.length,restored:dryRun?0:restore.length,items:restore.map(c=>({flight:c.r.flight_number,reg:c.reg,from:c.at})),skipped};
}
