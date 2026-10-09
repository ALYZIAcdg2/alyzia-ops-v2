import test from "node:test";
import assert from "node:assert/strict";
import {arrivedStale,needsLiveRead} from "./ops-public-live-flow-optimized.js";
const NOW=Date.parse("2026-10-09T07:00:00Z");                      // 09:00 Paris le 09/10
test("vol arrivé depuis longtemps : plus relu par FlightStats",()=>{
  const dj={origin:"CDG",destination:"BEG",dest:"BEG",std:"10:00"};
  assert.equal(arrivedStale({...dj,ata:"12:30"},"2026-10-08",NOW),true);       // arrivé hier
  assert.equal(arrivedStale({...dj,landing:"12:20"},"2026-10-08",NOW),true);
  assert.equal(arrivedStale({...dj},"2026-10-08",NOW),false);                  // pas arrivé : lisible
  assert.equal(arrivedStale({...dj,ata:"08:15"},"2026-10-09",NOW),false);      // arrivé il y a < 90 min (08:15 Belgrade = 08:15 Paris)
  assert.equal(arrivedStale({...dj,ata:"06:00"},"2026-10-09",NOW),true);       // arrivé il y a 3 h
});
test("vol d'hier arrivé après minuit depuis moins de 90 min : reste lisible",()=>{
  const x={origin:"CDG",destination:"DJE",dest:"DJE",std:"19:45",ata:"07:50"};  // DJE UTC+1 : 07:50 local = 08:50 Paris
  assert.equal(arrivedStale(x,"2026-10-08",NOW),false);
  assert.equal(arrivedStale({...x,ata:"04:00"},"2026-10-08",NOW),true);
});
test("liste de lecture : un vol de la veille arrivé avec son ATD n'est plus candidat",()=>{
  const base={origin:"CDG",destination:"BEG",dest:"BEG",std:"10:00",atd:"10:05",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"};
  const real=Date.now;Date.now=()=>NOW;
  try{
    assert.equal(needsLiveRead("2026-10-08","2026-10-09",{...base,flight:"AH1003",ata:"12:30"}),false);
    assert.equal(needsLiveRead("2026-10-08","2026-10-09",{...base,flight:"AH1003",ata:undefined}),true);   // pas arrivé : toujours lisible
  }finally{Date.now=real}
});
