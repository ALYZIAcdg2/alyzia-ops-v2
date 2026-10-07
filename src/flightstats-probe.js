// Diagnostic à la demande (3 requêtes au plus, jamais en boucle) : depuis le Worker, quel type de page FlightStats répond ?
// 1) page de suivi (flight-tracker), 2) API légère extendedDetails (avec flightId), 3) page flight-details (avec flightId).
// N'écrit rien et ne touche pas aux pauses : elles restent celles du cron.
import {flightStatsApiTimes,flightStatsDetails} from "./ops-public-live-flow-optimized.js";
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const strip=h=>String(h||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ").trim();

export function probeUrls({airline,number,date,flightId}){
  const [y,m,d]=String(date).split("-").map(Number),a=encodeURIComponent(airline),n=encodeURIComponent(number);
  const urls={tracker:`https://www.flightstats.com/v2/flight-tracker/${a}/${n}?year=${y}&month=${m}&date=${d}`};
  if(/^\d+$/.test(String(flightId||""))){
    urls.api=`https://www.flightstats.com/v2/api/extendedDetails/${a}/${n}/${y}/${m}/${d}/${flightId}`;
    urls.details=`https://www.flightstats.com/v2/flight-details/${a}/${n}?year=${y}&month=${m}&date=${d}&flightId=${flightId}`;
  }
  return urls;
}

export async function probeFlightStats({airline="",number="",date="",flightId=""},{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  airline=String(airline).toUpperCase().trim();number=String(number).replace(/\D/g,"");
  if(!airline||!number||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {ok:false,error:"airline, number, date (AAAA-MM-JJ) requis ; flightId facultatif"};
  const urls=probeUrls({airline,number,date,flightId}),out={};let first=true;
  for(const [kind,url] of Object.entries(urls)){
    if(!first)await sleep(1500);first=false;
    const t0=Date.now();
    try{
      const r=await fetchImpl(url,{redirect:"follow",headers:{accept:kind==="api"?"*/*":"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9",referer:"https://www.flightstats.com/v2","user-agent":UA}});
      const body=await r.text();
      const row={httpStatus:r.status,bytes:body.length,ms:Date.now()-t0,server:r.headers?.get?.("server")||null,challenge:/just a moment|cf-chl|captcha|access denied|incapsula|akamai/i.test(body.slice(0,6000))};
      if(r.ok&&kind==="api"){let j=null;try{j=JSON.parse(body)}catch{}const a=j?flightStatsApiTimes(j):null;row.times=a&&Object.keys(a).length?a:null}
      if(r.ok&&kind==="details"){const d=flightStatsDetails(strip(body));row.times=d&&Object.keys(d).length?d:null}
      if(r.ok&&kind==="tracker"){const m=/flight-details[^"'\s<>]*flightId=(\d+)/.exec(body);row.flightIdFound=m?m[1]:null}
      out[kind]=row;
    }catch(e){out[kind]={error:String(e?.message||e)}}
  }
  return {ok:true,mode:"FLIGHTSTATS_PROBE_NO_WRITE",airline,number,date,flightId:flightId||null,results:out};
}
