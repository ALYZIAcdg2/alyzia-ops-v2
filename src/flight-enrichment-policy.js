const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
export const isMissing=v=>!clean(v)||["—","-","N/A","NULL"].includes(upper(v));

const API_SOURCES=[
  "OAG","OAG_STATUS","OAG_SCHEDULE","OAG_H2_RECOVERY",
  "AIRLABS","AIRLABS_LIVE_RECOVERY","AIRLABS_ROUTE","AIRLABS_ROUTE_TODAY",
  "SKYLINK","SKYLINK_LIVE_RECOVERY","SKYLINK_J0_BACKFILL","SKYLINK_ENT_ALIAS",
  "AERODATABOX","AERODATABOX_REG","QUARK","AVIATIONDATA","FLIGHTERA","KAYAK","SERPAPI","FR24API","CDGBOARD","FLIGHTRADAR1","FLIGHTRADAR8","FR24DEP","OPENSKY_ADSB","ALYZIA_OPS_STATE"
];
const SCHEDULE_SOURCES=["OAG_SCHEDULE","OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","FLIGHTERA","CDGBOARD","FLIGHTRADAR1","FLIGHTRADAR8"];
const FINAL_FIELDS=new Set(["atd","ata"]);

function sourceMatches(source,list){const s=upper(source);return list.some(v=>s===v||s.startsWith(`${v}_`))}
function scheduleConfirmed(x,field){return !isMissing(x[field])&&sourceMatches(x[field+"Source"],SCHEDULE_SOURCES)}

export const FIELD_MATRIX={
  std:{providers:["OAG_SCHEDULE","AIRLABS","SKYLINK","AERODATABOX"],window:[-1440,10080]},
  sta:{providers:["OAG_SCHEDULE","AIRLABS","SKYLINK","AERODATABOX"],window:[-1440,10080]},
  etd:{providers:["OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","CDGBOARD","FR24DEP"],window:[-60,240]},
  eta:{providers:["OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","FR24API","FR24DEP"],window:[-1800,60]},
  atd:{providers:["OAG_STATUS","SKYLINK","AIRLABS","AERODATABOX","OPENSKY","FR24DEP"],window:[-1080,30]},
  ata:{providers:["OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","FR24API","FR24DEP"],window:[-1080,30]},
  gate:{providers:["OAG_STATUS","SKYLINK","AIRLABS","AERODATABOX","CDGBOARD","FR24DEP"],window:[-60,240]},
  reg:{providers:["OPENSKY","SKYLINK","AIRLABS","AERODATABOX","FR24API","FR24DEP"],window:[-360,180]},
  aircraft:{providers:["OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","FR24API","FLIGHTRADAR1","FLIGHTRADAR8"],window:[-1440,360]},
  status:{providers:["OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","CDGBOARD","FLIGHTERA","KAYAK","SERPAPI","FR24DEP","FLIGHTRADAR1","FLIGHTRADAR8"],window:[-1080,360]}
};

export function isCancelled(x={}){
  return /CANCEL|ANNUL/.test(upper(x.status||x.opsStatus||x.flight_status||x.providerStatusRaw));
}
export function hasDeparted(x={}){
  if(!isMissing(x.atd))return true;
  return /(DEPARTED|AIRBORNE|EN\s*ROUTE|IN\s*FLIGHT|TOOK\s*OFF|DÉCOLLÉ|DECOLLE|LANDED|ARRIVED|COMPLETED)/i.test(clean(x.status||x.opsStatus||x.flight_status||x.providerStatusRaw));
}
export function hasArrived(x={}){
  if(!isMissing(x.ata))return true;
  return /(LANDED|ARRIVED|COMPLETED)/i.test(clean(x.status||x.opsStatus||x.flight_status||x.providerStatusRaw));
}
export function flightComplete(x={}){
  const aircraft=x.aircraft||x.aircraftType||x.aircraft_type||x.aircraftModel||x.type;
  return scheduleConfirmed(x,"std")&&scheduleConfirmed(x,"sta")&&!isMissing(x.atd)&&!isMissing(x.ata)&&!isMissing(x.gate)&&!isMissing(x.reg)&&!isMissing(aircraft);
}

