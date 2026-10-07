// Single operational status projection for admin/list helpers.
// The authoritative status is written by status-model-test.js using V1 semantics
// and V2 public-source facts. Do not re-introduce the old ATD => PARTI rule here.
export function flightOperationalStatus(x){
  const value=keys=>{for(const key of keys){const v=String(x?.[key]??'').trim();if(v&&!/^(?:—|-|N\/A|NULL)$/i.test(v))return v}return ''};
  const minutes=v=>{const m=String(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
  const upper=v=>String(v??'').trim().toUpperCase();
  // RETARDÉ seulement quand l'heure actuelle (Paris) dépasse la STD de 15 min (même règle que late-std15.js ; sans import : la fonction est copiée dans la page).
  const late15=()=>{const m=/(\d{1,2}):(\d{2})/.exec(String(x?.std??''));if(!m)return false;const p={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(z=>{p[z.type]=z.value});const today=p.year+'-'+p.month+'-'+p.day,d=String(x.flight_date||x.flightDate||x.date||today).slice(0,10);return d<today||(d===today&&Number(p.hour)*60+Number(p.minute)>=Number(m[1])*60+Number(m[2])+15)};

  // status-model-test.js is the single source of truth for automatic V1-style status.
  // Manual status remains authoritative too.
  const source=upper(x?.statusSource||x?.status_source);
  const stored=upper(x?.status);
  // A cancellation confirmed by the live flow stays ANNULÉ everywhere (list, sheet, admin), like the status model.
  if(String(x?.cancelledSource??'').trim()&&/ANNUL|CANCEL/.test(stored))return 'ANNULÉ';
  if((source.startsWith('ALYZIA_STATUS_V1:')||source.includes('MANUAL'))&&stored){
    if(stored.startsWith('ARRIV'))return 'ARRIVÉE';
    if(stored.startsWith('EN VOL'))return 'EN VOL';
    if(stored.startsWith('EMBARQUEMENT CLOS'))return 'EMBARQUEMENT CLOS';
    if(stored.startsWith('EMBARQUEMENT'))return 'EMBARQUEMENT';
    if(stored.startsWith('RETARD'))return late15()?'RETARDÉ':'PRÉVU';
    if(stored.startsWith('ANNUL'))return 'ANNULÉ';
    if(stored.startsWith('PROGRAMM')||stored.startsWith('PRÉVU'))return 'PRÉVU';
  }

  const raw=['opsStatus','flight_status','providerStatusRaw','providerStatus','publicStatus','statusRaw']
    .map(k=>String(x?.[k]??'')).join(' ').toUpperCase();

  if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
  if(value(['ata','actualArrival','actual_arrival','gateIn','gate_in']))return 'ARRIVÉE';
  if(/ARRIV/.test(raw))return 'ARRIVÉE';

  // V1 rule: a real ATD means the flight is shown EN VOL.
  if(value(['atd','actualDeparture','actual_departure','gateOut','gate_out']))return 'EN VOL';
  if(value(['takeoff','takeoffTime','takeoff_time','airborne'])||/EN VOL|IN AIR|AIRBORNE|IN FLIGHT|EN ROUTE|TOOK OFF|DEPARTED/.test(raw))return 'EN VOL';

  if(/BOARDING CLOSED|EMBARQUEMENT CLOS/.test(raw))return 'EMBARQUEMENT CLOS';
  if(/BOARDING|EMBARQUEMENT/.test(raw))return 'EMBARQUEMENT';

  const std=minutes(value(['std','scheduledDeparture','scheduled_departure']));
  const etd=minutes(value(['etd','edt','estimatedDeparture','estimated_departure']));
  let delay=std!==null&&etd!==null?etd-std:0;
  if(delay<-720)delay+=1440;
  if(delay>720)delay-=1440;
  return late15()?'RETARDÉ':'PRÉVU';
}
