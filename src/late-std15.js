// Règle d'affichage « RETARDÉ » : un vol non parti passe en retard dès que son ETD dépasse la STD de 15 min ou plus, ou, sans ETD, quand l'heure actuelle (Paris) dépasse la STD de 15 min.
// Un ETD de moins de 15 min de retard, ou le signal de retard d'un fournisseur, ne change pas l'affichage. Lecture seule, la STD n'est jamais modifiée.
export const LATE_AFTER_STD_MIN=15;
export function lateBeyondStd15(x,flightDate="",nowMs=Date.now()){
  const m=/(\d{1,2}):(\d{2})/.exec(String(x?.std??""));if(!m)return false;
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(nowMs)).map(z=>[z.type,z.value]));
  const today=`${p.year}-${p.month}-${p.day}`,day=String(flightDate||x?.flight_date||x?.flightDate||x?.date||today).slice(0,10);
  if(day<today)return true;
  // ETD (heure CDG, comme la STD) supérieur à la STD de 15 min ou plus : retard annoncé, affiché tout de suite (vol du jour seulement).
  if(day===today){const e=/(\d{1,2}):(\d{2})/.exec(String(x?.etd??x?.edt??""));if(e){let d=Number(e[1])*60+Number(e[2])-(Number(m[1])*60+Number(m[2]));if(d<-720)d+=1440;if(d>720)d-=1440;if(d>=LATE_AFTER_STD_MIN)return true}}
  return day===today&&Number(p.hour)*60+Number(p.minute)>=Number(m[1])*60+Number(m[2])+LATE_AFTER_STD_MIN;
}
