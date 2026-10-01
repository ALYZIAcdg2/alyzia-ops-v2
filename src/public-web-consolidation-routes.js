import {consolidateRunV2,previewRunV2,applyRunV2} from "./public-web-consolidation-v2.js";

const clean=v=>String(v??"").trim();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

async function latestDoneRun(env,date){
  const row=await env.OPS_DB.prepare(`SELECT run_id FROM public_web_test_runs WHERE flight_date=? AND status='DONE' ORDER BY updated_at DESC LIMIT 1`).bind(date).first();
  return clean(row?.run_id);
}
async function resolveRunId(env,url){
  const direct=clean(url.searchParams.get("runId"));if(direct)return direct;
  const date=clean(url.searchParams.get("date"));if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return "";
  return latestDoneRun(env,date);
}
function page(date,runId){
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consolidation stricte ${esc(date)}</title><style>body{font-family:system-ui;background:#101317;color:#f5f7fa;margin:0;padding:20px}.card{background:#1c222a;border-radius:16px;padding:16px;margin:12px 0}button{font:inherit;padding:12px 16px;border:0;border-radius:12px;margin-right:8px}.danger{background:#e75b5b;color:white}.ok{background:#7dd3a6}.muted{color:#a9b2bd}.warn{color:#ffd58a}pre{white-space:pre-wrap;word-break:break-word;max-height:65vh;overflow:auto}</style><h1>Consolidation STRICT V2</h1><div class="card"><b>Date :</b> ${esc(date)}<br><b>Run :</b> ${esc(runId||"introuvable")}<div class="warn">L'ancien moteur est désactivé. Une heure n'est plus CONFIRMED sur une seule source. Les 14 sources doivent avoir été traitées.</div><div class="muted">ATD ≠ TAKEOFF · LANDING ≠ ATA. Le statut est dérivé en priorité des événements réels.</div></div><div class="card"><button class="ok" id="preview">Recalculer + prévisualiser V2</button><button class="danger" id="apply">Appliquer STRICT V2</button><pre id="out">Prêt.</pre></div><script>const RUN=${JSON.stringify(runId)};const out=document.getElementById('out');async function j(url,opt){const r=await fetch(url,opt);const t=await r.text();try{return JSON.parse(t)}catch{return {ok:false,error:t,status:r.status}}}document.getElementById('preview').onclick=async()=>{if(!RUN)return;out.textContent='Consolidation stricte…';const c=await j('/api/v2/public-day-results/consolidate-v2?runId='+encodeURIComponent(RUN),{method:'POST'});if(!c.ok){out.textContent=JSON.stringify(c,null,2);return}const p=await j('/api/v2/public-day-results/preview-v2?runId='+encodeURIComponent(RUN));out.textContent=JSON.stringify({summary:c,preview:p},null,2)};document.getElementById('apply').onclick=async()=>{if(!RUN)return;if(!confirm('Appliquer UNIQUEMENT les valeurs strictement confirmées et annuler les anciennes valeurs PUBLIC_WEB non reconfirmées ?'))return;out.textContent='Application STRICT V2…';const a=await j('/api/v2/public-day-results/apply-v2?runId='+encodeURIComponent(RUN),{method:'POST'});out.textContent=JSON.stringify(a,null,2)};</script></html>`;
}

export async function handlePublicWebConsolidation(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==="/v2/public-day-results"){
    const date=clean(url.searchParams.get("date"))||"2026-10-01";const runId=await resolveRunId(env,url);
    return new Response(page(date,runId),{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store"}});
  }
  if(!p.startsWith("/api/v2/public-day-results/"))return null;
  const runId=await resolveRunId(env,url);if(!runId)return json({ok:false,error:"RUN_ID_REQUIRED_OR_NO_DONE_RUN"},400);
  if(p.endsWith("/apply"))return json({ok:false,error:"LEGACY_APPLY_DISABLED",message:"Utiliser apply-v2 après preview-v2"},423);
  if(p.endsWith("/consolidate-v2")){if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);return json(await consolidateRunV2(env,runId))}
  if(p.endsWith("/preview-v2"))return json(await previewRunV2(env,runId));
  if(p.endsWith("/apply-v2")){if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);return json(await applyRunV2(env,runId))}
  if(p.endsWith("/consolidate")||p.endsWith("/preview"))return json({ok:false,error:"LEGACY_CONSOLIDATION_DISABLED",message:"Utiliser consolidate-v2 / preview-v2"},423);
  return json({ok:false,error:"NOT_FOUND"},404);
}
