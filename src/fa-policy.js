// FlightAware ne traite que les vols des compagnies listées ici (trop de refus quand il lisait tous les vols). Module sans dépendance, partagé par toutes les lectures.
export const FA_ONLY_AIRLINES=["JU"];
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
// Compagnie autorisée (indicatif IATA = 2 premiers caractères du numéro de vol).
export function flightAwareAirlineAllowed(flight){const code=upper(flight).replace(/\s+/g,"").slice(0,2);return FA_ONLY_AIRLINES.includes(code)}
// Vol à lire pour son ATD : compagnie autorisée ET pas encore d'ATD.
export function flightAwareAllowed(flight,x){return flightAwareAirlineAllowed(flight||x?.flight)&&!clean(x?.atd)}