// Once ATA is confirmed, live tracking stops. Historical gaps can be filled later
// by a dedicated backfill without consuming the live-flight quota.
export function stopAll(x={}){
  return isCancelled(x)||!isMissing(x.ata);
}

const ageMs=v=>{const t=Date.parse(clean(v))||0;return t?Date.now()-t:Infinity};
export const ETD_REFRESH_MIN=30;
function inWindow(d,[min,max]){return Number.isFinite(d)&&d>=min&&d<=max}
function minuteOfDay(v){const m=clean(v).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function minuteDelta(a,b){const x=minuteOfDay(a),y=minuteOfDay(b);if(x==null||y==null)return 0;let d=y-x;if(d<-720)d+=1440;if(d>720)d-=1440;return d}
function durationMinutes(x={}){
  for(const v of [x.duration,x.durationMinutes,x.flightDuration,x.flight_duration,x.scheduledDuration,x.scheduled_duration]){
    if(typeof v==="number"&&Number.isFinite(v)&&v>0)return Math.round(v);
    const s=clean(v),m=s.match(/^(\d{1,2}):(\d{2})$/);if(m)return Number(m[1])*60+Number(m[2]);
  }
  return null;
}
export function arrivalDelta(x={},departureDelta=99999){
  const duration=durationMinutes(x);
  if(!Number.isFinite(departureDelta)||duration==null)return null;
  return departureDelta+duration+minuteDelta(x.sta,x.eta);
}

export function buildNeeds(x={},d=99999){
  if(stopAll(x))return {std:false,sta:false,etd:false,eta:false,atd:false,ata:false,gate:false,reg:false,aircraft:false,status:false,any:false};
  const departed=hasDeparted(x),arrived=hasArrived(x),arrD=arrivalDelta(x,d);
  const atdWindow=inWindow(d,FIELD_MATRIX.atd.window);
  const ataWindow=arrD==null?false:inWindow(arrD,FIELD_MATRIX.ata.window);
  const aircraftValue=x.aircraft||x.aircraftType||x.aircraft_type||x.aircraftModel||x.type;
  const statusValue=x.providerStatusRaw||x.status||x.opsStatus||x.flight_status;
  const needs={
    // Imported STD/STA are theoretical anchors. They stay requested until an
    // external schedule source has confirmed them.
    std:inWindow(d,FIELD_MATRIX.std.window)&&!scheduleConfirmed(x,"std"),
    sta:inWindow(d,FIELD_MATRIX.sta.window)&&!scheduleConfirmed(x,"sta"),
    etd:!departed&&inWindow(d,FIELD_MATRIX.etd.window)&&((isMissing(x.etd)&&isMissing(x.edt))||ageMs(x.etdUpdatedAt)>=ETD_REFRESH_MIN*60000),
    eta:departed&&!arrived&&isMissing(x.eta)&&inWindow(d,FIELD_MATRIX.eta.window),
    atd:isMissing(x.atd)&&(departed||atdWindow),
    ata:isMissing(x.ata)&&(arrived||ataWindow),
    ata_late:isMissing(x.ata)&&departed&&!arrived&&d<=-45&&d>=-1080,
    gate:!departed&&inWindow(d,FIELD_MATRIX.gate.window)&&(isMissing(x.gate)||ageMs(x.gateUpdatedAt)>=15*60000),
    reg:!departed&&inWindow(d,FIELD_MATRIX.reg.window)&&(isMissing(x.reg)||ageMs(x.regUpdatedAt)>=30*60000),
    aircraft:!departed&&inWindow(d,FIELD_MATRIX.aircraft.window)&&(isMissing(aircraftValue)||ageMs(x.aircraftUpdatedAt||x.aircraftModelUpdatedAt)>=60*60000),
    status:!arrived&&inWindow(d,FIELD_MATRIX.status.window)&&(isMissing(statusValue)||ageMs(x.statusUpdatedAt||x.opsStatusUpdatedAt)>=15*60000)
  };
  needs.any=Object.values(needs).some(Boolean);
  return needs;
}

const PROVIDER_FIELDS={
  OAG_SCHEDULE:["std","sta"],
  OAG_STATUS:["etd","eta","atd","ata","gate","aircraft","status"],
  AIRLABS:["sta","etd","eta","atd","ata","gate","reg","aircraft","status"],
  SKYLINK:["sta","etd","eta","atd","ata","gate","reg","aircraft","status"],
  OPENSKY:["atd","reg"],
  AERODATABOX:["std","sta","etd","eta","atd","ata","gate","reg","aircraft","status"],
  QUARK:["etd","eta","gate"],
  AVIATIONDATA:["atd","ata"],
  FLIGHTERA:["sta","etd","eta","atd","ata","ata_late","gate","reg","aircraft","status"],
  KAYAK:["sta","etd","eta","atd","ata","ata_late","gate","status"],
  SERPAPI:["sta","etd","eta","atd","ata","gate","status"],
  FR24API:["eta","reg","ata","ata_late","aircraft"],
  CDGBOARD:["sta","etd","eta","atd","ata","ata_late","gate","status"],
  FLIGHTRADAR1:["reg","atd","ata","ata_late","etd","eta","sta","gate","aircraft","status"],
  FLIGHTRADAR8:["reg","atd","ata","ata_late","etd","eta","sta","gate","aircraft","status"],
  FR24DEP:["etd","eta","atd","ata","ata_late","gate","reg","status"]
};
export function providerNeeded(provider,x={},d=99999){
  if(stopAll(x))return false;
  const needs=buildNeeds(x,d),fields=PROVIDER_FIELDS[provider]||[];
  return fields.some(f=>needs[f]);
}
export function neededFields(provider,x={},d=99999){
  const needs=buildNeeds(x,d),fields=PROVIDER_FIELDS[provider]||[];
  return [...new Set(fields.filter(f=>needs[f]).map(f=>f==="ata_late"?"ata":f))];
}

// V2 flight-level cadence. d = minutes until STD (negative after STD).
export function trackingCadenceMinutes(x={},d=99999){
  if(stopAll(x))return Infinity;
  if(hasDeparted(x))return 15;
  if(d>360)return 60;
  if(d>180)return 30;
  if(d>60)return 15;
  if(d>=-120)return 5;
  return 15;
}

export function cadenceMinutes(provider,x={},d=99999){
  if(stopAll(x))return Infinity;
  const n=buildNeeds(x,d),base=trackingCadenceMinutes(x,d);
  if(provider==="OPENSKY")return d<=20&&d>=-75?Math.max(10,base):Infinity;
  if(provider==="AIRLABS")return d<=30&&d>=-240&&(n.atd||n.etd||n.gate||n.reg||n.aircraft)?Math.max(20,base):(n.ata?30:Math.max(90,base));
  if(provider==="SKYLINK")return n.ata?30:Math.max(30,base);
  if(provider==="OAG_STATUS")return n.ata?15:Math.max(15,base);
  return Math.max(15,base);
}

export function mayWriteField(x={},field,source=""){
  const aircraftValue=x.aircraft||x.aircraftType||x.aircraft_type||x.aircraftModel||x.type;
  const currentValue=field==="aircraft"?aircraftValue:x[field];
  if(isMissing(currentValue))return true;
  const nextIsApi=sourceMatches(source,API_SOURCES);
  const currentSource=field==="aircraft"?(x.aircraftSource||x.aircraftModelSource):x[field+"Source"];

  // Theory import may be replaced once by a confirmed external schedule.
  if((field==="std"||field==="sta")&&!sourceMatches(currentSource,SCHEDULE_SOURCES)&&nextIsApi)return true;
  if(field==="atd"&&/_EST$/.test(upper(x.atdSource)))return true;
  if(FINAL_FIELDS.has(field))return false;

  const departed=hasDeparted(x);
  if(field==="etd"&&departed)return false;
  if(field==="eta"&&hasArrived(x))return false;
  if(["gate","reg","aircraft"].includes(field)&&departed)return false;

  return sourceMatches(currentSource,API_SOURCES)&&nextIsApi;
}

export function priorityScore(x={},d=99999){
  const n=buildNeeds(x,d);
  if(n.atd&&d<=-30)return 0;
  if(n.atd)return 1;
  if(n.ata)return 2;
  if(n.etd)return 3;
  if(n.gate||n.reg||n.aircraft)return 4;
  if(n.eta||n.status)return 5;
  if(n.sta||n.std)return 6;
  return 99;
}
