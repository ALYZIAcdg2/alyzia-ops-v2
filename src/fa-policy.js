// FlightAware ne sert qu'à combler l'ATD (heure de départ de la porte) que le FIDS n'a pas donnée : un vol n'est lu que s'il n'a pas d'ATD ET si le FIDS a eu le temps de la donner.
// Les vols dont le FIDS donne l'ATD ne sont jamais lus : il en reste très peu par jour. Module sans dépendance, partagé par toutes les lectures.
const clean=v=>String(v??"").trim();
const parisDay=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const parisMin=ms=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)};
const toMin=h=>{const m=/^(\d{1,2}):(\d{2})$/.exec(clean(h));return m?+m[1]*60+ +m[2]:null};
export const FA_GRACE_AFTER_TAKEOFF_MIN=15,FA_GRACE_AFTER_STD_MIN=90;
// ATD manquant et le FIDS a eu le temps de la donner : vol arrivé, parti depuis plus de 15 min, ou STD dépassée de plus de 90 min ; vol de la veille sans ATD : toujours.
export function atdOverdue(x,nowMs=Date.now(),flightDate=""){
  if(clean(x?.atd))return false;
  if(flightDate&&flightDate<parisDay(nowMs))return true;
  if(clean(x?.landing)||clean(x?.ata))return true;
  const now=parisMin(nowMs),to=toMin(x?.takeoff),std=toMin(x?.std);
  if(to!==null){let d=now-to;if(d<0)d+=1440;return d>=FA_GRACE_AFTER_TAKEOFF_MIN}
  if(std!==null){let d=now-std;if(d<-720)d+=1440;return d>=FA_GRACE_AFTER_STD_MIN}
  return false;
}
// Vol à lire sur FlightAware : sans ATD, et le FIDS a eu le temps de la donner. Le 1er argument (numéro de vol) n'est plus utilisé : plus de liste de compagnies.
export function flightAwareAllowed(flight,x,nowMs=Date.now(),flightDate=""){return atdOverdue(x,nowMs,flightDate)}

// Arrivée manquante : vol parti dont ni l'atterrissage ni l'ATA ne sont connus alors que la durée prévue du vol + 30 min est écoulée depuis le décollage
// (le FIDS n'a pas donné l'ATA, FR24 non plus). Vol d'un jour passé avec décollage connu : toujours.
export const FA_ARRIVAL_GRACE_MIN=30;
export function arrivalOverdue(x,nowMs=Date.now(),flightDate=""){
  if(clean(x?.ata)||clean(x?.landing))return false;
  const to=toMin(x?.takeoff);if(to===null)return false;
  if(flightDate&&flightDate<parisDay(nowMs))return true;
  const dur=Number(x?.duration);if(!(dur>0))return false;
  let d=parisMin(nowMs)-to;if(d<0)d+=1440;
  return d>=dur+FA_ARRIVAL_GRACE_MIN;
}
