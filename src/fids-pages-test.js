// Diagnostic LECTURE SEULE : pages par vol de FIDS (flightradar.live) comparées à la ligne du flux général. N'écrit rien.
// GET /api/admin/fids-pages?list=AH1063:ORN:20:00,AH1507:ALG:20:10&date=2026-10-06 (vol:destination:STD)
import {getFeed,indexFeed,pickFeedRow} from "./fids-atd-sweep.js";

const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const clean=v=>String(v??"").replace(/\s+/g," ").trim(),upper=v=>clean(v).toUpperCase();
const textOf=h=>clean(String(h||"").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&"));
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})\s*$/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

// Lit « Flight Departure Times … Scheduled hh:mm Estimated hh:mm [Actual hh:mm] » et la partie arrivée dans le texte de la page.
export function parsePageText(text){
  const t=clean(text),dep=t.split("Flight Departure Times")[1]?.split("Flight Arrival Times")[0]||"",arr=t.split("Flight Arrival Times")[1]||"";
  const pick=(s,k)=>{const m=s.match(new RegExp(k+"\\s*:?\\s*(\\d{1,2}:\\d{2})","i"));return m?hhmm(m[1]):""};
  const status=(t.match(/\b(Active|Scheduled|Landed|Cancelled|Canceled|Diverted|Unknown|Incident)\b/)||[])[1]||"";
  return {status,dep:{scheduled:pick(dep,"Scheduled"),estimated:pick(dep,"Estimated"),actual:pick(dep,"Actual")},arr:{scheduled:pick(arr,"Scheduled"),estimated:pick(arr,"Estimated"),actual:pick(arr,"Actual")},terminalGate:(dep.match(/Terminal\s*(\S+)\s*Gate\s*(\S+)/i)||[]).slice(1,3).join("/")};
}
export function parseList(list){
  return String(list||"").split(",").map(s=>s.trim()).filter(Boolean).map(s=>{const m=s.match(/^([A-Za-z0-9]{2,3}\d{1,4}[A-Za-z]?):([A-Za-z]{3}):(\d{2}):(\d{2})$/);return m?{flight:upper(m[1]),dest:upper(m[2]),std:`${m[3]}:${m[4]}`}:null}).filter(Boolean).slice(0,12);
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i])}}));return out}

export async function runFidsPages({list="",date="",fetchImpl=fetch,nowMs=Date.now()}={}){
  const items=parseList(list),d=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:parisDate(nowMs);
  if(!items.length)return {ok:false,error:"list=VOL:DEST:HH:MM,… requis"};
  const feed=await getFeed({fetchImpl,nowMs}),index=feed.rows?indexFeed(feed.rows,d):new Map();
  const rows=await mapLimit(items,2,async it=>{
    const url=`https://fids.flightradar.live/flight-status/${it.flight}/CDG/${it.dest}/${d.replace(/-/g,"")}${it.std.replace(":","")}`;
    const fr=pickFeedRow(index,{designator:it.flight,std:it.std}),anyFeed=(index.get(it.flight)||[]).map(r=>hhmm(r.dep_time));
    const out={...it,url,feed:fr?{dep_time:hhmm(fr.dep_time),dep_estimated:hhmm(fr.dep_estimated),dep_actual:hhmm(fr.dep_actual),arr_estimated:hhmm(fr.arr_estimated),arr_actual:hhmm(fr.arr_actual),status:fr.status}:null,feedOtherTimes:fr?undefined:anyFeed};
    try{const r=await fetchImpl(url,{headers:{accept:"text/html,*/*","user-agent":UA},redirect:"follow"});const txt=textOf(await r.text());
      out.page={httpStatus:r.status,...(r.status===200?parsePageText(txt):{note:txt.slice(0,120)})}}
    catch(e){out.page={error:String(e?.message||e).slice(0,100)}}
    return out;
  });
  return {ok:true,mode:"FIDS_PAGES_NO_WRITE",date:d,feedStatus:feed.status,rows};
}
