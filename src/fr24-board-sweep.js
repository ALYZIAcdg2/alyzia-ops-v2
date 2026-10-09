// Passage « tableau FR24 » sur TOUS les vols CDG du jour, à chaque cron : l'index du tableau est en cache (8 min), donc aucune requête de plus.
// Met à jour porte, immatriculation, type d'avion, ETD (vol pas encore parti) et heure de décollage (vol parti) quand ils changent ;
// retire un ATD écrit par erreur à partir du tableau. Jamais une saisie manuelle. Évite de dépendre de l'ordre de priorité des vols.
import {getBoard,matchRow,gateValue,fetchBoardRange,indexRows} from "./fr24-board.js";
import {isJunkRegistration} from "./registration-guard.js";
import {noteActualAircraft} from "./aircraft-change.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const parisDate=(ms)=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const parisClock=sec=>{const p=new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(sec*1000)),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.hour}:${m.minute}`};
const normReg=v=>upper(v).replace(/[^A-Z0-9]/g,"");
// STD du jour déjà dépassée (heure de Paris) : un « estimé = programmé » du tableau n'est alors pas crédible pour un vol pas encore parti.
export function stdAlreadyPassed(std,nowMs){const m=/^(\d{2}):(\d{2})$/.exec(clean(std));if(!m)return false;const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(nowMs)).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)>Number(m[1])*60+Number(m[2])}
const regOf=x=>clean(x?.reg||x?.registration||x?.aircraftRegistration);


// Le tableau lu à chaque passage ne remonte que de 3 h : un vol d'hier soir retardé après minuit y est hors fenêtre (TU2655, STD 19:45 lu à 01:50). Une lecture du tableau depuis sa STD (2 pages au plus, au plus toutes les 8 min, seulement si un tel vol existe et que le tableau n'est pas en pause) le rapproche.
let lateCache=null;
const parisEpochSec=(date,clock)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date),c=/^(\d{2}):(\d{2})$/.exec(clock);if(!m||!c)return 0;const guess=Date.UTC(+m[1],+m[2]-1,+m[3],+c[1],+c[2]);const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",day:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess)).map(x=>[x.type,x.value]));let d=(Number(p.hour)*60+Number(p.minute))-(+c[1]*60+ +c[2]);if(d>720)d-=1440;if(d<-720)d+=1440;return Math.floor((guess-d*60000)/1000)};
async function lateRows(pending,{fetchImpl,nowMs}){
  if(!pending.length)return [];
  if(lateCache&&nowMs-lateCache.at<8*60000)return lateCache.rows;
  const stds=pending.map(f=>parisEpochSec(f.date,f.std)).filter(Boolean);if(!stds.length)return [];
  let rows=[];try{const r=await fetchBoardRange({fromSec:Math.min(...stds)-1800,maxPages:2,stopAfterSec:Math.max(...stds)+3600,fetchImpl});rows=r.rows||[]}catch{}
  lateCache={at:nowMs,rows};return rows;
}

