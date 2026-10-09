// Toutes les lectures de pages FlightStats passent par le même disjoncteur que la lecture principale : pause commune après des refus, une requête à la fois (espacées de 1,5 s), et un refus alimente la pause. Avant, les lectures d'ETD / de STA / de porte appelaient FlightStats sans disjoncteur : rafales de 403 qui mettaient FlightStats en pause pour tout le monde.
import {flightStatsPaused,flightStatsNoteResult,flightStatsSlot} from "./ops-public-live-flow-optimized.js";
export const isFlightStatsUrl=u=>/^https?:\/\/(?:www\.)?flightstats\.com\//i.test(String(u||""));
// fetch qui respecte le disjoncteur FlightStats. En pause : réponse 429 synthétique (aucune requête envoyée) que les lecteurs traitent comme un refus, donc sans essayer d'autres écritures du numéro.
export async function guardedFetch(url,init,fetchImpl=(...a)=>globalThis.fetch(...a)){
  if(!isFlightStatsUrl(url))return fetchImpl(url,init);
  if(flightStatsPaused())return new Response("",{status:429,headers:{"x-alyzia-flightstats-paused":"1"}});
  const r=await flightStatsSlot("FLIGHTSTATS",()=>fetchImpl(url,init));
  flightStatsNoteResult(r.status);
  return r;
}
