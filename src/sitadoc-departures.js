// Tableau « Vols Départ » de Sitadoc CDG (une ligne par vol, heures locales). Colonnes utiles :
//   SCH = horaire compagnie (jamais modifié chez nous) · TSA = TSAT ADP (créneau de départ bloc imposé) · HDB = heure départ bloc (ATD)
//   CODE / HPD = étape du vol et son heure : HTD (horaire compagnie), HED (estimée d'après MVT « ED »), MER (mise en route moteurs),
//   HDB (départ bloc), QTN (décollage). Les informations Immat / Type / Parc / Porte / Passagers sont gardées pour comparaison.
import {put} from "./sitadoc-mvt.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const clock=v=>{const m=/^(\d{1,2}):(\d{2})$/.exec(clean(v));return m?`${String(m[1]).padStart(2,"0")}:${m[2]}`:""};
const designator=(airline,flight)=>{const a=upper(airline),f=upper(flight).replace(/\s+/g,"");const n=(f.startsWith(a)?f.slice(a.length):f.replace(/^[A-Z0-9]{2}/,"")).replace(/\D/g,"");return a+String(Number(n||0))};

// Un vol « TK 1830 » du tableau -> {airline:"TK", number:"1830"}
export function splitFlight(label){const m=/^([A-Z0-9]{2})\s*(\d{1,4})/.exec(upper(label).replace(/\s+/g," "));return m?{airline:m[1],number:String(Number(m[2]))}:null}

export function applyDeparture(x,row,at=new Date().toISOString()){
  const summary={set:[],kept:[],source:"SITADOC"},code=upper(row.code),hpd=clock(row.hpd),hdb=clock(row.hdb);
  let changed=false;
  // ATD : colonne HDB, sinon étape HDB ; décollage : étape QTN. MER (moteurs) et HED (estimée) ne sont pas des faits de départ.
  const atd=hdb||(code==="HDB"?hpd:"");
  if(atd)changed=put(x,"atd",atd,at,summary)||changed;
  if(code==="QTN"&&hpd)changed=put(x,"takeoff",hpd,at,summary)||changed;
  // ETD : étape HED (estimation compagnie) seulement si aucun ETD n'est connu et que le vol n'est pas parti.
  if(code==="HED"&&hpd&&!clean(x.etd)&&!clean(x.atd)&&!clean(x.takeoff))changed=put(x,"etd",hpd,at,summary)||changed;
  const info={at,code,hpd,tsat:clock(row.tsa),reg:upper(row.reg),type:upper(row.type),parking:clean(row.parking),gate:clean(row.gate),counter:clean(row.counter),pax:clean(row.pax)};
  if(JSON.stringify({...x.sitadoc,at:""})!==JSON.stringify({...info,at:""})){x.sitadoc=info;changed=true}
  const norm=v=>upper(v).replace(/[^A-Z0-9]/g,""),diff={};
  if(info.reg&&norm(x.reg||x.registration)&&norm(x.reg||x.registration)!==norm(info.reg))diff.reg={ours:clean(x.reg||x.registration),sitadoc:info.reg};
  if(info.gate&&clean(x.gate)&&norm(x.gate)!==norm(info.gate))diff.gate={ours:clean(x.gate),sitadoc:info.gate};
  const ot=upper(x.aircraftActual||x.aircraft),st=info.type.split(/\s+/)[0];if(st&&ot&&ot!==st)diff.type={ours:ot,sitadoc:info.type};
  return {changed,...summary,diff};
}

// rows: [{date:"2026-10-07", flight:"TK 1830", sch:"07:20", tsa, hdb, code, hpd, reg, type, parking, gate, counter, pax}]
export async function ingestDepartures(env,rows,{nowIso=new Date().toISOString(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const list=(Array.isArray(rows)?rows:[]).slice(0,400),byDate=new Map(),results=[];
  for(const r of list){
    const f=splitFlight(r?.flight),date=clean(r?.date),sch=clock(r?.sch);
    if(!f||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!sch){results.push({flight:clean(r?.flight),status:"BAD_ROW"});continue}
    if(!byDate.has(date)){const {results:rs=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();byDate.set(date,rs)}
    const wanted=f.airline+f.number;
    // STD strictement identique : on ne rapproche jamais deux horaires différents.
    const row=byDate.get(date).find(q=>{let x={};try{x=JSON.parse(q.data_json||"{}")}catch{}return designator(x.airline||q.airline,x.flight||q.flight_number)===wanted&&clock(x.std||q.std)===sch&&upper(x.origin||x.dep||"CDG")==="CDG"});
    if(!row){results.push({flight:wanted,date,sch,status:"NO_FLIGHT"});continue}
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const out=applyDeparture(x,r,nowIso);
    if(out.changed&&!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();
    results.push({flight:wanted,date,sch,status:out.changed?"UPDATED":"NO_CHANGE",set:out.set,kept:out.kept,diff:Object.keys(out.diff).length?out.diff:undefined});
  }
  const diffs=results.filter(r=>r.diff).length;
  return {ok:true,received:list.length,updated:results.filter(r=>r.status==="UPDATED").length,unmatched:results.filter(r=>r.status==="NO_FLIGHT").length,withDifferences:diffs,results};
}
