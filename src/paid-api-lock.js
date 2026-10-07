// API payantes écartées : même si un secret est encore défini côté Cloudflare, le code de l'application ne le voit plus
// (les modules « fournisseurs » testent `env.XXX_API_KEY` et s'arrêtent s'il est absent). Réactivation explicite avec PAID_APIS_ENABLED=1.
export const PAID_SECRETS=["AERODATABOX_API_KEY","AIRLABS_API_KEY","AVIATIONDATA_RAPIDAPI_KEY","OAG_API_KEY","QUARK_RAPIDAPI_KEY","SKYLINK_API_KEY"];
const LOCKED=new Set(PAID_SECRETS);
export const paidApisEnabled=env=>String(env?.PAID_APIS_ENABLED??"").trim()==="1";
export function lockPaidApis(env){
  if(!env||paidApisEnabled(env))return env;
  return new Proxy(env,{get:(t,k)=>LOCKED.has(k)?undefined:t[k],has:(t,k)=>LOCKED.has(k)?false:k in t});
}
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
// Lecture seule : quels secrets payants sont encore définis (booléens, jamais les valeurs), le verrou, et les appels enregistrés aujourd'hui.
export async function paidApiStatus(env){
  const out={ok:true,mode:"PAID_APIS_STATUS_NO_WRITE",locked:!paidApisEnabled(env),secretsConfigured:Object.fromEntries(PAID_SECRETS.map(k=>[k,Boolean(String(env?.[k]??"").trim())])),usageToday:[]};
  try{const {results=[]}=await env.OPS_DB.prepare(`SELECT provider,calls,successes,errors,last_status,last_at FROM api_provider_usage WHERE period=?`).bind(parisDate()).all();out.usageToday=results}catch(e){out.usageError=String(e?.message||e).slice(0,120)}
  out.verdict=out.locked?"VERROUILLÉ : aucune API payante n'est appelée par le code, même si un secret est défini":"DÉVERROUILLÉ (PAID_APIS_ENABLED=1)";
  return out;
}
