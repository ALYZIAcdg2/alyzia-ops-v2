// Diagnostic en lecture seule : la page de partage d'un vol de l'application officielle MyAirport (Paris Aéroport) est-elle lisible par le serveur,
// et donne-t-elle « Décollé à HH:MM » ? UNE seule requête, mêmes en-têtes ordinaires que les autres lectures. Si la protection anti-robot répond, on s'arrête (aucun contournement).
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const BASE="https://wsmobile.aeroportsdeparis.fr/myairport/flight/detail?compositeKey=";
const BOT=/Pardon Our Interruption|Just a moment|cf-chl|Attention Required|Access Denied|captcha/i;
const botMarker=html=>{const m=String(html||"").slice(0,6000).match(BOT);return m?m[0]:""};
const textOf=html=>String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ").trim();
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const hhmm=v=>{const m=clean(v).match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);return m?`${m[1].padStart(2,"0")}:${m[2]}`:""};

// Clé relevée sur le lien de partage : « 20261010TK  1830CDG IST » = date + compagnie (2) + numéro aligné à droite sur 6 + départ + « espace » + arrivée.
export function compositeKey({flight,date,origin="CDG",destination=""}){
  const f=upper(flight).replace(/\s+/g,""),m=f.match(/^([A-Z0-9]{2})(\d+[A-Z]?)$/);if(!m)return "";
  return clean(date).replace(/-/g,"")+m[1]+m[2].padStart(6," ")+upper(origin)+" "+upper(destination);
}
export function parseMyAirport(html){
  const text=String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ").trim();
  const m=text.match(/D[ée]coll[ée]\s*(?:à|a)?\s*(\d{1,2}\s*[:hH]\s*\d{2})/i)||text.match(/Took\s+off\s*(?:at)?\s*(\d{1,2}\s*[:hH]\s*\d{2})/i);
  const l=text.match(/(?:Pos[ée]|Atterri|Landed)\s*(?:à|a|at)?\s*(\d{1,2}\s*[:hH]\s*\d{2})/i);
  return {text,takeoff:m?hhmm(m[1]):"",takeoffText:m?m[0]:"",landing:l?hhmm(l[1]):""};
}
export async function probeMyAirport({flight="",date="",key="",destination=""}={},{fetchImpl=fetch}={}){
  const k=clean(key)||compositeKey({flight,date:clean(date)||parisDate(),destination});
  if(!k)return {ok:false,error:"flight (ex. TK1830) + destination (ex. IST) + date, ou key=… (compositeKey du lien de partage)"};
  const url=BASE+encodeURIComponent(k),c=new AbortController(),t=setTimeout(()=>c.abort(),8000),out={ok:true,mode:"MYAIRPORT_PROBE_NO_WRITE",compositeKey:k,url};
  try{
    const r=await fetchImpl(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
    const body=await r.text();
    out.httpStatus=r.status;out.contentType=r.headers?.get?.("content-type")||"";out.length=body.length;out.botMarker=botMarker(body);out.botProtection=Boolean(out.botMarker);if(out.botProtection)out.pageTextHead=textOf(body).slice(0,300);
    if(!out.botProtection){const p=parseMyAirport(body);out.takeoff=p.takeoff;out.takeoffText=p.takeoffText;out.landing=p.landing;out.hasText=p.text.length>0;out.textHead=p.text.slice(0,500)}
    out.verdict=out.botProtection?"PROTÉGÉE (marqueur « "+out.botMarker+" ») : on s'arrête, aucun contournement":out.httpStatus!==200?"HTTP "+out.httpStatus:out.takeoff?"LISIBLE : décollage réel "+out.takeoff:"LISIBLE mais sans « Décollé à » (vol pas encore parti, texte chargé par script, ou clé inexacte)";
  }catch(e){out.error=String(e?.name||e?.message||e);out.verdict="ERREUR : "+out.error}finally{clearTimeout(t)}
  return out;
}
