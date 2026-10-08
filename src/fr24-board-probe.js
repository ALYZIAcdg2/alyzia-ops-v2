// Contrôle en lecture seule du tableau des départs FR24 de CDG : que porte une ligne « atterri » (heure d'atterrissage ? d'arrivée à la porte ?) et quels champs de temps existent.
// Ne touche ni la base, ni le cache, ni la pause du tableau. Deux pages au plus, une lecture au plus toutes les 2 minutes.
import {extractDataPage} from "./fr24-board-parse.js";
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const clean=v=>String(v??"").trim();
const clock=sec=>{const n=Number(sec);if(!Number.isFinite(n)||n<=0)return "";const p=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(n*1000)).map(x=>[x.type,x.value]));return `${p.day}/${p.month} ${p.hour}:${p.minute}`};
const TIMEY=/time|actual|land|arriv|depart|estim|sched|block|runway/i;
let last=0;
export function summarizeFlights(flights){
  const list=Array.isArray(flights)?flights:[],statusCounts={},statusShapes=new Map();
  for(const f of list){const n=clean(f?.status?.name)||"-";statusCounts[n]=(statusCounts[n]||0)+1;if(!statusShapes.has(n))statusShapes.set(n,f?.status)}
  const view=f=>{const o={flight:clean(f?.flightNumber),status:f?.status??null};for(const [k,v] of Object.entries(f||{})){if(k==="status"||!TIMEY.test(k))continue;o[k]=typeof v==="number"&&v>1e9?{raw:v,paris:clock(v)}:v}return o};
  const isLanded=f=>/land|arriv/i.test(clean(f?.status?.name)+" "+clean(f?.status?.text));
  const landed=list.filter(isLanded),departed=list.filter(f=>/depart/i.test(clean(f?.status?.name))&&!isLanded(f));
  return {total:list.length,flightKeys:list[0]?Object.keys(list[0]):[],statusCounts,statusShapes:[...statusShapes.entries()].slice(0,10).map(([name,shape])=>({name,shape})),
    landedCount:landed.length,landedSamples:landed.slice(0,5).map(view),departedSamples:departed.slice(0,3).map(view)};
}
export async function probeFr24Board({fetchImpl=fetch,nowMs=Date.now(),pages=2}={}){
  if(nowMs-last<120000)return {ok:true,mode:"FR24_BOARD_PROBE_NO_WRITE",status:"THROTTLED",retryInSeconds:Math.ceil((120000-(nowMs-last))/1000)};
  last=nowMs;
  const start=Math.floor(nowMs/1000)-3*3600,flights=[],info=[];let verdict="OK",http=0;
  for(let page=1;page<=Math.max(1,Math.min(3,pages));page++){
    let r,text="";try{r=await fetchImpl(`https://www.flightradar24.com/data/airports/cdg/departures?date=${start}&page=${page}`,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"manual"});text=await r.text()}catch(e){verdict="FETCH_ERROR";info.push({page,error:String(e?.message||e).slice(0,120)});break}
    http=r.status;if(r.status!==200){verdict=[403,429,503].includes(r.status)?"BLOCKED":"HTTP_ERROR";info.push({page,httpStatus:r.status});break}
    const json=extractDataPage(text);if(!json){verdict=/just a moment|cf-chl|verify you are human/i.test(text)?"BLOCKED":"NO_USABLE_DATA";info.push({page,httpStatus:200});break}
    const f=Array.isArray(json?.props?.flights)?json.props.flights:[];flights.push(...f);info.push({page,rows:f.length,hasMore:!!json?.props?.meta?.hasMoreNextData});
    if(!json?.props?.meta?.hasMoreNextData)break;
  }
  return {ok:true,mode:"FR24_BOARD_PROBE_NO_WRITE",verdict,httpStatus:http,pages:info,...summarizeFlights(flights),
    howToRead:"landedSamples : si une ligne atterrie porte une heure d'atterrissage (champ avec paris=HH:MM proche de l'arrivée réelle), elle peut alimenter LDG en une lecture pour tous les vols. Sinon l'ordre actuel est conservé."};
}
