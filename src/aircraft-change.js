// Détection du changement d'appareil entre l'IMPORT (x.aircraft, code IATA de l'Excel : 789, 32Q, 73H…) et le type RÉEL
// remonté par un fournisseur (code ICAO ou désignation longue constructeur). Le type réel normalisé Seatmap est mémorisé dans
// x.aircraftActual ; la valeur brute source reste dans x.aircraftActualRaw pour traçabilité.
// x.aircraftChange = {from,to,source,at} n'existe que si les deux appareils diffèrent réellement (variantes équivalentes ignorées).
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();

const ICAO_TO_IATA={
  B788:"788",B789:"789",B78X:"78X",B772:"772",B77L:"77L",B77W:"77W",B773:"773",B744:"744",B748:"748",B752:"752",B753:"753",B763:"763",B764:"764",
  B737:"73G",B738:"738",B739:"739",B38M:"7M8",B39M:"7M9",B734:"734",
  A318:"318",A319:"319",A320:"320",A321:"321",A19N:"31N",A20N:"32N",A21N:"32Q",
  A306:"306",A310:"310",A332:"332",A333:"333",A338:"338",A339:"339",A342:"342",A343:"343",A345:"345",A346:"346",A359:"359",A35K:"351",A388:"388",
  E170:"E70",E75L:"E75",E75S:"E75",E190:"E90",E195:"E95",E290:"E290",E295:"295",
  AT72:"AT7",AT75:"AT7",AT76:"AT7",DH8D:"DH4",CRJ7:"CR7",CRJ9:"CR9",CRJX:"CRK",BCS1:"221",BCS3:"223",
};

// Désignations longues régulièrement renvoyées par les sources publiques/API.
// La sortie correspond volontairement aux codes TYPE utilisés par le catalogue Seatmap ALYZIA.
const LONG_TYPE_RULES=[
  [/\bA220[-\s]?100\b|\bBD[-\s]?500[-\s]?1A10\b/,"221"],
  [/\bA220[-\s]?300\b|\bBD[-\s]?500[-\s]?1A11\b/,"223"],
  [/\bA318(?:[-\s]\d+)?\b/,"318"],
  [/\bA319[-\s]?\d{3}N\b|\bA319NEO\b/,"31N"],
  [/\bA319(?:[-\s]\d+)?\b/,"319"],
  [/\bA320[-\s]?\d{3}N\b|\bA320NEO\b/,"32N"],
  [/\bA320(?:[-\s]\d+)?\b/,"320"],
  [/\bA321[-\s]?\d{3}(?:N|NX)\b|\bA321NEO\b/,"32Q"],
  [/\bA321(?:[-\s]\d+)?\b/,"321"],
  [/\bA330[-\s]?2(?:0|2|3|4|43|23|43MRTT|43F)?\b|\bA330[-\s]?200\b|\bA330[-\s]?243MRTT\b/,"332"],
  [/\bA330[-\s]?3(?:0|2|3|4|43)?\b|\bA330[-\s]?300\b/,"333"],
  [/\bA330[-\s]?800\b|\bA330[-\s]?8(?:41|00)?N\b/,"338"],
  [/\bA330[-\s]?900\b|\bA330[-\s]?9(?:41|00)?N\b/,"339"],
  [/\bA340[-\s]?200\b|\bA340[-\s]?2\d{2}\b/,"342"],
  [/\bA340[-\s]?300\b|\bA340[-\s]?3\d{2}\b/,"343"],
  [/\bA340[-\s]?500\b|\bA340[-\s]?5\d{2}\b/,"345"],
  [/\bA340[-\s]?600\b|\bA340[-\s]?6\d{2}\b/,"346"],
  [/\bA350[-\s]?900\b|\bA350[-\s]?9(?:41|00)\b/,"359"],
  [/\bA350[-\s]?1000\b|\bA350[-\s]?10(?:41|00)\b/,"351"],
  [/\bA380[-\s]?800\b|\bA380[-\s]?8\d{2}\b/,"388"],
  [/\b737[-\s]?MAX[-\s]?8\b|\b737[-\s]?8MAX\b/,"7M8"],
  [/\b737[-\s]?MAX[-\s]?9\b|\b737[-\s]?9MAX\b/,"7M9"],
  [/\b737[-\s]?700\b|\b737[-\s]?7\d{2}\b/,"73G"],
  [/\b737[-\s]?800\b|\b737[-\s]?8\d{2}\b/,"738"],
  [/\b737[-\s]?900\b|\b737[-\s]?9\d{2}\b/,"739"],
  [/\b747[-\s]?400\b|\b747[-\s]?4\d{2}\b/,"744"],
  [/\b747[-\s]?8(?:I|F)?\b|\b747[-\s]?800\b/,"748"],
  [/\b757[-\s]?200\b|\b757[-\s]?2\d{2}\b/,"752"],
  [/\b757[-\s]?300\b|\b757[-\s]?3\d{2}\b/,"753"],
  [/\b767[-\s]?300\b|\b767[-\s]?3\d{2}\b/,"763"],
  [/\b767[-\s]?400\b|\b767[-\s]?4\d{2}\b/,"764"],
  [/\b777[-\s]?200LR\b/,"77L"],
  [/\b777[-\s]?200(?:ER)?\b|\b777[-\s]?2\d{2}(?:ER)?\b/,"772"],
  [/\b777[-\s]?300ER\b|\b777[-\s]?3\d{2}ER\b/,"77W"],
  [/\b777[-\s]?300\b|\b777[-\s]?3\d{2}\b/,"773"],
  [/\b787[-\s]?8\b/,"788"],
  [/\b787[-\s]?9\b/,"789"],
  [/\b787[-\s]?10\b/,"78X"],
  [/\bEMBRAER\s*170\b|\bE170\b/,"E70"],
  [/\bEMBRAER\s*175\b|\bE175\b/,"E75"],
  [/\bEMBRAER\s*190\b|\bE190\b/,"E90"],
  [/\bEMBRAER\s*195[-\s]?E2\b|\bE195[-\s]?E2\b/,"295"],
  [/\bEMBRAER\s*195\b|\bE195\b/,"E95"],
  [/\bATR[-\s]?72\b/,"AT7"],
  [/\bDASH\s*8[-\s]?400\b|\bQ400\b/,"DH4"],
];

