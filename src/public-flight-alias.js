// Public-source flight lookup aliases. The application keeps its planning/IATA code
// and raw flight number, but public sites may publish the same occurrence with a
// zero-padded number (example VF12 -> VF012).
const ICAO_CODES={
  AA:"AAL",AC:"ACA",AF:"AFR",AI:"AIC",AT:"RAM",AV:"AVA",BA:"BAW",BJ:"LBT",BM:"MNS",
  DE:"CFG",DL:"DAL",E4:"ENT",EK:"UAE",ET:"ETH",EY:"ETD",GF:"GFA",HF:"VRE",IB:"IBE",
  KL:"KLM",KQ:"KQA",KU:"KAC",LA:"LAN",LH:"DLH",LX:"SWR",MH:"MAS",MK:"MAU",MS:"MSR",
  NH:"ANA",OZ:"AAR",QR:"QTR",RJ:"RJA",SK:"SAS",SN:"BEL",SQ:"SIA",SV:"SVA",TB:"JAF",
  TK:"THY",TP:"TAP",TU:"TAR",TW:"TWB",UA:"UAL",UU:"REU",VF:"TKJ",WB:"RWD",WY:"OMA"
};
export const PUBLIC_AIRLINE_ICAO=Object.freeze({...ICAO_CODES});

const upper=v=>String(v??"").trim().toUpperCase();
export function publicFlightNumberVariants(number){
  const raw=upper(number);if(!raw)return [];
  const m=raw.match(/^(\d+)([A-Z]?)$/);if(!m)return [raw];
  const digits=String(Number(m[1]));
  if(!/^\d+$/.test(digits))return [raw];
  const suffix=m[2]||"",out=[raw];
  // Public trackers commonly pad short numeric flight numbers to 3 or 4 digits.
  for(const width of [2,3,4]){
    if(digits.length<=width)out.push(digits.padStart(width,"0")+suffix);
  }
  return [...new Set(out)];
}
export function flightLookupVariants(flight){
  const iata=upper(flight?.airline),numbers=publicFlightNumberVariants(flight?.number),out=[];
  for(const number of numbers)out.push({...flight,airline:iata,number,designator:`${iata}${number}`,lookupCodeType:"IATA",lookupNumberType:number===upper(flight?.number)?"RAW":"PADDED"});
  const icao=ICAO_CODES[iata];
  if(icao)for(const number of numbers)out.push({...flight,airline:icao,number,designator:`${icao}${number}`,lookupIata:iata,lookupIcao:icao,lookupCodeType:"ICAO",lookupNumberType:number===upper(flight?.number)?"RAW":"PADDED"});
  return out;
}
export function icaoFlight(flight){
  const iata=upper(flight?.airline),code=ICAO_CODES[iata];
  return code?{...flight,airline:code,designator:`${code}${flight.number}`,lookupIata:iata,lookupIcao:code}:null;
}
export function publicPageStatus(name,text,httpStatus,matched,hasData=true){
  if(/just a moment|attention required|verify you are human|incapsula|access denied|unusual traffic/i.test(text))return "BLOCKED";
  if(httpStatus<200||httpStatus>=300)return "HTTP_ERROR";
  if(/flight status not available|could not be located in our system|no history data|flight not found|unknown flight/i.test(text))return "NOT_TRACKED";
  return matched&&hasData?"OK":"NO_USABLE_DATA";
}
export function matchesFlightStatsOccurrence(text,flight){
  const [year,month,day]=flight.date.split("-");
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const date=`${day}-${months[Number(month)-1]}-${year}`;
  const departure=text.split("Flight Departure Times")[1]?.split("Flight Arrival Times")[0]||"";
  const header=text.split("Flight Departure Times")[0];
  return departure.includes(date)&&[flight.origin,flight.destination].every(code=>code&&new RegExp(`\\b${code}\\b`).test(header+" "+text.split("Flight Arrival Times")[1]?.slice(0,250)));
}
export async function withIcaoFallback(flight,buildUrl,read){
  const variants=flightLookupVariants(flight),attempts=[];
  let last=null;
  for(const candidate of variants){
    const url=buildUrl(candidate);
    if(attempts.some(a=>a.url===url))continue;
    const r=await read(candidate);last=r;
    attempts.push({designator:candidate.designator,codeType:candidate.lookupCodeType,numberType:candidate.lookupNumberType,url:r.url||url,status:r.status,checkedAt:r.checkedAt});
    if(r.status==="OK")return {...r,lookupDesignator:candidate.designator,lookupCodeType:candidate.lookupCodeType,lookupNumberType:candidate.lookupNumberType,lookupAttempts:attempts};
  }
  const fallback=last||{status:"NO_USABLE_DATA"};
  const finalCandidate=variants[Math.max(0,attempts.length-1)]||flight;
  return {...fallback,lookupDesignator:finalCandidate.designator||flight.designator,lookupCodeType:finalCandidate.lookupCodeType||"IATA",lookupNumberType:finalCandidate.lookupNumberType||"RAW",lookupAttempts:attempts};
}
