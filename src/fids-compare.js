// Comparaison LECTURE SEULE : le flux FIDS flightradar.live (CDG départs) contre nos vols du jour. N'écrit rien.
// GET /api/admin/fids-compare : écart entre dep_actual du flux et notre ATD / décollage, et vols où le flux apporterait un ATD qui manque.
import {indexFeed as indexFeedByDate,pickFeedRow,plausibleActual,loadFidsState} from "./fids-atd-sweep.js";
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const URL_="https://fids.flightradar.live/api/schedules/departures/CDG";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})(?!.*\d{1,2}:\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const mins=h=>{const m=/^(\d{2}):(\d{2})$/.exec(h||"");return m?+m[1]*60+ +m[2]:null};
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const diff=(a,b)=>{const x=mins(a),y=mins(b);if(x==null||y==null)return null;let d=x-y;if(d>720)d-=1440;if(d<-720)d+=1440;return d};

export function indexFeed(rows){
  const idx=new Map();
  for(const r of Array.isArray(rows)?rows:[]){
    for(const k of [upper(r?.flight_iata),upper(r?.cs_flight_iata)]){if(!k)continue;const a=idx.get(k)||[];a.push(r);idx.set(k,a)}
  }
  return idx;
}
// date (AAAA-MM-JJ) : ne garde que les lignes du flux de ce jour, comme le passage d'écriture ; sans date, toutes les lignes.
export function compareFlights(flights,rows,date=""){
  const idx=indexFeed(date?(Array.isArray(rows)?rows:[]).filter(r=>clean(r?.dep_time).startsWith(date)):rows),out={flights:flights.length,matched:0,feedActual:0,bothAtd:0,gain:0,vsAtd:{},vsTakeoff:{},gateBoth:0,gateSame:0,ata:{feedActual:0,bothAta:0,gain:0,vsAta:{},vsLanding:{},examples:{gain:[],diffAta:[]}},unmatched:[],examples:{gain:[],farFromAtd:[],gateDiff:[]}};
  const bump=(o,d)=>{const k=d==null?"?":Math.abs(d)<=1?"0..1":Math.abs(d)<=3?"2..3":Math.abs(d)<=10?"4..10":">10";o[k]=(o[k]||0)+1};
  for(const f of flights){
    const c=(idx.get(upper(f.designator))||[]).filter(r=>hhmm(r.dep_time)===hhmm(f.std));
    const r=c.find(x=>upper(x.flight_iata)===upper(f.designator))||c[0];
    if(!r){if(out.unmatched.length<40)out.unmatched.push({flight:f.designator,std:f.std,inFeedWithOtherTime:(idx.get(upper(f.designator))||[]).map(x=>hhmm(x.dep_time)).join(",")||null});continue}
    out.matched++;
    // ATA : heure d'arrivée réelle du flux (heure locale de la destination) contre notre ATA et notre atterrissage.
    {const arr=hhmm(r.arr_actual);if(arr){const A=out.ata;A.feedActual++;
      if(f.ata){A.bothAta++;const d=diff(arr,f.ata);bump(A.vsAta,d);if(d!=null&&Math.abs(d)>3&&A.examples.diffAta.length<12)A.examples.diffAta.push({flight:f.designator,dest:f.dest,feedArrActual:arr,ourAta:f.ata,ourAtaSource:f.ataSource,ourLanding:f.landing||""})}
      if(f.landing)bump(A.vsLanding,diff(arr,f.landing));
      if(!f.ata){A.gain++;if(A.examples.gain.length<12)A.examples.gain.push({flight:f.designator,dest:f.dest,feedArrActual:arr,ourLanding:f.landing||"",status:r.status})}}}
    const act=hhmm(r.dep_actual);if(act)out.feedActual++;
    if(act&&f.atd){out.bothAtd++;const d=diff(act,f.atd);bump(out.vsAtd,d);if(d!=null&&Math.abs(d)>3&&out.examples.farFromAtd.length<12)out.examples.farFromAtd.push({flight:f.designator,std:f.std,feedActual:act,ourAtd:f.atd,ourTakeoff:f.takeoff||""})}
    if(act&&f.takeoff)bump(out.vsTakeoff,diff(act,f.takeoff));
    if(act&&!f.atd){out.gain++;if(out.examples.gain.length<12)out.examples.gain.push({flight:f.designator,std:f.std,feedActual:act,ourTakeoff:f.takeoff||"",status:r.status})}
    const g=upper(r.dep_gate);if(g&&f.gate){out.gateBoth++;if(upper(f.gate)===g)out.gateSame++;else if(out.examples.gateDiff.length<12)out.examples.gateDiff.push({flight:f.designator,ours:f.gate,feed:g})}
  }
  return out;
}
// Fenêtre couverte par le flux : première et dernière heure prévue, et nombre de lignes avec heure réelle par heure.
export function feedWindow(rows){
  const a=Array.isArray(rows)?rows:[],times=a.map(r=>clean(r?.dep_time)).filter(Boolean).sort(),byHour={};
  for(const r of a){const h=hhmm(r?.dep_time).slice(0,2);if(!h)continue;const o=byHour[h]||(byHour[h]={rows:0,actual:0});o.rows++;if(clean(r.dep_actual))o.actual++}
  return {first:times[0]||null,last:times[times.length-1]||null,byHour};
}
export async function runFidsCompare(env,{fetchImpl=fetch,nowMs=Date.now(),flight="",date:dateParam=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const r=await fetchImpl(URL_,{headers:{accept:"application/json","user-agent":UA,referer:"https://flightradar.live/"},redirect:"follow"});
  if(r.status!==200)return {ok:true,mode:"FIDS_COMPARE_NO_WRITE",verdict:"HTTP_"+r.status};
  const rows=await r.json(),date=/^\d{4}-\d{2}-\d{2}$/.test(dateParam)?dateParam:parisDate(nowMs);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const flights=[];
  for(const x of results){let d={};try{d=JSON.parse(x.data_json||"{}")}catch{continue}
    if(upper(d.origin||"CDG")!=="CDG")continue;
    const airline=upper(d.airline||x.airline),designator=upper(d.flight||x.flight_number);
    flights.push({designator:designator.startsWith(airline)?designator:airline+String(x.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,""),std:hhmm(d.std||x.std),atd:hhmm(d.atd),takeoff:hhmm(d.takeoff),ata:hhmm(d.ata),ataSource:clean(d.ataSource),landing:hhmm(d.landing),dest:upper(d.destination||d.dest||""),gate:clean(d.gate),atdSource:clean(d.atdSource),manualAtd:upper(d.atdSource).includes("MANUAL")||Boolean(d.manual?.atd||d.manualOverrides?.atd||d.manual_fields?.atd)})}
  const want=upper(flight).replace(/[^A-Z0-9]/g,"");
  // Décision que prendrait le passage FIDS pour chacun de nos vols de ce numéro (sans rien écrire).
  const decide=f=>{
    const idx=indexFeedByDate(rows,date),row=pickFeedRow(idx,{designator:f.designator,std:f.std});
    if(!row)return {reason:"aucune ligne du flux avec ce numéro et cette STD",feedOtherTimes:(idx.get(upper(f.designator))||[]).map(r=>hhmm(r.dep_time))};
    const act=clean(row.dep_actual);if(!act)return {reason:"le flux n'a pas d'heure réelle",feedStatus:row.status};
    if(f.manualAtd)return {reason:"saisie manuelle : jamais touchée"};
    if(f.atd&&!/FIDS/.test(upper(f.atdSource)))return {reason:"ATD déjà présent d'une autre source",source:f.atdSource,atd:f.atd};
    if(f.atd===hhmm(act))return {reason:"ATD déjà égal à l'heure du flux"};
    const ok=plausibleActual(row,{std:f.std,takeoff:act.startsWith(date)?f.takeoff:"",nowMin:null,nowMs,sameDay:act.startsWith(date)});
    return ok?{reason:"DEVRAIT ÊTRE ÉCRIT au prochain passage",feedActual:hhmm(act)}:{reason:"refusé par le contrôle de plausibilité",feedActual:hhmm(act),std:f.std,takeoff:f.takeoff,dep_time_ts:row.dep_time_ts,dep_actual_ts:row.dep_actual_ts};
  };
  const lastRun=want?await loadFidsState(env):null;
  const explain=want?{flight:want,date,lastFidsRun:lastRun?.at||null,lastFidsStatus:lastRun?.status||null,decisions:flights.filter(f=>upper(f.designator)===want).map(f=>({std:f.std,...decide(f)})),ours:flights.filter(f=>upper(f.designator)===want),feed:(indexFeed(rows).get(want)||[]).map(r=>({flight_iata:r.flight_iata,cs_flight_iata:r.cs_flight_iata,dep_time:r.dep_time,dep_estimated:r.dep_estimated,dep_actual:r.dep_actual,status:r.status,dep_gate:r.dep_gate,arr_iata:r.arr_iata}))}:undefined;
  return {ok:true,mode:"FIDS_COMPARE_NO_WRITE",verdict:"OK",date,feedRows:rows.length,explain,feedWindow:feedWindow(rows),...compareFlights(flights,rows,date)};
}
