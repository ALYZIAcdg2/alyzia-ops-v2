import test from "node:test";
import assert from "node:assert/strict";
import {runCoreSourceDiagnosticTest} from "./core-source-diagnostic-test.js";

test("the diagnostic accepts a 3-letter airline designator (ENT777) and reports the FR24 history row",async()=>{
  const real=globalThis.fetch;
  const row=`<tr><td>SP-ESB</td><td>04 Oct 2026</td><td>Landed 07:45</td><td>STD 05:00</td><td>ATD 05:37</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr>`;
  globalThis.fetch=async(url)=>String(url).includes("/data/flights/e4777")?new Response(row,{headers:{"content-type":"text/html"}}):new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}});
  try{
    const r=await runCoreSourceDiagnosticTest({date:"2026-10-04",flight:"ENT777",origin:"CDG",destination:"TIA"});
    assert.equal(r.ok,true);
    const fr24=r.results.find(x=>x.source==="FR24");
    assert.equal(fr24.status,"HISTORY_ROW");
    assert.equal(fr24.historyRow.atd,"07:37"); // the diagnostic has no planned STD: the page is read as UTC
    assert.equal(fr24.fields.atd,"07:37");
  }finally{globalThis.fetch=real}
});
test("2-letter airline designators still work",async()=>{
  const real=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}});
  try{const r=await runCoreSourceDiagnosticTest({date:"2026-10-04",flight:"TK1822",origin:"CDG",destination:"IST"});assert.equal(r.ok,true)}finally{globalThis.fetch=real}
});
