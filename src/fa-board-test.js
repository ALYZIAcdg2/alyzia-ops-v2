// Diagnostic LECTURE SEULE du tableau des départs FlightAware de CDG (LFPG) : 40 vols par page, triés par heure de départ réelle (récents d'abord).
// GET /api/admin/fa-board-test?offset=0   (offset = 0, 40, 80…)
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const clean=v=>String(v??"").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
const text=h=>clean(String(h||"").replace(/<[^>]+>/g," "));

export function parseFaBoard(html){
  const rows=[];
  for(const m of String(html||"").matchAll(/<tr><td class="smallrow[12]"[\s\S]*?<\/tr>/g)){
    const tds=[...m[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
    if(tds.length<5)continue;
    const ident=text(tds[0]),flightUrl=(tds[0].match(/href="([^"]+)"/)||[])[1]||"";
    const type=text(tds[1]),dest=(tds[2].match(/\/live\/airport\/([A-Z0-9]{3,4})"/)||[])[1]||"";
    rows.push({ident,type,dest,departure:text(tds[3]),estArrival:text(tds[4]),arrival:text(tds[5]||""),flightUrl});
  }
  return rows;
}

export async function runFaBoardTest({offset=0,fetchImpl=fetch}={}){
  const off=Math.max(0,Math.min(200,Math.round((Number(offset)||0)/40)*40)),started=Date.now();
  const url=`https://www.flightaware.com/live/airport/LFPG/departures${off?`?;offset=${off};order=actualdeparturetime;sort=DESC`:""}`;
  try{
    const r=await fetchImpl(url,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"follow"});
    const html=await r.text(),base={ok:true,mode:"FA_BOARD_TEST_NO_WRITE",url,finalUrl:r.url||url,httpStatus:r.status,location:clean(r.headers.get("location")),contentType:clean(r.headers.get("content-type")),bytes:html.length,ms:Date.now()-started};
    if(r.status!==200)return {...base,verdict:r.status===403||r.status===429||r.status===503?"REFUSE":"HTTP_"+r.status,sample:html.slice(0,300)};
    const rows=parseFaBoard(html);
    if(!rows.length)return {...base,verdict:/just a moment|captcha|access denied|unusual traffic|verify you are human/i.test(html)?"CHALLENGE":"PAGE_SANS_VOLS",sample:html.slice(0,300)};
    return {...base,verdict:"OK",total:rows.length,withDeparture:rows.filter(x=>x.departure).length,sample:rows.slice(0,6)};
  }catch(e){return {ok:false,mode:"FA_BOARD_TEST_NO_WRITE",url,verdict:"ERREUR_RESEAU",error:String(e?.message||e).slice(0,200)}}
}
