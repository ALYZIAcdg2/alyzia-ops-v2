// Règle d'affichage « RETARDÉ » : un vol non parti passe en retard seulement quand l'heure actuelle (Paris) dépasse sa STD de 15 min.
// Avant, il reste « à l'heure », même si l'ETD ou un fournisseur annonce déjà du retard. Lecture seule, la STD n'est jamais modifiée.
export const LATE_AFTER_STD_MIN=15;
export function lateBeyondStd15(x,flightDate="",nowMs=Date.now()){
  const m=/(\d{1,2}):(\d{2})/.exec(String(x?.std??""));if(!m)return false;
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(nowMs)).map(z=>[z.type,z.value]));
  const today=`${p.year}-${p.month}-${p.day}`,day=String(flightDate||x?.flight_date||x?.flightDate||x?.date||today).slice(0,10);
  if(day<today)return true;
  return day===today&&Number(p.hour)*60+Number(p.minute)>=Number(m[1])*60+Number(m[2])+LATE_AFTER_STD_MIN;
}