// Codes IATA d'équipement considérés comme le MÊME appareil (variantes winglets / sièges). 32N (A320neo) et 32Q (A321neo) restent distincts.
const STRICT=[["738","73H","73W","73J","7S8"],["320","32A"],["321","32S","32B"],["7M8","38M"],["763","76W"],["32Q","N32"]];
// Codes sous lesquels le catalogue cabines peut ranger le même appareil (ex. LY enregistre son 777-200 en « 777 » alors que le type réel remonte « 772 »).
const CONFIG_ALIASES={"772":["777"],"777":["772"],"32Q":["N32"],"N32":["32Q"],"321":["32B","32S"],"32B":["321"],"32S":["321"],"763":["76W"],"76W":["763"],"738":["73H","7S8","78D"],"73H":["738"],"7S8":["738"],"7M8":["38M","78D"],"38M":["7M8"],"320":["32A"],"32A":["320"],"7M9":["79D","79B"],"78D":["738","7M8"],"79D":["7M9"],"79B":["7M9"]};  // TK range ses 737-800 et 737 MAX 8 sous « 78D », son 737 MAX 9 sous « 79D »
export function configCodes(code){const c=upper(code);return c?[...new Set([c,...(CONFIG_ALIASES[c]||[]),...STRICT.filter(g=>g.includes(c)).flat()])]:[]}

export function toIata(raw){
  const v=upper(raw);if(!v)return "";
  if(ICAO_TO_IATA[v])return ICAO_TO_IATA[v];
  if(/^[A-Z0-9]{3}$/.test(v))return v;
  const normalized=v.replace(/[–—]/g,"-").replace(/_/g," ").replace(/\s+/g," ");
  for(const [pattern,seatmap] of LONG_TYPE_RULES){if(pattern.test(normalized))return seatmap}
  return "";
}
export const toSeatmapType=toIata;

export function sameAircraft(a,b){
  const x=toIata(a)||upper(a),y=toIata(b)||upper(b);if(!x||!y)return true;
  if(x===y)return true;
  return STRICT.some(g=>g.includes(x)&&g.includes(y));
}
// Retourne true si x a été modifié. N'écrase jamais x.aircraft (import) : le type réel est ajouté à côté.
export async function noteAndSwitch(env,x,rawType,source,at){
  const changed=noteActualAircraft(x,rawType,source,at);
  if(x.aircraftChange){try{const m=await import("./index.js");if(await m.applyCabinConfigForActualAircraft(env,x))return true}catch(_){}}
  return changed;
}
export function noteActualAircraft(x,rawType,source,at){
  const raw=clean(rawType);const actual=toIata(raw);if(!actual)return false;
  const imported=toIata(x.aircraftImported||x.aircraft)||upper(x.aircraftImported||x.aircraft);
  let changed=false;
  if(clean(x.aircraftActualRaw)!==raw){x.aircraftActualRaw=raw;changed=true}
  if(upper(x.aircraftActual)!==actual){x.aircraftActual=actual;x.aircraftActualSource=source;x.aircraftActualUpdatedAt=at;changed=true}
  const differs=imported&&imported!=="NON RENSEIGNÉ"&&!sameAircraft(imported,actual);
  if(differs){
    const cur=x.aircraftChange;
    if(!cur||cur.to!==actual||cur.from!==imported){x.aircraftChange={from:imported,to:actual,source,at};changed=true;
      const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source,field:"aircraftChange",from:imported,to:actual,raw});x.flightInfoLog=log.slice(0,160)}
  }else if(x.aircraftChange){delete x.aircraftChange;changed=true}
  return changed;
}

// Même conversion, côté navigateur : les tables sont sérialisées en JSON et les fonctions sont écrites en toutes lettres.
// Ne jamais utiliser Function.prototype.toString() ici : le bundler du Worker renomme les identifiants (clean -> clean2…) et le code
// sérialisé référencerait alors des noms qui n'existent pas dans le navigateur.
export function clientSeatmapTypeSource(){
  return String.raw`(()=>{const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase(),ICAO_TO_IATA=${JSON.stringify(ICAO_TO_IATA)},CONFIG_ALIASES=${JSON.stringify(CONFIG_ALIASES)},STRICT=${JSON.stringify(STRICT)},LONG_TYPE_RULES=[${LONG_TYPE_RULES.map(([re,code])=>`[${re.toString()},${JSON.stringify(code)}]`).join(",")}];
function toIata(raw){const v=upper(raw);if(!v)return "";if(ICAO_TO_IATA[v])return ICAO_TO_IATA[v];if(/^[A-Z0-9]{3}$/.test(v))return v;const normalized=v.replace(/[–—]/g,"-").replace(/_/g," ").replace(/\s+/g," ");for(const [pattern,seatmap] of LONG_TYPE_RULES){if(pattern.test(normalized))return seatmap}return ""}
function configCodes(code){const c=upper(code);return c?[...new Set([c,...(CONFIG_ALIASES[c]||[]),...STRICT.filter(g=>g.includes(c)).flat()])]:[]}
return {toIata,configCodes}})()`;
}
