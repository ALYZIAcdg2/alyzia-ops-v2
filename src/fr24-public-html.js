const EXACT_OCCURRENCES={
  "CTM21|2026-10-01":"41ea23a2"
};

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const uniq=(values,max=32)=>[...new Set(values.filter(Boolean))].slice(0,max);

export function fr24OccurrenceId(flight){
  return EXACT_OCCURRENCES[`${upper(flight?.designator)}|${clean(flight?.date)}`]||clean(flight?.raw?.fr24OccurrenceId||flight?.raw?.fr24_occurrence_id);
}

export function fr24PublicUrls(flight){
  const designator=upper(flight?.designator);
  const id=fr24OccurrenceId(flight);
  const urls=[];
  if(id&&designator)urls.push(`https://www.flightradar24.com/${encodeURIComponent(designator)}/${encodeURIComponent(id)}`);
  if(designator)urls.push(`https://www.flightradar24.com/data/flights/${encodeURIComponent(designator.toLowerCase())}`);
  return {id,urls};
}

function textOnly(html){
  return String(html||"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"')
    .replace(/\\u002F/g,"/").replace(/\\u003A/g,":").replace(/\\u002D/g,"-")
    .replace(/\s+/g," ").trim();
}

function deescape(raw){
  return String(raw||"")
    .replace(/\\\"/g,'"')
    .replace(/\\u002F/g,"/").replace(/\\u003A/g,":").replace(/\\u002D/g,"-")
    .replace(/\\n/g," ").replace(/\\t/g," ");
}

function extract(raw,flight,id){
  const source=deescape(raw);
  const text=textOnly(source);
  const combined=`${text} ${source}`;
  const times=uniq([...combined.matchAll(/\b(?:[01]?\d|2[0-3])[:h][0-5]\d\b/g)].map(m=>m[0].replace("h",":")),40);
  const registrations=uniq([...combined.matchAll(/\b(?:F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|JA\d{3,4}[A-Z]|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z0-9]{3,5})\b/gi)].map(m=>upper(m[0])),16);
  const aircraft=uniq([...combined.matchAll(/\b(?:A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A400M|A400|A380|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|C130|C30J|F900|F2TH|F3TH|GLF5|GLF6|32Q|77W|788|789|359|333|332|320|321)\b/gi)].map(m=>upper(m[0])),16);
  const terminals=uniq([...combined.matchAll(/(?:terminal|term\.?)[\s:#-]*([0-9A-Z]{1,4})/gi)].map(m=>upper(m[1])),8);
  const gates=uniq([...combined.matchAll(/(?:gate|porte)[\s:#-]*([A-Z]?\d{1,3}[A-Z]?)/gi)].map(m=>upper(m[1])),8);
  const statuses=uniq([...combined.matchAll(/\b(?:scheduled|on time|delayed|departed|arrived|landed|cancelled|canceled|airborne|en vol|retard[ée]?|arriv[ée]?|décoll[ée]?)\b/gi)].map(m=>upper(m[0])),12);
  const marker=upper(flight.designator);
  let idx=upper(text).indexOf(marker);
  if(idx<0&&id)idx=upper(source).indexOf(upper(id));
  const excerpt=idx>=0?text.slice(Math.max(0,idx-700),idx+2600):text.slice(0,2800);
  const occurrenceMatched=Boolean(id&&upper(source).includes(upper(id)));
  const flightMatched=upper(combined).includes(marker)||upper(combined).includes(`${upper(flight.airline)} ${upper(flight.number)}`);
  const useful=times.length+registrations.length+aircraft.length+terminals.length+gates.length+statuses.length;
  return {times,registrations,aircraft,terminals,gates,statuses,excerpt,fr24OccurrenceId:id||"",occurrenceMatched,flightMatched,useful};
}

export async function fetchFr24Public(flight){
  const {id,urls}=fr24PublicUrls(flight);
  const checkedAt=new Date().toISOString();
  const attempts=[];
  for(const url of urls){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{
        "accept":"text/html,application/xhtml+xml",
        "accept-language":"fr-FR,fr;q=0.9,en;q=0.8",
        "user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-PublicSourceTest/2.0; public-web-page)"
      }});
      const ct=clean(r.headers.get("content-type")).toLowerCase();
      const body=(ct.includes("text")||ct.includes("json")||ct.includes("javascript"))?await r.text():"";
      const candidates=extract(body,flight,id);
      const exactOk=id?candidates.occurrenceMatched:true;
      const usable=r.ok&&candidates.flightMatched&&exactOk&&candidates.useful>0;
      const attempt={url,finalUrl:r.url,httpStatus:r.status,ok:r.ok,candidates};
      attempts.push(attempt);
      if(usable){
        return {name:"FR24",url,status:"OK",httpStatus:r.status,finalUrl:r.url,mentionsFlight:true,candidates:{...candidates,attempts:attempts.map(a=>({url:a.url,finalUrl:a.finalUrl,httpStatus:a.httpStatus,occurrenceMatched:a.candidates.occurrenceMatched,useful:a.candidates.useful}))},checkedAt};
      }
    }catch(e){
      attempts.push({url,finalUrl:url,httpStatus:0,error:String(e?.message||e).slice(0,200)});
    }finally{clearTimeout(timer)}
  }
  const best=[...attempts].sort((a,b)=>(b.candidates?.useful||0)-(a.candidates?.useful||0))[0];
  const reason=id&&!best?.candidates?.occurrenceMatched?"EXACT_OCCURRENCE_NOT_EXTRACTED":"FR24_NO_USABLE_DATA";
  return {name:"FR24",url:urls[0]||"",status:reason,httpStatus:Number(best?.httpStatus||0),finalUrl:best?.finalUrl||urls[0]||"",mentionsFlight:Boolean(best?.candidates?.flightMatched),candidates:{...(best?.candidates||{}),attempts:attempts.map(a=>({url:a.url,finalUrl:a.finalUrl,httpStatus:a.httpStatus,occurrenceMatched:a.candidates?.occurrenceMatched||false,useful:a.candidates?.useful||0,error:a.error||""}))},error:reason,checkedAt};
}
