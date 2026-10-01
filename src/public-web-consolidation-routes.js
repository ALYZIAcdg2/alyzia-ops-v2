import {consolidateRun,consolidationPreview,applyConsolidatedRun} from "./public-web-consolidation.js";

const clean=v=>String(v??"").trim();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

async function latestDoneRun(env,date){
  const row=await env.OPS_DB.prepare(`SELECT run_id FROM public_web_test_runs WHERE flight_date=? AND status='DONE' ORDER BY updated_at DESC LIMIT 1`).bind(date).first();
  return clean(row?.run_id);
}
async function resolveRunId(env,url){
  const direct=clean(url.searchParams.get("runId"));
  if(direct)return direct;
  const date=clean(url.searchParams.get("date"));
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return "";
  return latestDoneRun(env,date);
}
function page(date,runId){
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consolidation ${esc(date)}</title><style>body{font-family:system-ui;background:#101317;color:#f5f7fa;margin:0;padding:20px}.card{background:#1c222a;border-radius:16px;padding:16px;margin:12px 0}button{font:inherit;padding:12px 16px;border:0;border-radius:12px;margin-right:8px}.danger{background:#e75b5b;color:white}.ok{background:#7dd3a6}.muted{color:#a9b2bd}pre{white-space:pre-wrap;word-break:break-word;max-height:65vh;overflow:auto}</style><h1>Consolidation sources publiques</h1><div class="card"><b>Date :</b> ${esc(date)}<br><b>Run :</b> ${esc(runId||"introuvable")}<div class="muted">STD/STA restent le planning de référence. Les autres champs confirmés peuvent être appliqués aux fiches vols.</div></div><div class="card"><button class="ok" id="preview">Consolider + prévisualiser</button><button class="danger" id="apply">Appliquer aux fiches vols</button><pre id="out">Prêt.</pre></div><script>const RUN=${JSON.stringify(runId)};const out=document.getElementById('out');async function j(url,opt){const r=await fetch(url,opt);const t=await r.text();try{return JSON.parse(t)}catch{return {ok:false,error:t,status:r.status}}}document.getElementById('preview').onclick=async()=>{if(!RUN)return;out.textContent='Consolidation…';const c=await j('/api/v2/public-day-results/consolidate?runId='+encodeURIComponent(RUN),{method:'POST'});if(!c.ok){out.textContent=JSON.stringify(c,null,2);return}const p=await j('/api/v2/public-day-results/preview?runId='+encodeURIComponent(RUN));out.textContent=JSON.stringify(p,null,2)};document.getElementById('apply').onclick=async()=>{if(!RUN)return;if(!confirm('Appliquer les valeurs CONFIRMÉES aux fiches vols ?'))return;out.textContent='Application…';const a=await j('/api/v2/public-day-results/apply?runId='+encodeURIComponent(RUN),{method:'POST'});out.textContent=JSON.stringify(a,null,2)};</script></html>`;
}
export async function handlePublicWebConsolidation(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==="/v2/public-day-results"){
    const date=clean(url.searchParams.get("date"))||"2026-10-01";
    const runId=await resolveRunId(env,url);
    return new Response(page(date,runId),{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store"}});
  }
  if(!p.startsWith("/api/v2/public-day-results/"))return null;
  const runId=await resolveRunId(env,url);
  if(!runId)return json({ok:false,error:"RUN_ID_REQUIRED_OR_NO_DONE_RUN"},400);
  if(p.endsWith("/consolidate")){
    if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);
    return json(await consolidateRun(env,runId));
  }
  if(p.endsWith("/preview"))return json(await consolidationPreview(env,runId));
  if(p.endsWith("/apply")){
    if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);
    return json(await applyConsolidatedRun(env,runId));
  }
  return json({ok:false,error:"NOT_FOUND"},404);
}
