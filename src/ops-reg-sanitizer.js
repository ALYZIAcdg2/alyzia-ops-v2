import {isJunkRegistration} from './registration-guard.js';
const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const INVALID=/^(?:ON[ -]?TIME|SCHEDULED|DELAYED|DEPARTED|ARRIVED|LANDED|IN[ -]?AIR|AIRBORNE|EN[ -]?VOL|PREVU|PRÉVU|RETARDE|RETARDÉ|PARTI|CANCELLED|CANCELED|ANNULÉ|N\/A|NULL|UNKNOWN)$/i;
function bad(v){const s=clean(v);return !!s&&(INVALID.test(s)||isJunkRegistration(s))}
const FIELDS=['reg','registration','aircraftRegistration','aircraft_registration','immat','immatriculation','tailNumber','tail_number','registrationNumber'];
const stdMin=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null};
const normReg=v=>upper(v).replace(/[^A-Z0-9]/g,'');
const TRUSTED=/MANUAL|FR24BOARD/;
// Un même avion ne peut pas partir de CDG deux fois à moins de 2 h d'intervalle : une immatriculation lue sur plusieurs vols proches (D-AIHV sur KU168, AH1001, AH1163, LY324) vient d'une page publique mal lue.
// Elle est retirée des vols dont l'immatriculation ne vient ni de FR24 tableau ni d'une saisie manuelle ; FR24 tableau la remplit ensuite.
export function duplicateRegistrationIds(rows){
  const groups=new Map();
  for(const r of rows){const x=r.x,reg=normReg(x.reg||x.registration||x.aircraftRegistration),m=stdMin(x.std||r.std);if(!reg||m===null||upper(x.origin||'CDG')!=='CDG')continue;if(!groups.has(reg))groups.set(reg,[]);groups.get(reg).push({r,m})}
  const out=new Set();
  for(const list of groups.values()){if(list.length<2)continue;
    for(const a of list)if(list.some(b=>b!==a&&Math.abs(a.m-b.m)<120)&&!TRUSTED.test(upper(a.r.x.regSource||a.r.x.registrationSource)))out.add(a.r.identity)}
  return out;
}

// Valeurs d'immatriculation portées par les autres vols du jour (une valeur déjà vue ailleurs n'est pas récupérée).
function usedElsewhere(rows,row){const set=new Set();for(const r of rows){if(r===row)continue;for(const k of ['reg','registration','aircraftRegistration']){const v=normReg(r.x?.[k]);if(v)set.add(v)}}return set}
// Parmi les champs retirés, la première valeur valide (ni invalide, ni vue sur un autre vol, ni égale à la valeur dupliquée) ; sinon ''.
export function salvageRegistration(x,hits,others,dupValue=''){
  const dup=normReg(dupValue||x.reg||x.registration);
  for(const k of ['aircraftRegistration','aircraft_registration','registration','reg','immat','tailNumber']){
    if(!hits.includes(k))continue;const v=upper(x[k]),n=normReg(v);
    if(v&&!bad(v)&&n&&n!==dup&&!others.has(n))return v;
  }
  return '';
}
// Vols déjà vidés : la ligne de journal REG_DUPLICATE / REG_SANITIZER garde les anciennes valeurs (« REG=D-AIHV / AIRCRAFTREGISTRATION=SP-LVA »).
export function registrationFromLog(x,others){
  if(clean(x.reg||x.registration||x.aircraftRegistration))return '';
  const e=(Array.isArray(x.flightInfoLog)?x.flightInfoLog:[]).find(l=>/^REG_(DUPLICATE|SANITIZER)$/.test(upper(l?.source))&&!clean(l?.to)&&/=/.test(String(l?.from||'')));
  if(!e)return '';
  const pairs=String(e.from).split(' / ').map(p=>p.split('=')).filter(p=>p.length===2).map(([k,v])=>[k.trim().toLowerCase(),upper(v)]);
  const dup=normReg((pairs.find(p=>p[0]==='reg')||pairs.find(p=>p[0]==='registration')||[])[1]);
  for(const [k,v] of pairs){const n=normReg(v);if(k==='aircraftregistration'&&v&&!bad(v)&&n&&n!==dup&&!others.has(n))return v}
  return '';
}
export async function sanitizeTodayRegistrations(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const at=new Date().toISOString();let updated=0,fieldsCleared=0;
  const parsed=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||'{}')}catch{}return {...r,x}}),dups=duplicateRegistrationIds(parsed);
  for(const row of parsed){const x=row.x;
    const back=registrationFromLog(x,usedElsewhere(parsed,row));
    if(back){x.reg=back;x.registration=back;x.aircraftRegistration=back;x.regSource='REG_SANITIZER_KEPT';x.regUpdatedAt=at;const lg=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];lg.unshift({at,source:'REG_SANITIZER_RESTORED',field:'reg',from:'',to:back});x.flightInfoLog=lg.slice(0,240);
      await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;continue}
    const hits=FIELDS.filter(k=>bad(x[k])||(dups.has(row.identity)&&clean(x[k])&&['reg','registration','aircraftRegistration'].includes(k)));if(!hits.length)continue;
    const before=hits.map(k=>`${k}=${clean(x[k])}`).join(' / ');
    // Un autre champ d'immatriculation peut porter la bonne valeur (ex. reg = registration = D-AIHV sur deux vols, aircraftRegistration = SP-LVA) : on la garde.
    const keep=salvageRegistration(x,hits,usedElsewhere(parsed,row));
    for(const k of hits){delete x[k];fieldsCleared++}
    for(const k of ['regSource','registrationSource','aircraftRegistrationSource','immatSource','immatriculationSource','tailNumberSource']){
      if(upper(x[k]).startsWith('PUBLIC')||upper(x[k]).includes('FR24')||upper(x[k]).includes('FLIGHT'))delete x[k];
    }
    for(const k of ['regUpdatedAt','registrationUpdatedAt','aircraftRegistrationUpdatedAt','immatUpdatedAt','immatriculationUpdatedAt','tailNumberUpdatedAt'])delete x[k];
    if(keep){x.reg=keep;x.registration=keep;x.aircraftRegistration=keep;x.regSource='REG_SANITIZER_KEPT';x.regUpdatedAt=at}
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:dups.has(row.identity)?'REG_DUPLICATE':'REG_SANITIZER',field:'reg',from:before,to:keep||''});x.flightInfoLog=log.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;
  }
  return {ok:true,date,updated,fieldsCleared};
}
