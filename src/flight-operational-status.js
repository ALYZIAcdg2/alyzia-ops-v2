// Keep list, admin and applied data on the same operational status rules.
export function flightOperationalStatus(x){
  const utils={value(keys){for(const key of keys){const v=String(x?.[key]??'').trim();if(v&&!/^(?:—|-|N\/A|NULL)$/i.test(v))return v}return ''},minutes(v){const m=String(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}};
  const raw=['opsStatus','status','flight_status','providerStatusRaw'].map(k=>String(x?.[k]??'')).join(' ').toUpperCase();
  if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
  if(utils.value(['ata','actualArrival','actual_arrival','gateIn','gate_in']))return 'ARRIVÉE';
  if(utils.value(['landing','landingTime','landing_time','touchdown']))return 'ATTERI';
  if(/ARRIV/.test(raw))return 'ARRIVÉE';
  if(/ATTERI|LANDED/.test(raw))return 'ATTERI';
  if(utils.value(['takeoff','takeoffTime','takeoff_time','airborne','atd','actualDeparture','actual_departure','gateOut','gate_out'])||/EN VOL|IN AIR|AIRBORNE|DECOL|DÉCOL|DEPARTED/.test(raw))return 'EN VOL';
  const std=utils.minutes(utils.value(['std','scheduledDeparture','scheduled_departure'])),etd=utils.minutes(utils.value(['etd','edt','estimatedDeparture','estimated_departure']));
  let delay=std!==null&&etd!==null?etd-std:0;if(delay<-720)delay+=1440;if(delay>720)delay-=1440;
  return /DELAY|RETARD/.test(raw)||delay>=5?'RETARDÉ':'PRÉVU';
}
