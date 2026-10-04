// Flight-list presentation. The existing flight model, filters and actions remain canonical.
export const REFERENCE_LIST_STYLE = String.raw`<style id="alyzia-flight-list-reference-css">
body:has(#app .home-page){background:#edf4fa!important}
.page:has(.home-page){background:#edf4fa!important;min-height:calc(100vh - 60px)!important}
#app .home-page{background:transparent!important}
#app .home-hero{background:transparent!important;border:0!important;box-shadow:none!important;padding:12px 0 18px!important}
#app .home-hero h1{display:inline-block!important;background:#103455!important;color:#fff!important;padding:10px 20px!important;border-radius:9px!important;font-size:26px!important;letter-spacing:0!important;line-height:1.2!important}
#app .home-hero p{display:none!important}
#app .home-table-scroll{overflow:visible!important;min-width:0!important}
#app .home-head{display:none!important}
#app .flight-home-list{display:grid!important;gap:22px!important;min-width:0!important}
#app .flight-home-row.ops-flight-card{box-sizing:border-box!important;position:relative!important;display:grid!important;grid-template-columns:minmax(360px,1.3fr) minmax(480px,2.4fr) 32px!important;grid-template-areas:"identity journey expand" "details details details"!important;gap:0 20px!important;align-items:center!important;align-content:center!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:208px!important;height:auto!important;max-height:none!important;padding:24px!important;margin:0!important;border:1px solid #dce6f1!important;border-radius:14px!important;background:#fff!important;box-shadow:0 2px 9px rgba(23,60,103,.035)!important;color:#10233f!important;cursor:pointer!important;overflow:visible!important;transform:none!important}
#app .flight-home-row.ops-flight-card:hover{border-color:#9ebfe3!important;background:#fff!important;box-shadow:0 5px 18px rgba(23,60,103,.07)!important}
#app .flight-home-row.ops-flight-card:focus-visible{outline:3px solid #4b9bef;outline-offset:3px}
#app .flight-home-row.ops-flight-card>*{display:block!important;min-width:0!important;grid-area:auto!important;max-width:100%!important}
#app .flight-home-row.ops-flight-card>.ops-identity{grid-area:identity!important;display:grid!important;grid-template-columns:82px minmax(0,1fr)!important;gap:18px!important;align-items:center!important}
#app .flight-home-row.ops-flight-card *{text-transform:none!important}
#app .ops-logo{display:grid;place-items:center;width:82px;min-width:0}
#app .ops-logo .airline-logo,#app .ops-logo .airline-logo-fallback,#app .ops-logo-symbol{display:block!important;width:82px!important;height:94px!important;max-width:82px!important;max-height:94px!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important}
#app .ops-logo .airline-logo-fallback{display:grid!important;place-items:center!important;font-size:24px!important;color:#345578!important}
#app .ops-logo-symbol{overflow:hidden!important}
#app .ops-flight-number{font-size:30px!important;line-height:1.15!important;font-weight:800!important;color:#071227!important;white-space:nowrap}
#app .ops-flight-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#app .ops-status-badge{display:inline-flex;align-items:center;max-width:100%;padding:7px 10px;border-radius:7px;background:#e6f8f3;color:#008f74;font-size:12px!important;font-weight:800!important;line-height:1.25;overflow-wrap:anywhere}
#app .ops-status-badge.retarde{background:#fff4e4;color:#a66006}
#app .ops-status-badge.annule{background:#fff0f2;color:#bd3047}
#app .ops-status-badge.arrive{background:#eaf4ff;color:#146cba}
#app .ops-status-badge.prevu{background:#eef3f9;color:#426382}
#app .ops-airline-name{font-size:17px!important;line-height:1.4!important;margin-top:5px;color:#294666;overflow-wrap:anywhere;text-transform:none!important}
#app .ops-aircraft{display:flex;align-items:baseline;gap:8px 12px;flex-wrap:wrap;font-size:17px!important;line-height:1.4!important;margin-top:4px;color:#294666;overflow-wrap:anywhere}
#app .ops-aircraft-location{display:inline-flex;align-items:baseline;gap:5px;font-size:11px!important;color:#60758c}
#app .ops-aircraft-location strong{font-size:15px!important;color:#183a5c}
#app .ops-registration{font-size:16px!important;line-height:1.4;margin-top:2px;color:#294666}
#app .flight-home-row.ops-flight-card>.ops-journey{grid-area:journey!important}
#app .ops-route{display:grid!important;grid-template-columns:minmax(86px,auto) minmax(35px,1fr) minmax(140px,auto)!important;gap:18px!important;align-items:start!important;margin-bottom:12px!important}
#app .ops-airport-code{display:flex;align-items:center;gap:10px;font-size:28px!important;line-height:1.15;font-weight:800!important;color:#071227;white-space:nowrap}
#app .ops-flag{font-size:24px;line-height:1;display:inline-flex}
#app .ops-flag svg{width:30px;height:20px;border:1px solid #e0e5eb;border-radius:2px}
#app .ops-airport-city{font-size:16px!important;line-height:1.3;margin-top:3px;color:#294666;overflow-wrap:anywhere;text-transform:none!important}
#app .ops-route-line{display:flex;align-items:center;gap:8px;color:#0864ba;padding-top:2px}
#app .ops-route-line:before,#app .ops-route-line:after{content:"";height:1.5px;background:#77b0ff;flex:1}
#app .ops-plane-icon{width:30px;height:30px;flex:none;fill:currentColor}
#app .ops-times{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}
#app .ops-time-group{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;padding:14px 12px!important;background:#f2f5f9!important;border-radius:9px!important;min-width:0!important}
#app .ops-time{min-width:0;text-align:center}
#app .ops-time small{display:block!important;font-size:13px!important;font-weight:500!important;color:#496386!important;line-height:1.25!important}
#app .ops-time b{display:block!important;margin-top:7px!important;font-size:18px!important;font-weight:750!important;line-height:1.2!important;color:#071227!important;white-space:nowrap!important}
#app .ops-time b.ops-missing{color:#587397!important;font-weight:500!important}
#app .ops-day{font-size:11px!important;font-weight:500;margin-left:2px;vertical-align:baseline;color:#183a61}
#app .ops-status-context{display:flex;gap:4px 16px;flex-wrap:wrap;margin-top:9px;color:#4b6787;font-size:13px!important;line-height:1.4}
#app .flight-home-row.ops-flight-card>.ops-expand{grid-area:expand!important;width:32px!important;height:44px!important;min-height:44px!important;border:0!important;border-radius:7px!important;background:transparent!important;padding:4px!important;color:#123d67!important;cursor:pointer}
#app .ops-expand svg{width:22px;height:22px;transition:transform .15s}
#app .ops-expand[aria-expanded="true"] svg{transform:rotate(180deg)}
#app .flight-home-row.ops-flight-card>.ops-extra{grid-area:details!important;display:flex!important;align-items:center;gap:10px 20px;flex-wrap:wrap;padding-top:18px;margin-top:18px;border-top:1px solid #e4edf5;color:#365472;font-size:13px}
#app .flight-home-row.ops-flight-card>.ops-extra[hidden]{display:none!important}
#app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity journey expand"!important}
#app .ops-extra strong{color:#102f50}
#app .ops-extra .ops-load-info{display:inline-flex;align-items:baseline;gap:8px;font-size:16px!important;flex-wrap:wrap}
#app .ops-extra .ops-load-info strong{font-size:18px!important;font-weight:800!important}
#app .ops-extra .ops-open-detail{margin-left:auto;border:1px solid #c2d8ec;border-radius:8px;background:#f5faff;color:#0c559e;padding:9px 14px;font-size:13px;font-weight:700;min-height:40px}
#app .ops-extra .home-pin{width:40px!important;height:40px!important;font-size:22px!important;display:inline-block!important}
#app .ops-extra .home-pin.active{color:#c58900!important}
#app .ops-extra button:focus-visible,#app .ops-expand:focus-visible{outline:2px solid #3188db;outline-offset:2px}
@media(max-width:1199px) and (min-width:721px){
 #app .flight-home-row.ops-flight-card{grid-template-columns:minmax(260px,1fr) minmax(0,1.7fr) 28px!important;grid-template-areas:"identity journey expand" "details details details"!important;gap:16px!important;padding:20px!important}
 #app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity journey expand"!important}
 #app .flight-home-row.ops-flight-card>.ops-identity{grid-template-columns:56px minmax(0,1fr)!important;gap:12px!important}
 #app .ops-logo,#app .ops-logo .airline-logo,#app .ops-logo .airline-logo-fallback,#app .ops-logo-symbol{width:56px!important;max-width:56px!important;height:68px!important}
 #app .ops-flight-number{font-size:25px!important}#app .ops-airline-name,#app .ops-aircraft{font-size:14px!important}
 #app .ops-airport-code{font-size:24px!important}#app .ops-route{gap:12px!important;grid-template-columns:auto 1fr auto!important}
 #app .ops-time-group{padding:12px 7px!important;gap:2px!important}#app .ops-time b{font-size:17px!important}#app .ops-time small{font-size:11px!important}
}
@media(min-width:721px) and (max-width:1000px){#app .ops-times{grid-template-columns:1fr!important}}
@media(max-width:720px){
 #app .home-hero h1{font-size:21px!important;padding:9px 14px!important}#app .flight-home-list{gap:14px!important}
 #app .flight-home-row.ops-flight-card{grid-template-columns:minmax(0,1fr) 30px!important;grid-template-areas:"identity expand" "journey journey" "details details"!important;gap:16px 8px!important;padding:16px 13px!important;min-height:0!important;border-radius:13px!important;overflow:visible!important}
 #app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity expand" "journey journey"!important}
 #app .flight-home-row.ops-flight-card>.ops-identity{grid-template-columns:52px minmax(0,1fr)!important;gap:13px!important}
 #app .ops-logo,#app .ops-logo .airline-logo,#app .ops-logo .airline-logo-fallback,#app .ops-logo-symbol{width:52px!important;max-width:52px!important;height:62px!important}
 #app .ops-flight-number{font-size:25px!important}#app .ops-airline-name,#app .ops-aircraft{font-size:14px!important;margin-top:2px}
 #app .ops-route{grid-template-columns:auto minmax(25px,1fr) auto!important;gap:10px!important;margin-bottom:13px!important}
 #app .ops-airport-code{font-size:25px!important;gap:6px}#app .ops-airport-city{font-size:14px!important}#app .ops-flag{font-size:20px}
 #app .ops-times{grid-template-columns:1fr!important;gap:8px!important}#app .ops-time-group{padding:11px 6px!important;gap:3px!important}#app .ops-time small{font-size:11px!important}#app .ops-time b{font-size:20px!important;margin-top:5px!important}#app .ops-day{font-size:11px!important}
 #app .ops-flight-line{gap:7px}#app .ops-status-badge{padding:5px 8px;font-size:11px!important}
 #app .ops-aircraft{gap:4px 8px}#app .ops-aircraft-location{font-size:10px!important}#app .ops-aircraft-location strong,#app .ops-registration{font-size:14px!important}
 #app .flight-home-row.ops-flight-card>.ops-extra{gap:12px;margin-top:0;padding-top:14px}#app .ops-extra .ops-open-detail{margin-left:0;width:100%}
}
@media(prefers-reduced-motion:reduce){#app .ops-expand svg{transition:none}}
#app .flight-home-row.ops-flight-card[style*="display: none"]{display:none!important}
@media print{#app .flight-home-row.ops-flight-card{break-inside:avoid!important}#app .ops-expand{visibility:hidden}}
</style>`;

