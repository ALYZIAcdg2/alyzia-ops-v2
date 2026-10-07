// Les API payantes sont écartées : leur nom ne doit plus apparaître dans l'interface (journaux anciens compris).
export const PAID_NAME_RE=/\b(?:OAG(?:_SCHEDULE|_STATUS)?|AIRLABS(?:\s+ROUTES)?|SKYLINK|AERODATABOX(?:_REG)?|ADB|AVIATIONDATA|QUARK|SERPAPI|KAYAK|FLIGHTERA|FR24API|FR24DEP|CDGBOARD|FLIGHTRADAR1|FLIGHTRADAR8|OPENSKY)\b/gi;
export const ARCHIVED_LABEL="SOURCE ARCHIVÉE";
export const scrubPaidNames=v=>String(v??"").replace(PAID_NAME_RE,ARCHIVED_LABEL);
