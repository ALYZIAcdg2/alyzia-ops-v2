// Flight-list presentation. The existing flight model, filters and actions remain canonical.
import { clientSeatmapTypeSource } from "./aircraft-change.js";

export const REFERENCE_LIST_STYLE = String.raw`<style id="alyzia-flight-list-reference-css">
body:has(#app .home-page){background:#edf4fa!important}
.page:has(.home-page){background:#edf4fa!important;min-height:calc(100vh - 60px)!important}
#app .home-page{background:transparent!important}
#app .home-hero{background:transparent!important;border:0!important;box-shadow:none!important;padding:12px 0 18px!important;justify-content:flex-end!important}
#app .home-hero p{display:none!important}
#app .home-table-scroll{overflow:visible!important;min-width:0!important}
#app .home-head{display:none!important}
#app .flight-home-list{display:grid!important;gap:22px!important;min-width:0!important}
#app .flight-home-row.ops-flight-card{box-sizing:border-box!important;position:relative!important;display:grid!important;grid-template-columns:minmax(360px,1.3fr) minmax(480px,2.4fr) 32px!important;grid-template-areas:"identity journey expand" "details details details"!important;gap:0 20px!important;align-items:center!important;align-content:center!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:208px!important;height:auto!important;max-height:none!important;padding:24px!important;margin:0!important;border:1px solid #dce6f1!important;border-radius:14px!important;background:#fff!important;box-shadow:0 2px 9px rgba(23,60,103,.035)!important;color:#10233f!important;cursor:pointer!important;overflow:visible!important;transform:none!important}
#app .flight-home-row.ops-flight-card:hover{border-color:#9ebfe3!important;background:#fff!important;box-shadow:0 5px 18px rgba(23,60,103,.07)!important}
#app .flight-home-row.ops-flight-card:focus-visible{outline:3px solid #4b9bef;outline-offset:3px}
#app .flight-home-row.ops-flight-card>*{display:block!important;min-width:0!important;grid-area:auto!important;max-width:100%!important}
#app .flight-home-row.ops-flight-card>.ops-identity{grid-area:identity!important;display:block!important}
#app .flight-home-row.ops-flight-card *{text-transform:none!important}
#app .ops-logo{display:flex!important;align-items:center;justify-content:flex-start;width:auto;min-width:36px;max-width:84px;height:44px;flex:none}
#app .ops-logo .airline-logo,#app .ops-logo .airline-logo-fallback{display:block!important;width:auto!important;height:44px!important;max-width:84px!important;max-height:44px!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;transform:none!important}
#app .ops-logo .airline-logo-fallback{display:grid!important;place-items:center!important;font-size:20px!important;color:#345578!important}
#app .ops-logo-symbol{display:block;width:40px!important;height:44px!important;overflow:hidden!important}
#app .ops-flight-number{font-size:30px!important;line-height:1.15!important;font-weight:800!important;color:#071227!important;white-space:nowrap}
#app .ops-flight-line{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#app .ops-flight-line .ops-flight-number{line-height:44px!important}
#app .ops-status-badge{display:inline-flex;align-items:center;max-width:100%;padding:7px 10px;border-radius:7px;background:#e6f8f3;color:#008f74;font-size:12px!important;font-weight:800!important;line-height:1.25;overflow-wrap:anywhere}
#app .ops-status-badge.retarde{background:#fff4e4;color:#a66006}
#app .ops-status-badge.annule{background:#fff0f2;color:#bd3047}
#app .ops-status-badge.arrive{background:#eaf4ff;color:#146cba}
#app .ops-status-badge.prevu{background:#eef3f9;color:#426382}
#app .ops-airline-name{font-size:17px!important;line-height:1.4!important;margin-top:5px;color:#294666;overflow-wrap:anywhere;text-transform:none!important}
#app .ops-aircraft{display:flex;align-items:baseline;gap:8px 12px;flex-wrap:wrap;font-size:17px!important;line-height:1.4!important;margin-top:4px;color:#294666;overflow-wrap:anywhere}
#app .ops-aircraft-type{font-weight:800!important}
#app .ops-aircraft-location{display:inline-flex;align-items:baseline;gap:5px;font-size:11px!important;color:#60758c}
#app .ops-aircraft-location strong{font-size:15px!important;font-weight:800!important;color:#183a5c}
#app .ops-terminal[data-terminal="T1"]{color:#3064be!important}
#app .ops-terminal[data-terminal="T2"]{color:#2a8d40!important}
#app .ops-terminal[data-terminal="T3"]{color:#af2c80!important}
#app .ops-terminal strong{color:inherit!important}
#app .ops-registration{font-size:16px!important;line-height:1.4;margin-top:2px;color:#294666}
#app .flight-home-row.ops-flight-card>.ops-journey{grid-area:journey!important}
#app .ops-route{display:grid!important;grid-template-columns:minmax(86px,auto) minmax(35px,1fr) minmax(140px,auto)!important;gap:18px!important;align-items:start!important;margin-bottom:12px!important}
#app .ops-airport-code{display:flex;align-items:center;gap:10px;font-size:28px!important;line-height:1.15;font-weight:800!important;color:#071227;white-space:nowrap}
#app .ops-flag{font-size:24px;line-height:1;display:inline-flex}
#app .ops-flag svg{width:30px;height:20px;border:1px solid #e0e5eb;border-radius:2px}
#app .ops-airport-city{font-size:16px!important;line-height:1.3;margin-top:3px;color:#294666;overflow-wrap:anywhere;text-transform:none!important}
#app .ops-airport-meta{display:flex;align-items:center;gap:4px 10px;flex-wrap:wrap}
#app .ops-airport-meta .wx-line{margin:3px 0 0!important;min-height:0!important;font-size:12px!important}
#app .ops-airport-meta .wx-i{display:inline-flex;align-items:center;gap:4px!important}
#app .ops-airport-meta .wx-svg{width:20px!important;height:20px!important}
#app .ops-airport-meta .wx-line b{font-size:14px!important;color:#365472!important}
#app .ops-airport-meta .wx-line small{font-size:10px!important;color:#60758c!important}
#app .ops-route-line{--p:.5;position:relative;height:30px;min-width:35px;color:#0864ba;margin-top:1px}
#app .ops-route-track,#app .ops-route-fill{position:absolute;left:0;top:50%;height:2px;margin-top:-1px;border-radius:2px}
#app .ops-route-track{right:0;background:repeating-linear-gradient(90deg,#9cc4f5 0 6px,transparent 6px 10px)}
#app .ops-route-fill{width:calc(15px + (100% - 30px)*var(--p));background:#2f86e6;transition:width .8s ease}
#app .ops-route-line.static .ops-route-fill{display:none}
#app .ops-plane-icon{position:absolute;left:calc(15px + (100% - 30px)*var(--p));top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;fill:currentColor;background:#fff;border-radius:50%;transition:left .8s ease}
#app .ops-times{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}
#app .ops-time-group{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;padding:14px 12px!important;background:#f2f5f9!important;border-radius:9px!important;min-width:0!important}
#app .ops-time{min-width:0;text-align:center}
#app .ops-time small{display:block!important;font-size:13px!important;font-weight:500!important;color:#496386!important;line-height:1.25!important}
#app .ops-time b{display:block!important;margin-top:7px!important;font-size:18px!important;font-weight:750!important;line-height:1.2!important;color:#071227!important;white-space:nowrap!important}
#app .ops-time b.ops-missing{color:#587397!important;font-weight:500!important}
#app .ops-time b.ops-estimated{color:#d98200!important}
#app .ops-time b.ops-estimated .ops-day{color:inherit!important}
#app .ops-time b.ops-ontime,#app .ops-time b.ops-ontime .ops-day{color:#0a8f5a!important}
#app .ops-time b.ops-late,#app .ops-time b.ops-late .ops-day{color:#d3213f!important}
#app .ops-day{font-size:11px!important;font-weight:500;margin-left:2px;vertical-align:baseline;color:#183a61}
#app .ops-status-context{display:flex;gap:4px 16px;flex-wrap:wrap;margin-top:9px;color:#4b6787;font-size:13px!important;line-height:1.4}
#app .flight-home-row.ops-flight-card>.ops-expand{grid-area:expand!important;width:32px!important;height:44px!important;min-height:44px!important;border:0!important;border-radius:7px!important;background:transparent!important;padding:4px!important;color:#123d67!important;cursor:pointer}
#app .ops-expand svg{width:22px;height:22px;transition:transform .15s}
#app .ops-expand[aria-expanded="true"] svg{transform:rotate(180deg)}
#app .flight-home-row.ops-flight-card>.ops-extra{grid-area:details!important;display:block!important;padding-top:18px;margin-top:18px;border-top:1px solid #e4edf5;color:#365472;font-size:13px}
#app .flight-home-row.ops-flight-card>.ops-extra[hidden]{display:none!important}
#app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity journey expand"!important}
#app .ops-extra strong{color:#102f50}
#app .ops-load-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;align-items:stretch}
#app .ops-extra .ops-load-info{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;padding:4px 8px 12px;min-width:0;min-height:78px;border-right:1px solid #e1e7ee;font-size:13px!important;font-weight:700;color:#8290a2;text-align:center}
#app .ops-extra .ops-load-info:last-child{border-right:0}
#app .ops-extra .ops-load-info strong{font-size:17px!important;font-weight:800!important;line-height:1.4;overflow-wrap:anywhere;color:#10233f}
#app .ops-extra-actions{display:flex;align-items:center;gap:10px 20px;flex-wrap:wrap;margin-top:14px}
#app .ops-extra .ops-open-detail{margin-left:auto;border:1px solid #c2d8ec;border-radius:8px;background:#f5faff;color:#0c559e;padding:9px 14px;font-size:13px;font-weight:700;min-height:40px}
#app .ops-extra .home-pin{width:40px!important;height:40px!important;font-size:22px!important;display:inline-block!important}
#app .ops-extra .home-pin.active{color:#c58900!important}
#app .ops-extra button:focus-visible,#app .ops-expand:focus-visible{outline:2px solid #3188db;outline-offset:2px}
@media(max-width:1199px) and (min-width:721px){
 #app .flight-home-row.ops-flight-card{grid-template-columns:minmax(260px,1fr) minmax(0,1.7fr) 28px!important;grid-template-areas:"identity journey expand" "details details details"!important;gap:16px!important;padding:20px!important}
 #app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity journey expand"!important}
 #app .ops-flight-number{font-size:25px!important}#app .ops-airline-name,#app .ops-aircraft{font-size:14px!important}
 #app .ops-airport-code{font-size:24px!important}#app .ops-route{gap:12px!important;grid-template-columns:auto 1fr auto!important}
 #app .ops-time-group{padding:12px 7px!important;gap:2px!important}#app .ops-time b{font-size:17px!important}#app .ops-time small{font-size:11px!important}
}
@media(min-width:721px) and (max-width:1000px){#app .ops-times{grid-template-columns:1fr!important}}
@media(max-width:720px){
 #app .flight-home-list{gap:14px!important}
 #app .flight-home-row.ops-flight-card{grid-template-columns:minmax(0,1fr) 30px!important;grid-template-areas:"identity expand" "journey journey" "details details"!important;gap:16px 8px!important;padding:16px 13px!important;min-height:0!important;border-radius:13px!important;overflow:visible!important}
 #app .flight-home-row.ops-flight-card:has(>.ops-extra[hidden]){grid-template-areas:"identity expand" "journey journey"!important}
 #app .ops-logo,#app .ops-logo .airline-logo,#app .ops-logo .airline-logo-fallback{max-width:72px!important;height:40px!important;max-height:40px!important}
 #app .ops-logo{height:40px}#app .ops-logo-symbol{width:36px!important;height:40px!important}#app .ops-flight-line .ops-flight-number{line-height:40px!important}
 #app .ops-flight-number{font-size:25px!important}#app .ops-airline-name,#app .ops-aircraft{font-size:14px!important;margin-top:2px}
 #app .ops-route{grid-template-columns:auto minmax(25px,1fr) auto!important;gap:10px!important;margin-bottom:13px!important}
 #app .ops-airport-code{font-size:25px!important;gap:6px}#app .ops-airport-city{font-size:14px!important}#app .ops-flag{font-size:20px}
 #app .ops-times{grid-template-columns:1fr!important;gap:8px!important}#app .ops-time-group{padding:11px 6px!important;gap:3px!important}#app .ops-time small{font-size:11px!important}#app .ops-time b{font-size:20px!important;margin-top:5px!important}#app .ops-day{font-size:11px!important}
 #app .ops-flight-line{gap:7px}#app .ops-status-badge{padding:5px 8px;font-size:11px!important}
 #app .ops-aircraft{gap:4px 8px}#app .ops-aircraft-location{font-size:10px!important}#app .ops-aircraft-location strong,#app .ops-registration{font-size:14px!important}
 #app .flight-home-row.ops-flight-card>.ops-extra{gap:12px;margin-top:0;padding-top:14px}#app .ops-extra .ops-open-detail{margin-left:0;width:100%}
 #app .ops-extra .ops-load-info{padding:4px 4px 10px}#app .ops-extra .ops-load-info strong{font-size:16px!important}
}
@media(prefers-reduced-motion:reduce){#app .ops-expand svg{transition:none}}
#app .flight-home-row.ops-flight-card[style*="display: none"],#app .flight-home-row.ops-flight-card.alyzia-final-time-hidden,#app .flight-home-row.ops-flight-card.alyzia-auto-past-hidden{display:none!important}
#app .home-print-btn{display:none!important}
.nav-plane{display:block;margin:auto}
/* flight sheet header: status badge, A/C + cabin buttons, time tones */
#app .v2x-detail-head{grid-template-columns:minmax(260px,1fr) minmax(420px,2fr)!important;grid-template-areas:"did dtimes" "did dactions"!important}
@media(max-width:900px){#app .v2x-detail-head{grid-template-columns:1fr!important;grid-template-areas:"did" "dtimes" "dactions"!important}}
#app .v2x-d-flightline{flex-wrap:wrap}
#app .v2x-d-flightline .ops-status-badge{font-size:13px!important}
#app .v2x-d-id .ops-status-context{margin-top:8px;font-size:13px!important}
#app .v2x-chip-btn{cursor:pointer;font-family:inherit}
#app .v2x-chip-btn:hover{border-color:#8fb8e6;background:#eef6ff}
#app .v2x-chip-btn.missing{border-color:#efbd76;background:#fffaf2;color:#a66006}
#app .v2x-chip-change{border-color:#efc3ca;background:#fff7f8;color:#bd3047}
#app .v2x-d-t b.ops-ontime{color:#0a8f5a!important}
#app .v2x-d-t b.ops-late{color:#d3213f!important}
#app .v2x-d-t b.ops-estimated{color:#d98200!important}
@media print{#app .flight-home-row.ops-flight-card{break-inside:avoid!important}#app .ops-expand{visibility:hidden}}
</style>`;

