// Every clock stored on a flight is the LOCAL time of its airport (departure facts: origin, arrival facts: destination).
// Some public pages are rendered in UTC for the Worker (FR24 history, playback…). A departure clock more than 50 min BEFORE the planned STD is not a real
// departure: it is the UTC reading of the page. Shift it by the local offset of the airport when that gives a plausible departure, otherwise refuse it.
const clean=v=>String(v??"").trim();
const clockMinutes=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
const clockText=min=>{const v=((Math.round(min)%1440)+1440)%1440;return `${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`};
const signedGap=(a,b)=>{let d=a-b;if(d>720)d-=1440;if(d<-720)d+=1440;return d};

export function zoneOffsetMinutes(date,zone="Europe/Paris"){
  const m=clean(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return 0;
  const at=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));
  try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(at).map(x=>[x.type,x.value]));return (Number(p.hour)*60+Number(p.minute))-12*60}catch{return 0}
}

// -> {value, status}: status "OK" (kept), "SHIFTED" (UTC reading converted to local), "REJECTED" (not a plausible departure), "UNCHECKED" (no STD to compare with).
export function guardDepartureClock(value,std,date,zone="Europe/Paris"){
  const v=clockMinutes(value),s=clockMinutes(std);
  if(v===null)return {value:clean(value),status:"UNCHECKED"};
  if(s===null)return {value:clockText(v),status:"UNCHECKED"};
  if(signedGap(v,s)>-50)return {value:clockText(v),status:"OK"};
  const shifted=v+zoneOffsetMinutes(date,zone),gap=signedGap(shifted,s);
  if(gap>=-30&&gap<=240)return {value:clockText(shifted),status:"SHIFTED"};
  return {value:"",status:"REJECTED"};
}

// Arrival clocks (ETA / landing / ATA) are the LOCAL time of the destination. A page that gives them in the ORIGIN's time (TS251 CDG-YUL: landing "18:45" for a
// takeoff at 10:36, i.e. Paris time instead of Montreal time) is detected from the SCHEDULED block time (STD at origin -> STA at destination): when the value is
// far from the scheduled arrival as a destination clock, but close to it as an origin clock, it is converted. -> {value, status}: "OK", "SHIFTED" or "UNCHECKED".
export function guardArrivalClock(value,{std,sta,date,originZone="Europe/Paris",destZone="Europe/Paris"}={}){
  const v=clockMinutes(value),s=clockMinutes(std),a=clockMinutes(sta);
  if(v===null||s===null||a===null||originZone===destZone)return {value:clean(value),status:"UNCHECKED"};
  const oo=zoneOffsetMinutes(date,originZone),od=zoneOffsetMinutes(date,destZone),sched=(((a-od)-(s-oo))%1440+1440)%1440;
  const gapOf=clockInDest=>{const dur=(((clockInDest-od)-(s-oo))%1440+1440)%1440;return signedGap(dur,sched)};
  const g=gapOf(v);
  if(g>=-90&&g<=300)return {value:clockText(v),status:"OK"};
  const converted=v-oo+od,g2=gapOf(converted);
  if(g2>=-90&&g2<=300)return {value:clockText(converted),status:"SHIFTED"};
  return {value:clockText(v),status:"UNCHECKED"};
}

// Une heure RÉELLE (atterrissage, ATA) ne peut pas être dans le futur : c'est une estimation lue comme un fait (TS251 en vol « atterri à 18:45 »).
// L'heure est une heure locale de destination ; elle est placée après le décollage (ou la STD) pour trouver le bon jour.
export function isFutureActual(value,{date,std,takeoff,originZone="Europe/Paris",destZone="Europe/Paris",nowMs=Date.now(),graceMin=5}={}){
  const v=clockMinutes(value),s=clockMinutes(takeoff)??clockMinutes(std);
  const m=clean(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(v===null||s===null||!m)return false;
  const dayUtc=Date.UTC(+m[1],+m[2]-1,+m[3]),oo=zoneOffsetMinutes(date,originZone),od=zoneOffsetMinutes(date,destZone);
  const depEpoch=dayUtc+(s-oo)*60000;
  let arr=dayUtc+(v-od)*60000;while(arr<depEpoch)arr+=86400000;
  return arr>nowMs+graceMin*60000;
}

// Atterrissage / ATA impossible : le temps de vol écoulé (décollage ou ATD -> arrivée annoncée, chacun dans son fuseau) est inférieur à la moitié de la durée
// programmée (STD -> STA). IZ742 CDG-TLV : FlightStats a donné 18:30 (l'arrivée PRÉVUE en UTC, soit 21:30 à Tel Aviv) comme atterrissage 42 min après le décollage.
export function arrivedTooEarly(value,{date,std,sta,takeoff,originZone="Europe/Paris",destZone="Europe/Paris"}={}){
  const v=clockMinutes(value),d=clockMinutes(takeoff),s=clockMinutes(std),a=clockMinutes(sta);
  const m=clean(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(v===null||d===null||s===null||a===null||!m)return false;
  const dayUtc=Date.UTC(+m[1],+m[2]-1,+m[3]),oo=zoneOffsetMinutes(date,originZone),od=zoneOffsetMinutes(date,destZone);
  let block=(a-od)-(s-oo);while(block<=0)block+=1440;
  if(block<90)return false;
  // Temps de vol replié dans [-3 h ; 21 h[ : un vol de plus de 12 h (CDG-SIN 13 h) ne doit pas être ramené à une valeur négative.
  let flown=(v-od)-(d-oo);while(flown<-180)flown+=1440;while(flown>=1260)flown-=1440;
  return flown<block*0.5;
}