// Inserted inside the existing UI controller so it shares its live refresh and escaping helpers.
export const REFERENCE_LIST_RENDERER = String.raw`
const expandedFlights=new Set();
const opsPlane='<svg class="ops-plane-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m21 12-7-4V3a2 2 0 0 0-4 0v5l-7 4v2l7-2v5l-2 2v2l4-1 4 1v-2l-2-2v-5l7 2z" transform="rotate(90 12 12)"/></svg>';
const opsCountry={CDG:'FR',ORY:'FR',NCE:'FR',LIL:'FR',LRT:'FR',PUF:'FR',CHR:'FR',LIG:'FR',SYS:'FR',QIE:'FR',SIN:'SG',ICN:'KR',HND:'JP',IST:'TR',SAW:'TR',ESB:'TR',AYT:'TR',ALG:'DZ',ORN:'DZ',CZL:'DZ',AAE:'DZ',TLM:'DZ',CFK:'DZ',QSF:'DZ',BLJ:'DZ',BSK:'DZ',ELU:'DZ',DUB:'IE',SNN:'IE',NOC:'IE',TLV:'IL',LCA:'CY',TUN:'TN',DJE:'TN',MIR:'TN',TTU:'MA',CPH:'DK',ARN:'SE',SVG:'NO',OSL:'NO',LYR:'NO',FRA:'DE',LEJ:'DE',BER:'DE',WAW:'PL',KTW:'PL',PRG:'CZ',SOF:'BG',BEG:'RS',ZAD:'HR',TIA:'AL',ATH:'GR',CMN:'MA',RBA:'MA',RAK:'MA',OUD:'MA',KEF:'IS',PDL:'PT',CAI:'EG',LXR:'EG',KUL:'MY',BKK:'TH',YUL:'CA',YYZ:'CA',YQB:'CA',DEL:'IN',ABJ:'CI',KGL:'RW',AMM:'JO',KWI:'KW',BOG:'CO',GRU:'BR',MIA:'US',JFK:'US',GYD:'AZ',TBS:'GE',SEZ:'SC',CKG:'CN',SZX:'CN',XIY:'CN',BRU:'BE',MST:'NL',LBA:'GB',LGW:'GB',BQH:'GB',OPO:'PT',BCN:'ES',IBZ:'ES',ACE:'ES',FUE:'ES',MXP:'IT',VRN:'IT',PMO:'IT',SUF:'IT',BLQ:'IT',GOH:'GL',SFJ:'GL'};
function opsTitle(value){return txt(value).toLocaleLowerCase('fr').replace(/(^|[\s-])(\p{L})/gu,(_,space,c)=>space+c.toLocaleUpperCase('fr'))}
function opsCity(code){try{return opsTitle((typeof CITY!=='undefined'&&CITY[code])||city(code))}catch{return code||''}}
function opsAirlineLogo(x,idx){
 const marks={SQ:{view:'397 0 83 112',width:480,height:112},OZ:{view:'363 29 90 91',width:480,height:173}},mark=marks[up(x.airline)];
 try{const uri=typeof AIRLINE_LOGOS!=='undefined'?AIRLINE_LOGOS[up(x.airline)]:null;if(mark&&uri){const id='ops-logo-clip-'+idx,clip=up(x.airline)==='OZ';return '<svg class="ops-logo-symbol" viewBox="'+mark.view+'" role="img" aria-label="'+esc(x.airline)+'">'+(clip?'<defs><clipPath id="'+id+'"><path d="M363 29h90v91h-60V89h-30z"/></clipPath></defs>':'')+'<image href="'+esc(uri)+'" width="'+mark.width+'" height="'+mark.height+'"'+(clip?' clip-path="url(#'+id+')"':'')+'/></svg>'}}catch{}return airlineLogoHtml(x);
}
function opsFlag(code){
 const country=opsCountry[up(code)];if(!country)return '';
 // Inline flags for the reference routes also render on desktops without flag emoji fonts.
 const flags={
  FR:'<path fill="#002395" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#ed2939" d="M20 0h10v20H20z"/>',
  SG:'<path fill="#fff" d="M0 0h30v20H0z"/><path fill="#ef3340" d="M0 0h30v10H0z"/><circle cx="6" cy="5" r="3.7" fill="#fff"/><circle cx="7.6" cy="5" r="3.1" fill="#ef3340"/><g fill="#fff">'+[[11.4,2.1],[13.8,3.9],[12.9,6.7],[9.9,6.7],[9,3.9]].map(([x,y])=>'<path transform="translate('+x+' '+y+')" d="M0-1 .24-.32 .95-.31 .38.12 .59.81 0 .4-.59.81-.38.12-.95-.31-.24-.32z"/>').join('')+'</g>',
  KR:'<path fill="#fff" d="M0 0h30v20H0z"/><g transform="rotate(33.7 15 10)"><circle cx="15" cy="10" r="5" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0a2.5 2.5 0 0 0-5 0a2.5 2.5 0 0 1-5 0" fill="#0047a0"/></g><g stroke="#111" stroke-width=".8">'+[[5.2,5,-55,[0,0,0]],[24.8,15,-55,[1,1,1]],[24.8,5,55,[1,0,1]],[5.2,15,55,[0,1,0]]].map(([x,y,r,breaks])=>'<g transform="translate('+x+' '+y+') rotate('+r+')">'+breaks.map((b,i)=>b?'<path d="M-2.6 '+(i-1)*1.3+'h2.2m.8 0h2.2"/>':'<path d="M-2.6 '+(i-1)*1.3+'h5.2"/>').join('')+'</g>').join('')+'</g>'
 };
 return '<span class="ops-flag" role="img" aria-label="'+country+'">'+(flags[country]?'<svg viewBox="0 0 30 20" aria-hidden="true">'+flags[country]+'</svg>':String.fromCodePoint(...[...country].map(c=>127397+c.charCodeAt(0))))+'</span>';
}
function opsLocalFlights(){try{return typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)?FLIGHTS:window.FLIGHTS||[]}catch{return []}}
function opsFlightForRow(row){
 const m=String(row.getAttribute('onclick')||'').match(/openFlightFromHomeList\((\d+)\)/),idx=m?Number(m[1]):-1;
 const local=opsLocalFlights()[idx];if(!local)return null;
 // A flight number alone is not an occurrence: never take a different date or route from live data.
 const date=txt(local.activeDate||local.date||''),remote=live.find(x=>keyFlight(x)===keyFlight(local)&&txt(x.activeDate||x.date||'')===date&&up(x.dep||x.origin)===up(local.dep||local.origin)&&up(x.dest||x.destination)===up(local.dest||local.destination));
 return {x:{...local,...remote,config:local.config,booked:local.booked,inopSeats:local.inopSeats},idx};
}
function opsTimeCell(label,value,day){return '<div class="ops-time"><small>'+label+'</small><b'+(!value?' class="ops-missing"':'')+'>'+esc(value||'—')+(value&&day?'<span class="ops-day">'+(day>0?'+':'')+day+'</span>':'')+'</b></div>'}
function opsTimes(x){const s=safeSchedule(x),t=times(x);return {...t,sta:clock(val(x,'sta','scheduledArrival','scheduled_arrival')),eta:clock(val(x,'eta','estimatedArrival','estimated_arrival')),staDay:Number(x.staDay??s.staDay)||0,etaDay:Number(x.etaDay??s.etaDay)||0,landingDay:Number(x.landingDay)||0}}
function opsLocalUtc(date,time,code,day=0){
 const m=txt(date).match(/^(\d{4})-(\d{2})-(\d{2})$/),c=clock(time);if(!m||!c)return null;
 let zone;try{zone=typeof AIRPORT_TZ!=='undefined'?AIRPORT_TZ[up(code)]:null}catch{}if(!zone)return null;
 const [h,n]=c.split(':').map(Number),base=Date.UTC(+m[1],+m[2]-1,+m[3]+day,h,n);let guess=base;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));guess=base-(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-guess)}return guess;
}
function opsMinutes(n){const m=Math.max(0,Math.floor(n));return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'}
function opsListStatus(x,t){
 const raw=up(x.status),st=opStatus(x),date=txt(x.activeDate||x.date||''),manual=up(x.statusSource||x.status_source).includes('MANUAL');
 if(raw&&(manual||raw.includes('ANNUL')))st.main=raw;
 st.cls=statusClass(st.main);if(!/EN VOL|ARRIV|ATTERR|RETARD|ANNUL/.test(up(st.main)))st.cls='prevu';
 st.remain='';
 if(up(st.main)==='EN VOL'){
  const actual=t.takeoff||t.atd,minutes=v=>{const c=clock(v);return c?Number(c.slice(0,2))*60+Number(c.slice(3)):null},std=minutes(t.std),at=minutes(actual);
  const day=Number((t.takeoff?x.takeoffDay:x.atdDay)??(std!==null&&at!==null&&std-at>720?1:0))||0;
  const departure=opsLocalUtc(date,actual,x.dep||x.origin||'CDG',day);
  if(departure!==null&&departure<=Date.now())st.sub='depuis '+opsMinutes((Date.now()-departure)/60000);
  let arrival=Date.parse(txt(x.statusArrivalUtc));
  if(!Number.isFinite(arrival))arrival=opsLocalUtc(date,t.eta||t.sta,x.dest||x.destination,t.eta?t.etaDay:t.staDay);
  if(Number.isFinite(arrival)&&arrival>Date.now())st.remain='Arrivée dans '+opsMinutes(Math.ceil((arrival-Date.now())/60000));
 }
 return st;
}
function opsLoad(x){
 let ks;try{ks=typeof companyClassesForFlight==='function'?companyClassesForFlight(x):classKeys(x)}catch{ks=classKeys(x)}
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const fmt=o=>ks.map(k=>k+(number(o?.[k])??'—')).join(' · ')||'—';
 const values=ks.map(k=>[number(x.config?.[k]),number(x.booked?.[k])]),known=values.length&&values.every(v=>v.every(n=>n!==null));
 const capacity=known?values.reduce((s,v)=>s+v[0],0):null,booked=known?values.reduce((s,v)=>s+v[1],0):null,nok=(x.inopSeats||[]).filter(r=>up(r?.status)==='NOK').length;
 return {cfg:fmt(x.config),book:fmt(x.booked),avail:number(x.available)??(known?capacity-booked-nok:'—'),nok};
}
function renderRow(row){
 const resolved=opsFlightForRow(row);if(!resolved)return;const {x,idx}=resolved,flight=keyFlight(x),t=opsTimes(x),st=opsListStatus(x,t),term=terminalOf(x)||((typeof AIRLINE_TERMINAL!=='undefined'&&AIRLINE_TERMINAL[up(x.airline)])||''),load=opsLoad(x),dep=x.dep||x.origin||'CDG',dest=x.dest||x.destination||'—',ac=val(x,'aircraftActual','aircraft')||'—',reg=val(x,'reg','registration','aircraftRegistration')||'—';
 const key=[flight,x.activeDate||x.date,dep,dest].join('|'),expanded=expandedFlights.has(key),isFav=favorite(x);
 let name=x.airline;try{if(typeof airlineDisplayName==='function')name=opsTitle(airlineDisplayName(x.airline))}catch{}
 const notes=Array.isArray(x.flightNotes)?x.flightNotes.filter(n=>txt(n?.text)).length:0;
 const sig=JSON.stringify([idx,flight,name,dep,dest,t,st,ac,reg,x.gate,term,load,isFav,notes,expanded]);if(row.dataset.opsSig===sig)return;
 row.dataset.opsSig=sig;row.classList.remove('v2x-row');row.classList.add('ops-flight-card');row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label','Ouvrir la fiche du vol '+flight);
 row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openFlightFromHomeList(idx)}};
 let badge='';try{if(typeof prepaBadge==='function')badge=prepaBadge(x,x.activeDate||x.date)}catch{}
 row.innerHTML='<div class="ops-identity"><div class="ops-logo">'+opsAirlineLogo(x,idx)+'</div><div><div class="ops-flight-line"><span class="ops-flight-number">'+esc(flight)+'</span><span class="ops-status-badge '+st.cls+'">'+esc(st.main)+'</span></div><div class="ops-airline-name">'+esc(name)+'</div><div class="ops-aircraft"><span>'+esc(ac)+'</span><span class="ops-aircraft-location">TERMINAL <strong>'+esc(term||'—')+'</strong></span><span class="ops-aircraft-location">GATE <strong>'+esc(x.gate||'—')+'</strong></span></div><div class="ops-registration">'+esc(reg)+'</div></div></div>'+
 '<div class="ops-journey"><div class="ops-route"><div><div class="ops-airport-code">'+esc(dep)+opsFlag(dep)+'</div><div class="ops-airport-city">'+esc(opsCity(dep))+'</div></div><div class="ops-route-line">'+opsPlane+'</div><div><div class="ops-airport-code">'+esc(dest)+opsFlag(dest)+'</div><div class="ops-airport-city">'+esc(opsCity(dest))+'</div></div></div>'+
 '<div class="ops-times"><div class="ops-time-group">'+opsTimeCell('STD',t.std)+opsTimeCell('ETD',t.etd)+opsTimeCell('ATD',t.atd)+opsTimeCell('TO',t.takeoff)+'</div><div class="ops-time-group">'+opsTimeCell('STA',t.sta,t.staDay)+opsTimeCell('ETA',t.eta,t.etaDay)+opsTimeCell('LDG',t.landing,t.landingDay)+opsTimeCell('ATA',t.ata,t.ataDay)+'</div></div>'+((st.sub||st.remain)?'<div class="ops-status-context">'+(st.sub?'<span>'+esc(st.sub)+'</span>':'')+(st.remain?'<span>'+esc(st.remain)+'</span>':'')+'</div>':'')+'</div>'+
 '<button type="button" class="ops-expand" aria-label="Détails du vol '+esc(flight)+'" aria-expanded="'+expanded+'" aria-controls="ops-extra-'+idx+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg></button>'+
 '<div id="ops-extra-'+idx+'" class="ops-extra"'+(expanded?'':' hidden')+'><span class="ops-load-info">CONFIG <strong>'+esc(load.cfg)+'</strong></span><span class="ops-load-info">BOOKING <strong>'+esc(load.book)+'</strong></span><span class="ops-load-info">AVAILABLE <strong>'+esc(load.avail)+'</strong></span>'+(load.nok?'<span>INOP <strong>'+load.nok+'</strong></span>':'')+badge+
 '<button type="button" class="home-pin '+(isFav?'active':'')+'" aria-label="'+(isFav?'Retirer des favoris':'Ajouter aux favoris')+'" aria-pressed="'+isFav+'">'+(isFav?'★':'☆')+'</button>'+(notes?'<button type="button" class="ops-notes">🔔 '+notes+' note'+(notes>1?'s':'')+'</button>':'')+'<button type="button" class="ops-open-detail">Ouvrir la fiche vol →</button></div>';
 row.querySelector('.ops-expand').onclick=e=>{e.stopPropagation();if(expandedFlights.has(key))expandedFlights.delete(key);else expandedFlights.add(key);renderRow(row)};
 row.querySelector('.home-pin').onclick=e=>{e.stopPropagation();toggleFavoriteFlight(idx)};
 row.querySelector('.ops-open-detail').onclick=e=>{e.stopPropagation();openFlightFromHomeList(idx)};
 const noteButton=row.querySelector('.ops-notes');if(noteButton)noteButton.onclick=e=>{e.stopPropagation();if(typeof openHomeNotesFromList==='function')openHomeNotesFromList(idx)};
}
`;
