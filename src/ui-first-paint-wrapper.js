import app from "./ui-stability-wrapper.js";
import {handleWeather} from "./weather.js";
import {guardApi} from "./api-guard.js";
import providerPolicyScheduler,{refreshProviderQueue} from "./provider-policy-scheduler.js";
import {runFr24DepQueue} from "./fr24dep-queue-runner.js";
import {runFlighteraQueue} from "./flightera-queue-runner.js";
import {runKayakQueue} from "./kayak-queue-runner.js";
import {runSerpapiQueue} from "./serpapi-queue-runner.js";
import {runFr24ApiQueue} from "./fr24api-queue-runner.js";
import {runCdgBoardQueue} from "./cdgboard-queue-runner.js";
import {runFlightradar1Queue,runFlightradar8Queue} from "./flightradar1-queue-runner.js";
import {handleOpenSkyIngest} from "./opensky-live-wrapper.js";
import {handlePublicWebDayTest} from "./public-web-day-test.js";

const FIRST_PAINT=String.raw`<style id="alyzia-first-paint-guard-css">html:not(.alyzia-ui-stability-ready) #app{visibility:hidden!important}</style>`;

function patch(html){
  const s=String(html||'');
  if(s.includes('id="alyzia-first-paint-guard-css"'))return s;
  const h=s.indexOf('<head>');
  return h>=0?s.slice(0,h+6)+FIRST_PAINT+s.slice(h+6):FIRST_PAINT+s;
}

const jsonResp=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
const liveApisEnabled=env=>String(env?.ALYZIA_LIVE_APIS_ENABLED||"").trim().toLowerCase()==="true";

