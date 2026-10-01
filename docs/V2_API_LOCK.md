# ALYZIA OPS V2 — verrou API

La V2 fonctionne actuellement sans enrichissement externe.

## Etat requis
- `ALYZIA_LIVE_APIS_ENABLED = "false"`
- aucun cron fournisseur V2
- aucun binding AeroDataBox dans V2
- `/api/admin/push-now` bloqué
- `/api/opensky/ingest` bloqué

La V2 continue à utiliser son propre stockage D1/R2 et son interface. Les enrichissements live restent assurés par la V1 tant que ce verrou n'est pas levé explicitement.
