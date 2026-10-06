// Diagnostic LECTURE SEULE du tableau des départs Flightera de CDG (page publique). N'écrit rien.
// GET /api/admin/flightera-board-test?date=AAAA-MM-JJ&time=HH_MM   (par défaut : aujourd'hui 00_00)
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const textOnly=h=>clean(String(h||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&"));

export function analyseFlighteraPage(html){
  const h=String(html||""),text=textOnly(h);
  const flights=[...text.matchAll(/\b([A-Z0-9]{2}\s?\d{2,4})\b/g)].map(m=>m[1].replace(/\s/g,""));
  const rows=[...h.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(m=>m[0]);
  const firstData=rows.find(r=>/\b[A-Z0-9]{2}\s?\d{2,4}\b/.test(textOnly(r)))||"";
  return {
    bytes:h.length,trCount:rows.length,distinctFlightCodes:new Set(flights).size,
    hints:{table:/<table\b/i.test(h),nextData:/__NEXT_DATA__/.test(h),jsonScript:/<script[^>]*type=["']application\/(ld\+)?json/i.test(h),dataPage:/data-page=/.test(h)},
    challenge:/just a moment|verify you are human|captcha|access denied|unusual traffic|cf-chl/i.test(h),
    firstRowText:textOnly(firstData).slice(0,400),firstRowHtml:firstData.slice(0,1800),
    textSample:text.slice(0,700),
  };
}

export async function runFlighteraBoardTest({date="",time="00_00",fetchImpl=fetch,nowMs=Date.now()}={}){
  const d=/^\d{4}-\d{2}-\d{2}$/.test(String(date))?date:new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris"}).format(new Date(nowMs));
  const t=/^\d{2}[_:]\d{2}$/.test(String(time))?String(time).replace(":","_"):"00_00";
  const url=`https://www.flightera.net/fr/airport/Paris/LFPG/departure/${d}%20${t}`,started=Date.now();
  try{
    const r=await fetchImpl(url,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"follow"});
    const html=await r.text(),base={ok:true,mode:"FLIGHTERA_BOARD_TEST_NO_WRITE",url,finalUrl:r.url||url,httpStatus:r.status,contentType:clean(r.headers.get("content-type")),ms:Date.now()-started};
    if(r.status!==200)return {...base,verdict:[403,429,503].includes(r.status)?"REFUSE":"HTTP_"+r.status,sample:clean(html).slice(0,300)};
    const a=analyseFlighteraPage(html);
    return {...base,...a,verdict:a.challenge?"CHALLENGE":(a.distinctFlightCodes>=10?"OK":"PAGE_SANS_VOLS")};
  }catch(e){return {ok:false,mode:"FLIGHTERA_BOARD_TEST_NO_WRITE",url,verdict:"ERREUR_RESEAU",error:String(e?.message||e).slice(0,200)}}
}
