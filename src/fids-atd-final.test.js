import test from "node:test";
import assert from "node:assert/strict";
import {needsLiveRead,priority} from "./ops-public-live-flow-optimized.js";
test("ATD lu dans le FIDS : définitif, plus relu ; ATD « parti à l'heure » (FIDS_ONTIME) : toujours remplaçable", () => {
  const base={ata:"13:00",reg:"F-HABC",aircraft:"320",atd:"10:30"};
  // vol de la veille arrivé : plus relu, ni quand l'ATD vient du flux ni quand il est déduit (« parti à l'heure ») : FlightStats saturait et se mettait en pause
  assert.equal(needsLiveRead("2026-10-07","2026-10-08",{...base,atdSource:"PUBLIC_LIVE:FIDS"}),false);
  assert.equal(needsLiveRead("2026-10-07","2026-10-08",{...base,atdSource:"PUBLIC_LIVE:FIDS_ONTIME"}),false);
  // vol du jour complet : jamais relu à cause d'un ATD FIDS
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{...base,atdSource:"PUBLIC_LIVE:FIDS"}),false);
  // en vol, ATD du flux : plus de priorité « ATD à confirmer » (0,3 / 0,4)
  const now=Date.parse("2026-10-08T12:00:00Z"),fly={std:"13:00",takeoff:"13:20",atd:"13:05",atdSource:"PUBLIC_LIVE:FIDS"};
  assert.ok(priority({std:"13:00",flight_date:"2026-10-08"},fly,840,now)[0]>=1);
  assert.ok(priority({std:"13:00",flight_date:"2026-10-08"},{...fly,atdSource:"PUBLIC_LIVE:FIDS_ONTIME"},840,now)[0]>=0.5);
});