async function adminPushNow(request,env,ctx){
  if(!liveApisEnabled(env))return jsonResp({ok:false,error:"LIVE_APIS_DISABLED"},423);
  if(request.method!=="POST")return jsonResp({ok:false,error:"METHOD"},405);
  const day=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris"}).format(new Date());
  try{
    await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS api_provider_usage(provider TEXT NOT NULL,period TEXT NOT NULL,calls INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0,last_status INTEGER,last_at TEXT,PRIMARY KEY(provider,period))`).run();
    const last=await env.OPS_DB.prepare(`SELECT last_at FROM api_provider_usage WHERE provider='ADMIN_PUSH' AND period='last'`).first();
    const wait=60000-(Date.now()-(Date.parse(last?.last_at||"")||0));
    if(wait>0)return jsonResp({ok:false,error:"TROP_RAPIDE",retryInSeconds:Math.ceil(wait/1000)},429);
    await env.OPS_DB.prepare(`INSERT INTO api_provider_usage(provider,period,calls,successes,errors,last_status,last_at) VALUES('ADMIN_PUSH','last',1,1,0,200,?) ON CONFLICT(provider,period) DO UPDATE SET calls=calls+1,last_at=excluded.last_at`).bind(new Date().toISOString()).run();
  }catch(_){}
  const snapshot=async()=>{try{const {results=[]}=await env.OPS_DB.prepare(`SELECT provider,calls FROM api_provider_usage WHERE period=?`).bind(day).all();const m={};for(const r of results){const k=String(r.provider||"").toUpperCase().replace(/_.*/,"");m[k]=(m[k]||0)+Number(r.calls||0)}return m}catch{return {}}};
  const before=await snapshot(),t0=Date.now();
  globalThis.__ALYZIA_MANUAL_PUSH=true;
  const steps=[["QUEUE",refreshProviderQueue],["FR24DEP",runFr24DepQueue],["FLIGHTERA",runFlighteraQueue],["CDGBOARD",runCdgBoardQueue],["KAYAK",runKayakQueue],["SERPAPI",runSerpapiQueue],["FR24API",runFr24ApiQueue],["FLIGHTRADAR8",runFlightradar8Queue],["FLIGHTRADAR1",runFlightradar1Queue]];
  const results={},started=Date.now();
  const work=(async()=>{for(const [name,fn] of steps){if(Date.now()-started>22000){results[name]="ignoré (temps)";continue}try{const r=await fn(env);results[name]=r?.skipped||"ok"}catch(e){results[name]="erreur: "+String(e?.message||e).slice(0,80)}}})();
  const timedOut=await Promise.race([work.then(()=>false),new Promise(r=>setTimeout(()=>r(true),26000))]);
  if(timedOut){ctx?.waitUntil?.(work.finally(()=>{globalThis.__ALYZIA_MANUAL_PUSH=false}))}
  else globalThis.__ALYZIA_MANUAL_PUSH=false;
  const after=await snapshot(),calls={};
  for(const k of Object.keys(after)){const d=after[k]-(before[k]||0);if(d>0&&k!=="ADMIN")calls[k]=d}
  return jsonResp({ok:true,durationMs:Date.now()-t0,calls,steps:results,partial:timedOut});
}

async function v2Status(env){
  const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris"}).format(new Date());
  const out={
    ok:true,
    service:"ALYZIA OPS V2",
    today,
    liveApisEnabled:liveApisEnabled(env),
    liveApisLocked:!liveApisEnabled(env),
    testCarriers:String(env?.ALYZIA_V2_TEST_CARRIERS||""),
    autopilotEnabled:String(env?.ALYZIA_AUTOPILOT_ENABLED||"").toLowerCase()==="true",
    flights:{today:0,tk:0},
    queue:{total:0,tk:0,providers:{}},
    apiUsageToday:{},
    schemaVersion:""
  };
  try{
    const row=await env.OPS_DB.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN airline='TK' THEN 1 ELSE 0 END) AS tk FROM flights WHERE flight_date=?`).bind(today).first();
    out.flights.today=Number(row?.total||0);
    out.flights.tk=Number(row?.tk||0);
  }catch(e){out.flights.error=String(e?.message||e)}
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT provider,COUNT(*) AS n,SUM(CASE WHEN flight_identity LIKE '%|TK|%' THEN 1 ELSE 0 END) AS tk FROM provider_enrichment_queue WHERE flight_date=? GROUP BY provider ORDER BY provider`).bind(today).all();
    for(const r of results){out.queue.providers[String(r.provider||"")]=Number(r.n||0);out.queue.total+=Number(r.n||0);out.queue.tk+=Number(r.tk||0)}
  }catch(e){out.queue.error=String(e?.message||e)}
  try{
    const {results=[]}=await env.OPS_DB.prepare(`SELECT provider,calls FROM api_provider_usage WHERE period=? ORDER BY provider`).bind(today).all();
    for(const r of results)out.apiUsageToday[String(r.provider||"")]=Number(r.calls||0);
  }catch(e){out.apiUsageError=String(e?.message||e)}
  try{
    const row=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='schema_version' LIMIT 1`).first();
    out.schemaVersion=String(row?.v||"");
  }catch(e){out.schemaError=String(e?.message||e)}
  return jsonResp(out);
}

export default {
  async fetch(request,env,ctx){
    const denied=guardApi(request,env);
    if(denied)return denied;
    const publicTest=await handlePublicWebDayTest(request,env);
    if(publicTest)return publicTest;
    let bakeFallback="";
    if(!globalThis.__ALYZIA_BAKING&&(request.method==="GET"||request.method==="HEAD")){
      const path=new URL(request.url).pathname;
      if(path==="/"||path==="/index.html"){
        try{
          const r=await env.ASSETS.fetch(new Request(new URL("/baked-index",request.url),{method:request.method}));
          if(r.status===200){
            return new Response(r.body,{status:200,headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-cache","x-alyzia-page":"baked"}});
          }
          bakeFallback=`page-${r.status};`;
        }catch(e){bakeFallback="page-erreur:"+String(e?.message||e).slice(0,60)+";"}
      }
    }
    const pathname=new URL(request.url).pathname;
    if(pathname==="/api/v2/status")return v2Status(env);
    if(pathname==="/api/opensky/ingest")return handleOpenSkyIngest(request,env);
    if(pathname==="/api/weather")return handleWeather(request,ctx,env);
    if(pathname==="/api/admin/push-now")return adminPushNow(request,env,ctx);
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html'))return response;
    const html=await response.text();
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store');
    if(bakeFallback)headers.set('x-alyzia-bake-fallback',bakeFallback);
    return new Response(patch(html),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(!liveApisEnabled(env))return;
    if(typeof providerPolicyScheduler.scheduled==='function')return providerPolicyScheduler.scheduled(controller,env,ctx);
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
