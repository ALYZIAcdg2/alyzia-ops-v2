// Words of web pages that look like a registration (letters, hyphen, letters): "E-MAIL" was stored as the registration of ENT777.
export const WEB_WORD_REGISTRATION=/^(?:E-?MAILS?|E-?TICKETS?|E-?BOOKS?|E-?SHOP|E-?STORE|E-?SERVICES?|E-?GATE|WI-?FI|CO-?PILOT|NO-?SHOW|NON-?STOP|PRE-?BOOK|ON-?LINE|CHECK-?IN|LOG-?IN|SIGN-?IN|SIGN-?UP|T-?SHIRT|X-?RAY|ON-?TIME|IN-?FLIGHT|IN-?AIR|EN-?ROUTE|EN-?VOL|NO-?DATA|NON-?STOP|ALL-?DAY|TAKE-?OFF|LIFT-?OFF|TOUCH-?DOWN)$/i;
export const isWebWordRegistration=v=>WEB_WORD_REGISTRATION.test(String(v??"").trim());
// Immatriculation américaine trop courte pour être vraie (« N2U » lu dans le texte d'une page pour OZ502) : un avion de ligne a au moins 5 caractères (N781AN).
export const isJunkRegistration=v=>{const t=String(v??"").trim().toUpperCase();return WEB_WORD_REGISTRATION.test(t)||/^N[0-9A-Z]{1,3}$/.test(t)};