export async function sweepBoardToday(env,{fetchImpl=fetch,nowMs=Date.now(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const board=await getBoard({fetchImpl,nowMs});
  if(!board.index)return {ok:true,status:board.status,checked:0,updated:0};
  // Aujourd'hui, et hier pour les vols d'hier soir retardés après minuit et pas encore atterris (le tableau les rapproche par leur date et leur STD d'origine).
  const date=parisDate(nowMs),yesterday=parisDate(nowMs-86400000),{results:all=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(date,yesterday).all();
  const results=all.filter(r=>r.flight_date!==yesterday||(()=>{try{const x=JSON.parse(r.data_json||"{}");return !clean(x.ata)&&!clean(x.landing)}catch{return false}})());
  // Vols d'hier pas retrouvés dans le tableau habituel : lecture complémentaire depuis leur STD.
  let index=board.index;
  {const pending=[];for(const r of results){if(r.flight_date===date)continue;let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}if(upper(x.origin||"CDG")!=="CDG")continue;
    const airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,""),f={date:r.flight_date,airline,number,designator,std:hhmm(x.std||r.std)};
    if(!matchRow(board.index,f))pending.push(f)}
   const extra=await lateRows(pending,{fetchImpl,nowMs});
   if(extra.length){const merged=new Map(board.index);for(const [k,v] of indexRows(extra))merged.set(k,[...(merged.get(k)||[]),...v]);index=merged}}
  const at=new Date(nowMs).toISOString(),counts={gate:0,reg:0,type:0,etd:0,takeoff:0,atdRemoved:0};let checked=0,updated=0;
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(upper(x.origin||"CDG")!=="CDG")continue;
    const airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    const rowDate=r.flight_date||date,f={date:rowDate,airline,number,designator,std:hhmm(x.std||r.std)},row=matchRow(index,f);
    let changed=false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
    const note=(field,from,to)=>{log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field,from,to});changed=true;counts[field==="aircraft"?"type":field]=(counts[field==="aircraft"?"type":field]||0)+1};
    // ATD écrit à partir du tableau par une version précédente : c'était l'heure de décollage.
    if(clean(x.atd)&&/FR24BOARD/.test(upper(x.atdSource))&&!manual(x,"atd")){log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"atd",from:clean(x.atd),to:""});delete x.atd;delete x.atdSource;delete x.atdUpdatedAt;delete x.atdConfirmed;delete x.atdSources;changed=true;counts.atdRemoved++}
    // ETD écrit par le tableau avec l'heure de la STD (ancienne version) : il avait remplacé le vrai ETD. On remet le dernier ETD d'avant, ou on le retire.
    {const std=hhmm(x.std||r.std),cur=hhmm(x.etd||x.edt);
      if(std&&cur===std&&/FR24BOARD/.test(upper(x.etdSource))&&!manual(x,"etd")){
        const e=log.find(l=>l&&l.field==="etd"&&/FR24BOARD/.test(upper(l.source))&&hhmm(l.to)===std),prev=e?hhmm(e.from):"";
        const back=prev&&prev!==std?prev:"";
        log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from:cur,to:back});
        if(back){x.etd=back;x.edt=back;x.etdSource="PUBLIC_LIVE:ETD_RESTORED";x.etdUpdatedAt=at}else{delete x.etd;delete x.edt;delete x.etdSource;delete x.etdUpdatedAt}
        changed=true;counts.etdRestored=(counts.etdRestored||0)+1}}
    // Le tableau est repassé à la STD (plus de retard annoncé) alors que notre ETD vient de lui : cet ETD est périmé, on le retire (vérifié sur FR24 : LO336, ETD 19:59 chez nous, 19:45 sur FR24).
    if(row&&row.time&&row.time===row.std&&row.status!=="departed"&&row.status!=="canceled"&&!clean(x.atd)&&!clean(x.takeoff)&&!manual(x,"etd")){
      const cur=hhmm(x.etd||x.edt),std=hhmm(x.std||r.std);
      // Pas d'effacement une fois la STD dépassée : AT779 (STD 13:05, ETD 13:38 juste) voyait son ETD effacé puis remis en boucle quand le tableau repassait à 13:05.
      if(cur&&cur!==std&&/FR24BOARD/.test(upper(x.etdSource))&&!(rowDate<date||stdAlreadyPassed(std,nowMs))){
        log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from:cur,to:""});
        delete x.etd;delete x.edt;delete x.etdSource;delete x.etdUpdatedAt;changed=true;counts.etdCleared=(counts.etdCleared||0)+1}}
    if(row){
      checked++;
      const g=upper(row.gate);if(g&&g!==upper(gateValue(x))&&!manual(x,"gate")){note("gate",gateValue(x),g);x.gate=g;x.gateSource="PUBLIC_LIVE:FR24BOARD";x.gateUpdatedAt=at}
      const rg=upper(row.reg);if(rg&&!isJunkRegistration(rg)&&normReg(rg)!==normReg(regOf(x))&&!manual(x,"reg")){note("reg",regOf(x),rg);x.reg=rg;x.registration=rg;x.aircraftRegistration=rg;x.regSource="PUBLIC_LIVE:FR24BOARD";x.regUpdatedAt=at}
      const ty=upper(row.type);if(ty&&!manual(x,"aircraftActual")){const before=clean(x.aircraftActual);if(noteActualAircraft(x,ty,"PUBLIC_LIVE:FR24BOARD",at)&&clean(x.aircraftActual)!==before){const l=log[0];changed=true;counts.type++;log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"aircraft",from:before,to:clean(x.aircraftActual)});void l}}
      if(row.time&&row.status==="departed"){
        const tk=parisClock(row.time);if(!clean(x.takeoff)||(/FR24BOARD/.test(upper(x.takeoffSource))&&clean(x.takeoff)!==tk)){if(!manual(x,"takeoff")){note("takeoff",clean(x.takeoff),tk);x.takeoff=tk;x.takeoffSource="PUBLIC_LIVE:FR24BOARD";x.takeoffUpdatedAt=at}}
      }else if(row.time&&row.time!==row.std&&row.status!=="departed"&&row.status!=="canceled"&&!clean(x.atd)&&!clean(x.takeoff)&&!manual(x,"etd")){
        const e=parisClock(row.time),from=clean(x.etd||x.edt),stale=nowMs-(Date.parse(x.etdUpdatedAt||0)||0)>15*60000;
        if(e!==from&&(!from||/FR24BOARD/.test(upper(x.etdSource))||(stale&&!/FIDS/.test(upper(x.etdSource))))){note("etd",from,e);x.etd=e;x.edt=e;x.etdSource="PUBLIC_LIVE:FR24BOARD";x.etdUpdatedAt=at;x.etdTimeBasis="CDG_LOCAL"}
      }
    }
    if(!changed)continue;
    x.flightInfoLog=log.slice(0,240);updated++;
    if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  return {ok:true,status:"OK",date,flights:results.length,checked,updated,counts};
}
