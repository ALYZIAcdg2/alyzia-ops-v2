// Verified carrier aliases from exact dated public occurrences.
const ICAO_CODES={BM:"MNS",TB:"JAF",HF:"VRE",VF:"TKJ",NH:"ANA",AI:"AIC",WB:"RWD",TU:"TAR",SQ:"SIA",TK:"THY",E4:"ENT"};
const NO_DATA=new Set(["NOT_TRACKED","NO_USABLE_DATA","FETCHED_NO_MATCH","OCCURRENCE_MISMATCH"]);
export function icaoFlight(flight){
  const code=ICAO_CODES[flight.airline];
  return code?{...flight,airline:code,designator:`${code}${flight.number}`} : null;
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
  const first=await read(flight),attempts=[{designator:flight.designator,url:first.url,status:first.status,checkedAt:first.checkedAt}];
  const alias=icaoFlight(flight);
  if(!alias||!NO_DATA.has(first.status)||buildUrl(alias)===buildUrl(flight))return {...first,lookupDesignator:flight.designator,lookupAttempts:attempts};
  const second=await read(alias);
  attempts.push({designator:alias.designator,url:second.url,status:second.status,checkedAt:second.checkedAt});
  return {...second,lookupDesignator:alias.designator,lookupAttempts:attempts};
}
