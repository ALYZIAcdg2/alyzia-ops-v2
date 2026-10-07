// API payantes écartées : leur nom ne doit plus apparaître dans l'interface (fiche, ADMIN, journaux, modals), y compris dans les anciennes données.
// 1. Les panneaux « fournisseurs » (observabilité, bandeau AeroDataBox) sont masqués ; 2. tout texte restant est remplacé par « SOURCE ARCHIVÉE ».
export const API_NAMES_SCRUB_UI=String.raw`<style id="alyzia-api-names-css">
#providerObservability,.provider-observability,.live-strip{display:none!important}
</style><script id="alyzia-api-names-js">(()=>{'use strict';
if(window.__alyziaApiNames)return;window.__alyziaApiNames=true;
const SRC='\\b(?:OAG(?:_SCHEDULE|_STATUS)?|AIRLABS(?:\\s+ROUTES)?|SKYLINK|AERODATABOX(?:_REG)?|ADB|AVIATIONDATA|QUARK|SERPAPI|KAYAK|FLIGHTERA|FR24API|FR24DEP|CDGBOARD|FLIGHTRADAR1|FLIGHTRADAR8|OPENSKY)\\b',LABEL='SOURCE ARCHIVÉE',ATTRS=['title','aria-label','placeholder'];
const clean=s=>s.replace(new RegExp(SRC,'gi'),LABEL),has=s=>new RegExp(SRC,'i').test(s);
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','NOSCRIPT']);
function scrub(root){
 if(!root)return;
 if(root.nodeType===3){const p=root.parentNode;if(p&&!SKIP.has(p.nodeName)&&has(root.nodeValue))root.nodeValue=clean(root.nodeValue);return}
 if(root.nodeType!==1||SKIP.has(root.nodeName))return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>SKIP.has(n.parentNode?.nodeName)?NodeFilter.FILTER_REJECT:(has(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP)});
 const todo=[];while(w.nextNode())todo.push(w.currentNode);for(const n of todo)n.nodeValue=clean(n.nodeValue);
 for(const el of [root,...root.querySelectorAll('[title],[aria-label],[placeholder]')])for(const a of ATTRS){const v=el.getAttribute&&el.getAttribute(a);if(v&&has(v))el.setAttribute(a,clean(v))}
}
let pending=new Set(),timer=0;
function flush(){timer=0;const list=[...pending];pending=new Set();for(const n of list)if(n.isConnected!==false)scrub(n)}
function queue(n){pending.add(n);if(!timer)timer=setTimeout(flush,120)}
new MutationObserver(recs=>{for(const r of recs){if(r.type==='characterData')queue(r.target);else for(const n of r.addedNodes)queue(n)}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
queue(document.body||document.documentElement);
})();</script>`;
