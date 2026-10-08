import test from "node:test";
import assert from "node:assert/strict";
import {lastEtdBeforeClear,planEtdRestore} from "./etd-restore.js";
// AT779 : STD 13:05 Paris, ETD 13:38 effacé à 13:31 Paris (11:31 UTC)
const log=[{at:"2026-10-08T11:31:35Z",source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from:"13:38",to:""},{at:"2026-10-08T11:21:19Z",source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from:"",to:"13:38"},{at:"2026-10-08T11:01:45Z",source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from:"13:27",to:""}];
test("ETD effacé après la STD par le tableau FR24 : dernière valeur restaurée", () => {
  assert.deepEqual(lastEtdBeforeClear({flightInfoLog:log},"13:05"),{etd:"13:38",clearedAt:"2026-10-08T11:31:35Z"});
});
test("pas de restauration : ETD présent, saisie manuelle, effacement avant la STD, autre source, dernière écriture non effacée", () => {
  assert.equal(lastEtdBeforeClear({etd:"13:40",flightInfoLog:log},"13:05"),null);
  assert.equal(lastEtdBeforeClear({etdSource:"MANUAL",flightInfoLog:log},"13:05"),null);
  assert.equal(lastEtdBeforeClear({flightInfoLog:log},"14:00"),null);                                   // effacé à 13:31, STD 14:00 : légitime
  assert.equal(lastEtdBeforeClear({flightInfoLog:[{...log[0],source:"PUBLIC_LIVE:FIDS"},...log.slice(1)]},"13:05"),null);
  assert.equal(lastEtdBeforeClear({flightInfoLog:log.slice(1)},"13:05"),null);
});
test("plan : seulement les vols CDG candidats", () => {
  const rows=[{flight_number:"AT779",std:"13:05",x:{origin:"CDG",flightInfoLog:log}},{flight_number:"XX1",std:"13:05",x:{origin:"LHR",flightInfoLog:log}},{flight_number:"XX2",std:"13:05",x:{origin:"CDG",etd:"13:40",flightInfoLog:log}}];
  assert.deepEqual(planEtdRestore(rows).map(c=>c.r.flight_number),["AT779"]);
});
