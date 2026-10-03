// Public-source flight lookup aliases. The application keeps its planning/IATA code,
// but public sites are retried with the airline ICAO designator when the IATA lookup
// does not return a usable occurrence.
const ICAO_CODES={
  AA:"AAL",AC:"ACA",AF:"AFR",AI:"AIC",AT:"RAM",AV:"AVA",BA:"BAW",BJ:"LBT",BM:"MNS",
  DE:"CFG",DL:"DAL",E4:"ENT",EK:"UAE",ET:"ETH",EY:"ETD",GF:"GFA",HF:"VRE",IB:"IBE",
  KL:"KLM",KQ:"KQA",KU:"KAC",LA:"LAN",LH:"DLH",LX:"SWR",MH:"MAS",MK:"MAU",MS:"MSR",
  NH:"ANA",OZ:"AAR",QR:"QTR",RJ:"RJA",SK:"SAS",SN:"BEL",SQ:"SIA",SV:"SVA",TB:"JAF",
  TK:"THY",TP:"TAP",TU:"TAR",TW:"TWB",UA:"UAL",UU:"REU",VF:"TKJ",WB:"RWD",WY:"OMA"
};
export const PUBLIC_AIRLINE_ICAO=Object.freeze({...ICAO_CODES});

export function icaoFlight(flight){
  const iata=String(flight?.airline||"").trim().toUpperCase();
  const code=ICAO_CODES[iata];
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
  const first=await read(flight);
  const attempts=[{designator:flight.designator,codeType:"IATA",url:first.url,status:first.status,checkedAt:first.checkedAt}];
  const alias=icaoFlight(flight);
  // Dès que le premier lookup n'est pas exploitable, on tente aussi le code OACI.
  if(!alias||first.status==="OK"||buildUrl(alias)===buildUrl(flight))return {...first,lookupDesignator:flight.designator,lookupCodeType:"IATA",lookupAttempts:attempts};
  const second=await read(alias);
  attempts.push({designator:alias.designator,codeType:"ICAO",url:second.url,status:second.status,checkedAt:second.checkedAt});
  if(second.status==="OK")return {...second,lookupDesignator:alias.designator,lookupCodeType:"ICAO",lookupAttempts:attempts};
  return {...second,lookupDesignator:alias.designator,lookupCodeType:"ICAO",lookupAttempts:attempts};
}
