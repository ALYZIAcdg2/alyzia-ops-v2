import test from "node:test";
import assert from "node:assert/strict";
import {fetchFr24Public,fr24IdsFromHistory,fr24HistoryRow} from "./fr24-public-html.js";

const dep=Date.UTC(2026,9,4,3,0)/1000; // 05:00 Paris
const playback=(origin,destination,number)=>({result:{response:{data:{flight:{
  identification:{number:{default:number},callsign:"ENT777"},
  time:{scheduled:{departure:dep,arrival:dep+8700},estimated:{departure:dep+600,arrival:dep+9300},real:{departure:dep+840,arrival:null}},
  status:{generic:{status:{text:"Departed"}}},
  airport:{origin:{code:{iata:origin}},destination:{code:{iata:destination}}},
  aircraft:{model:{code:"B738"},registration:"SP-ENX"},track:[]
}}}}});

test("history ids are ranked by the flight date and destination written next to them",()=>{
  const pad=" x".repeat(250),html=`<tr>03 Oct 2026 CDG TIA #41f50001</tr>${pad}<tr>04 Oct 2026 CDG TIA #41f60002</tr>${pad}<tr>05 Oct 2026 CDG TIA #41f70003</tr>`;
  assert.equal(fr24IdsFromHistory(html,{date:"2026-10-04",destination:"TIA"})[0],"41f60002");
});

test("FR24 occurrence is discovered from the history page and confirmed by its playback",async()=>{
  const real=globalThis.fetch,calls=[];
  globalThis.fetch=async(url)=>{
    url=String(url);calls.push(url);
    if(url.includes("/data/flights/e4777"))return new Response(`<html>03 Oct 2026 CDG TIA #41f50001 04 Oct 2026 CDG TIA #41f60002</html>`,{headers:{"content-type":"text/html"}});
    if(url.includes("/data/flights/"))return new Response("<html></html>",{headers:{"content-type":"text/html"}});
    if(url.includes("flightId=41f50001"))return new Response(JSON.stringify(playback("CDG","TIA","E4777")).replace(String(dep),String(dep-86400)),{headers:{"content-type":"application/json"}});
    if(url.includes("flightId=41f60002"))return new Response(JSON.stringify(playback("CDG","TIA","E4777")),{headers:{"content-type":"application/json"}});
    return new Response("",{status:404});
  };
  try{
    const r=await fetchFr24Public({date:"2026-10-04",airline:"ENT",number:"777",designator:"ENT777",origin:"CDG",destination:"TIA",raw:{}});
    assert.equal(r.status,"OK");
    assert.equal(r.candidates.method,"PUBLIC_PLAYBACK_DISCOVERED");
    assert.equal(r.candidates.fr24OccurrenceId,"41f60002");
    assert.equal(r.candidates.semantic.reg,"SP-ENX");
    assert.ok(r.candidates.semantic.takeoff);
    assert.ok(calls.some(u=>u.includes("/data/flights/e4777")),"the IATA history page is read too");
  }finally{globalThis.fetch=real}
});

test("history row of the flight date gives registration, STD, ATD, STA and landing",()=>{
  const html=`<tr><td>SP-ESB</td><td>04 Oct 2026</td><td>2:08</td><td>Landed 07:45</td><td>STD 05:00</td><td>ATD 05:37</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr>
  <tr><td>SP-ENX</td><td>03 Oct 2026</td><td>2:05</td><td>Landed 07:30</td><td>STD 05:00</td><td>ATD 05:10</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr>`;
  // page already in local time (STD equals the planned STD)
  const row=fr24HistoryRow(html,{date:"2026-10-04",origin:"CDG",destination:"TIA",std:"05:00"});
  assert.deepEqual(row,{std:"05:00",atd:"05:37",sta:"07:25",landing:"07:45",reg:"SP-ESB",timezone:"LOCAL"});
  assert.equal(fr24HistoryRow(html,{date:"2026-10-04",origin:"CDG",destination:"IST",std:"05:00"}),null);
  // page as the Worker receives it: UTC (real E4777 reading 2026-10-04: STD 03:00 UTC = 05:00 Paris)
  const utc=`<tr><td>SP-ESB</td><td>04 Oct 2026</td><td>Landed 05:45</td><td>STD 03:00</td><td>ATD 03:37</td><td>STA 05:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr>`;
  assert.deepEqual(fr24HistoryRow(utc,{date:"2026-10-04",origin:"CDG",destination:"TIA",std:"05:00"}),{std:"05:00",atd:"05:37",sta:"07:25",landing:"07:45",reg:"SP-ESB",timezone:"UTC"});
  assert.equal(fr24HistoryRow(utc,{date:"2026-10-04",origin:"CDG",destination:"TIA"}).atd,"05:37");
});