// Inserted inside the existing UI controller so it shares its live refresh and escaping helpers.
export const REFERENCE_LIST_RENDERER = "const ALY_TYPES="+clientSeatmapTypeSource()+";\n"+String.raw`
const expandedFlights=new Set();
// ---- Aircraft type -> seatmap type and cabin configuration ----
// Displayed type = type converted to the Seatmap code (359, 77W, 32Q…); the cabin configuration follows that type.
function opsType(x){const raw=txt((x&&x.aircraftChange&&x.aircraftChange.to)||x?.aircraft||x?.aircraftActual);return raw?(ALY_TYPES.toIata(raw)||ALY_TYPES.toIata(raw.replace(/^B(?=7\d\d)/i,'Boeing '))||up(raw)):''}
function opsSameType(a,b){const A=up(a),B=up(b);return !A||!B||ALY_TYPES.configCodes(A).includes(B)}
function opsCatalog(){try{return typeof SARIA_CATALOG!=='undefined'&&Array.isArray(SARIA_CATALOG)?SARIA_CATALOG:[]}catch{return []}}
// Same preference as the server auto-injection: exact flight prefix, then company-wide plan, then first by key; exact type before equivalent codes.
function opsPickByType(x,type){
 const al=up(x?.airline||String(x?.flight||'').replace(/\d.*$/,'')),fn=up(x?.flight);if(!al||!type)return null;
 const key=e=>txt(e.config_key||[e.cie,e.ac,e.config].join('|'));
 for(const code of ALY_TYPES.configCodes(type)){
  const rows=opsCatalog().filter(e=>up(e.cie)===al&&up(e.ac)===code);if(!rows.length)continue;
  const prefix=e=>up(key(e).split('|')[0]);
  return rows.find(e=>fn&&prefix(e)===fn)||rows.find(e=>prefix(e)===al)||[...rows].sort((a,b)=>key(a).localeCompare(key(b)))[0];
 }
 return null;
}
(function wrapSeatmapChoice(){
 try{
  const base=window.sariaSelectedEntry;
  if(typeof base==='function'&&!base.__alyType){
   const wrapped=function(x){
    if(x===undefined)x=typeof f==='function'?f():null;
    const entry=base(x);if(!x)return entry;
    // A cabin version chosen by hand always wins; otherwise the plan must belong to the flight's aircraft type.
    if(x.cabinConfigAuto===false&&entry)return entry;
    const type=opsType(x);if(!type||(entry&&opsSameType(entry.ac,type)))return entry;
    return opsPickByType(x,type)||entry;
   };
   wrapped.__alyType=true;window.sariaSelectedEntry=wrapped;
  }
  // The VERSION CABINE list of a type also offers the plans filed under an equivalent code (772 -> 777, 32Q -> N32…).
  const baseConfigs=window.sariaConfigsFor;
  if(typeof baseConfigs==='function'&&!baseConfigs.__alyType){
   const wrappedConfigs=function(cie,ac){const seen=new Set(),out=[];for(const code of ALY_TYPES.configCodes(up(ac))){for(const e of baseConfigs(cie,code)){if(!seen.has(e)){seen.add(e);out.push(e)}}}return out};
   wrappedConfigs.__alyType=true;window.sariaConfigsFor=wrappedConfigs;
  }
  // The flight sheet follows the type too: missing classes are filled from the plan, classes of a previous type with nothing booked are dropped.
  const baseRender=window.render;
  if(typeof baseRender==='function'&&!baseRender.__alyType){
   const wrappedRender=function(...args){try{opsSyncConfigToType(typeof f==='function'?f():null)}catch{}return baseRender.apply(this,args)};
   wrappedRender.__alyType=true;window.render=wrappedRender;
  }
  if(typeof loadSariaCatalog==='function')loadSariaCatalog().then(()=>{try{document.querySelectorAll('#app .flight-home-row').forEach(r=>delete r.dataset.opsSig)}catch{}}).catch(()=>{});
 }catch{}
})();
function opsSyncConfigToType(x){
 if(!x||typeof sariaSelectedEntry!=='function'||typeof sariaClassObject!=='function')return;
 const entry=sariaSelectedEntry(x);if(!entry)return;
 const cfg=sariaClassObject(entry),keys=Object.keys(cfg);if(!keys.length)return;
 x.config=x.config&&typeof x.config==='object'?x.config:{};
 for(const k of keys)if(!(k in x.config))x.config[k]=Number(cfg[k]||0);
 const own=x.sariaConfigKey&&typeof sariaConfigKey==='function'&&sariaConfigKey(entry)===x.sariaConfigKey;
 if(!own&&x.cabinConfigAuto!==false)for(const k of Object.keys(x.config))if(!keys.includes(k)&&!Number(x.booked?.[k]||0))delete x.config[k];
}
const opsPlane='<svg class="ops-plane-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m21 12-7-4V3a2 2 0 0 0-4 0v5l-7 4v2l7-2v5l-2 2v2l4-1 4 1v-2l-2-2v-5l7 2z" transform="rotate(90 12 12)"/></svg>';
const opsCountry={CDG:'FR',ORY:'FR',NCE:'FR',LIL:'FR',LRT:'FR',PUF:'FR',CHR:'FR',LIG:'FR',SYS:'FR',QIE:'FR',SIN:'SG',ICN:'KR',HND:'JP',IST:'TR',SAW:'TR',ESB:'TR',AYT:'TR',ALG:'DZ',ORN:'DZ',CZL:'DZ',AAE:'DZ',TLM:'DZ',CFK:'DZ',QSF:'DZ',BLJ:'DZ',BSK:'DZ',ELU:'DZ',DUB:'IE',SNN:'IE',NOC:'IE',TLV:'IL',LCA:'CY',TUN:'TN',DJE:'TN',MIR:'TN',TTU:'MA',CPH:'DK',ARN:'SE',SVG:'NO',OSL:'NO',LYR:'NO',FRA:'DE',LEJ:'DE',BER:'DE',WAW:'PL',KTW:'PL',PRG:'CZ',SOF:'BG',BEG:'RS',ZAD:'HR',TIA:'AL',ATH:'GR',CMN:'MA',RBA:'MA',RAK:'MA',OUD:'MA',KEF:'IS',PDL:'PT',CAI:'EG',LXR:'EG',KUL:'MY',BKK:'TH',YUL:'CA',YYZ:'CA',YQB:'CA',DEL:'IN',ABJ:'CI',KGL:'RW',AMM:'JO',KWI:'KW',BOG:'CO',GRU:'BR',MIA:'US',JFK:'US',GYD:'AZ',TBS:'GE',SEZ:'SC',CKG:'CN',SZX:'CN',XIY:'CN',BRU:'BE',MST:'NL',LBA:'GB',LGW:'GB',BQH:'GB',OPO:'PT',BCN:'ES',IBZ:'ES',ACE:'ES',FUE:'ES',MXP:'IT',VRN:'IT',PMO:'IT',SUF:'IT',BLQ:'IT',GOH:'GL',SFJ:'GL'};
function opsTitle(value){return txt(value).toLocaleLowerCase('fr').replace(/(^|[\s-])(\p{L})/gu,(_,space,c)=>space+c.toLocaleUpperCase('fr'))}
function opsCity(code){try{return opsTitle((typeof CITY!=='undefined'&&CITY[code])||city(code))}catch{return code||''}}
function opsAirlineLogo(x,idx){
 const marks={SQ:{view:'397 0 83 112',width:480,height:112},OZ:{view:'363 29 90 91',width:480,height:173},TU:{view:'28 46 183 146',width:240,height:240},TB:{view:'50 30 215 172',width:314,height:202}},mark=marks[up(x.airline)];
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
function opsClockMin(v){const c=clock(v);return c?Number(c.slice(0,2))*60+Number(c.slice(3)):null}
// Green = at or before schedule (STD for ETD/ATD/TO, STA for ETA/ATA/LDG). After schedule: red for actual times, orange for estimates.
function opsTimeTone(label,value,t){
 const sched={ETD:t.std,ATD:t.std,TO:t.std,ETA:t.sta,ATA:t.sta,LDG:t.sta}[label];if(sched===undefined)return '';
 const a=opsClockMin(sched),b=opsClockMin(value);if(a===null||b===null)return '';
 let d=b-a;if(d<-720)d+=1440;if(d>720)d-=1440;
 return d<=0?'ops-ontime':(label==='ETD'||label==='ETA')?'ops-estimated':'ops-late';
}
function opsTimeCell(label,value,day,t){const cls=!value?'ops-missing':opsTimeTone(label,value,t||{});return '<div class="ops-time"><small>'+label+'</small><b class="'+cls+'">'+esc(value||'—')+(value&&day?'<span class="ops-day">'+(day>0?'+':'')+day+'</span>':'')+'</b></div>'}
function opsWeather(code){let html='';try{if(typeof wxInner==='function')html=wxInner(up(code))}catch{}return '<div class="wx-line wx-mini" data-wx="'+esc(up(code))+'" aria-label="Météo '+esc(code)+'">'+html+'</div>'}

function opsTimes(x){const s=safeSchedule(x),t=times(x);return {...t,sta:clock(val(x,'sta','scheduledArrival','scheduled_arrival')),eta:clock(val(x,'eta','estimatedArrival','estimated_arrival')),staDay:Number(x.staDay??s.staDay)||0,etaDay:Number(x.etaDay??s.etaDay)||0,landingDay:Number(x.landingDay)||0}}
function opsLocalUtc(date,time,code,day=0){
 const m=txt(date).match(/^(\d{4})-(\d{2})-(\d{2})$/),c=clock(time);if(!m||!c)return null;
 let zone;try{zone=typeof AIRPORT_TZ!=='undefined'?AIRPORT_TZ[up(code)]:null}catch{}if(!zone)return null;
 const [h,n]=c.split(':').map(Number),base=Date.UTC(+m[1],+m[2]-1,+m[3]+day,h,n);let guess=base;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));guess=base-(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-guess)}return guess;
}
function opsMinutes(n){const m=Math.max(0,Math.floor(n));return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'}
function opsDate(x){let d=txt(x.activeDate||x.date||'');if(!d){try{d=txt(HOME_DATE)}catch{}}return d}
function opsDepartureUtc(x,t){
 const actual=t.takeoff||t.atd;if(!actual)return null;
 const std=opsClockMin(t.std),at=opsClockMin(actual),day=Number((t.takeoff?x.takeoffDay:x.atdDay)??(std!==null&&at!==null&&std-at>720?1:0))||0;
 return opsLocalUtc(opsDate(x),actual,x.dep||x.origin||'CDG',day);
}
function opsArrivalUtc(x,t){
 let arrival=Date.parse(txt(x.statusArrivalUtc));
 if(!Number.isFinite(arrival))arrival=opsLocalUtc(opsDate(x),t.eta||t.sta,x.dest||x.destination,t.eta?t.etaDay:t.staDay);
 return Number.isFinite(arrival)?arrival:null;
}
// Share of the flight already flown (0..1) from takeoff/ATD to ETA/STA; null when it cannot be computed.
function opsProgress(x,t,st){
 if(t.ata||t.landing||/^(ARRIV|ATTERR)/.test(up(st.main)))return 1;
 const departure=opsDepartureUtc(x,t);if(departure===null)return up(st.main)==='EN VOL'?null:0;
 let arrival=opsArrivalUtc(x,t);if(arrival===null)return null;
 if(arrival<=departure)arrival+=86400000;
 return Math.min(1,Math.max(0,(Date.now()-departure)/(arrival-departure)));
}
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
 if(/^ETD\b/i.test(st.sub))st.sub='';
 if(/^(PROGRAMM[ÉE]|PR[ÉE]VU)$/.test(up(st.main)))st.main='À L’HEURE';
 return st;
}
function opsLoad(x){
 // Classes come from the seatmap actually selected for the flight, then the company configuration (companyClassesForFlight).
 let ks;try{ks=typeof companyClassesForFlight==='function'?companyClassesForFlight(x):classKeys(x)}catch{ks=classKeys(x)}
 if(!Array.isArray(ks)||!ks.length)ks=classKeys(x);
 // Configuration of the aircraft type: classes AND seat counts come from the seatmap plan (wrapped sariaSelectedEntry); the flight's own config is only a fallback without plan.
 let planned={};
 try{const entry=typeof sariaSelectedEntry==='function'?sariaSelectedEntry(x):null;if(entry){planned=sariaClassObject(entry);if(Object.keys(planned).length&&typeof cabinOrderedClassKeys==='function')ks=cabinOrderedClassKeys(Object.keys(planned))}}catch{}
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null,PAIRS={J:'C',C:'J',Y:'M',M:'Y'};
 // A cabin stored under its twin code (J/C, Y/M) still counts for the class the seatmap uses.
 const get=(o,k)=>{if(!o||typeof o!=='object')return null;if(k in o)return number(o[k]);const twin=PAIRS[k];return twin&&twin in o&&!ks.includes(twin)?number(o[twin]):null};
 const seatmapCfg=Object.keys(planned).length>0,cfgOf=k=>seatmapCfg?(k in planned?number(planned[k]):null):get(x.config,k),fmt=o=>ks.map(k=>k+(get(o,k)??0)).join(' · ')||'—';
 const cfgKnown=ks.some(k=>cfgOf(k)!==null);
 const capacity=ks.reduce((s,k)=>s+(cfgOf(k)??0),0),booked=ks.reduce((s,k)=>s+(get(x.booked,k)??0),0),nok=(x.inopSeats||[]).filter(r=>up(r?.status)==='NOK').length;
 return {cfg:cfgKnown?ks.map(k=>k+(cfgOf(k)??0)).join(' · '):'—',book:fmt(x.booked),avail:number(x.available)??(cfgKnown?capacity-booked-nok:'—'),nok};
}
function renderRow(row){
 const resolved=opsFlightForRow(row);if(!resolved)return;const {x,idx}=resolved,flight=keyFlight(x),t=opsTimes(x),st=opsListStatus(x,t),term=terminalOf(x)||((typeof AIRLINE_TERMINAL!=='undefined'&&AIRLINE_TERMINAL[up(x.airline)])||''),load=opsLoad(x),progress=opsProgress(x,t,st),dep=x.dep||x.origin||'CDG',dest=x.dest||x.destination||'—',ac=opsType(x)||'—',reg=val(x,'reg','registration','aircraftRegistration')||'—';
 const key=[flight,x.activeDate||x.date,dep,dest].join('|'),expanded=expandedFlights.has(key),isFav=favorite(x);
 let name=x.airline;try{if(typeof airlineDisplayName==='function')name=opsTitle(airlineDisplayName(x.airline))}catch{}
 const notes=Array.isArray(x.flightNotes)?x.flightNotes.filter(n=>txt(n?.text)).length:0;
 const sig=JSON.stringify([idx,flight,name,dep,dest,t,st,ac,reg,x.gate,term,load,isFav,notes,expanded,progress===null?null:Math.round(progress*100)]);if(row.dataset.opsSig===sig)return;
 row.dataset.opsSig=sig;row.classList.remove('v2x-row');row.classList.add('ops-flight-card');row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label','Ouvrir la fiche du vol '+flight);
 row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openFlightFromHomeList(idx)}};
 let badge='';try{if(typeof prepaBadge==='function')badge=prepaBadge(x,x.activeDate||x.date)}catch{}
 row.innerHTML='<div class="ops-identity"><div class="ops-flight-line"><span class="ops-logo">'+opsAirlineLogo(x,idx)+'</span><span class="ops-flight-number">'+esc(flight)+'</span><span class="ops-status-badge '+st.cls+'">'+esc(st.main)+'</span></div><div><div class="ops-airline-name">'+esc(name)+'</div><div class="ops-aircraft"><strong class="ops-aircraft-type">'+esc(ac)+'</strong><span class="ops-aircraft-location ops-terminal" data-terminal="'+esc((up(term).match(/^T[123]/)||[])[0]||'')+'">TERMINAL <strong>'+esc(term||'—')+'</strong></span><span class="ops-aircraft-location">GATE <strong>'+esc(x.gate||'—')+'</strong></span></div><div class="ops-registration">'+esc(reg)+'</div></div></div>'+
 '<div class="ops-journey"><div class="ops-route"><div><div class="ops-airport-code">'+esc(dep)+opsFlag(dep)+'</div><div class="ops-airport-meta"><div class="ops-airport-city">'+esc(opsCity(dep))+'</div>'+opsWeather(dep)+'</div></div><div class="ops-route-line'+(progress===null?' static':'')+'" style="--p:'+(progress===null?.5:progress.toFixed(3))+'" role="img" aria-label="'+(progress===null?'Trajet':'Progression du vol '+Math.round(progress*100)+' %')+'"><span class="ops-route-track"></span><span class="ops-route-fill"></span>'+opsPlane+'</div><div><div class="ops-airport-code">'+esc(dest)+opsFlag(dest)+'</div><div class="ops-airport-meta"><div class="ops-airport-city">'+esc(opsCity(dest))+'</div>'+opsWeather(dest)+'</div></div></div>'+
 '<div class="ops-times"><div class="ops-time-group">'+opsTimeCell('STD',t.std)+opsTimeCell('ETD',t.etd,0,t)+opsTimeCell('ATD',t.atd,0,t)+opsTimeCell('TO',t.takeoff,0,t)+'</div><div class="ops-time-group">'+opsTimeCell('STA',t.sta,t.staDay)+opsTimeCell('ETA',t.eta,t.etaDay,t)+opsTimeCell('LDG',t.landing,t.landingDay,t)+opsTimeCell('ATA',t.ata,t.ataDay,t)+'</div></div>'+((st.sub||st.remain)?'<div class="ops-status-context">'+(st.sub?'<span>'+esc(st.sub)+'</span>':'')+(st.remain?'<span>'+esc(st.remain)+'</span>':'')+'</div>':'')+'</div>'+
 '<button type="button" class="ops-expand" aria-label="Détails du vol '+esc(flight)+'" aria-expanded="'+expanded+'" aria-controls="ops-extra-'+idx+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg></button>'+
 '<div id="ops-extra-'+idx+'" class="ops-extra"'+(expanded?'':' hidden')+'><div class="ops-load-summary"><span class="ops-load-info">CONFIG <strong>'+esc(load.cfg)+'</strong></span><span class="ops-load-info">BOOKING <strong>'+esc(load.book)+'</strong></span><span class="ops-load-info">AVAILABLE <strong>'+esc(load.avail)+'</strong></span></div><div class="ops-extra-actions">'+(load.nok?'<span>INOP <strong>'+load.nok+'</strong></span>':'')+badge+
 '<button type="button" class="home-pin '+(isFav?'active':'')+'" aria-label="'+(isFav?'Retirer des favoris':'Ajouter aux favoris')+'" aria-pressed="'+isFav+'">'+(isFav?'★':'☆')+'</button>'+(notes?'<button type="button" class="ops-notes">🔔 '+notes+' note'+(notes>1?'s':'')+'</button>':'')+'<button type="button" class="ops-open-detail">Ouvrir la fiche vol →</button></div></div>';
 row.querySelector('.ops-expand').onclick=e=>{e.stopPropagation();if(expandedFlights.has(key))expandedFlights.delete(key);else expandedFlights.add(key);renderRow(row)};
 row.querySelector('.home-pin').onclick=e=>{e.stopPropagation();toggleFavoriteFlight(idx)};
 row.querySelector('.ops-open-detail').onclick=e=>{e.stopPropagation();openFlightFromHomeList(idx)};
 const noteButton=row.querySelector('.ops-notes');if(noteButton)noteButton.onclick=e=>{e.stopPropagation();if(typeof openHomeNotesFromList==='function')openHomeNotesFromList(idx)};
}
`;
