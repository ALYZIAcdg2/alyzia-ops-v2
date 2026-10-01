# ALYZIA OPS V2 — Enrichissement live des vols

## Principe

L'import Excel est une **source théorique**. Il sert à créer la liste des vols à surveiller et à fournir l'identité du vol (date, compagnie, numéro, origine, destination) ainsi qu'un horaire théorique de départ permettant de planifier le suivi.

Les informations opérationnelles ne doivent pas être déduites du fichier théorique. Elles sont enrichies et historisées séparément.

## Champs suivis

### Départ
- `std` — départ programmé confirmé par une source externe
- `etd` — départ estimé, rafraîchissable jusqu'au départ
- `atd` — départ réel, final

### Arrivée
- `sta` — arrivée programmée confirmée par une source externe
- `eta` — arrivée estimée, rafraîchissable jusqu'à l'arrivée
- `ata` — arrivée réelle, finale

### Autres champs
- `gate` — porte de départ, peut changer jusqu'à ATD
- `reg` — immatriculation, peut changer jusqu'à ATD en cas de changement appareil
- `aircraft` / `aircraftModel` — type appareil réel, peut changer jusqu'à ATD
- `status` / `providerStatusRaw` — statut fournisseur; le statut opérationnel ALYZIA reste normalisé séparément

## Règle d'affichage

Départ affiché : `ATD` si présent, sinon `ETD`, sinon `STD`.

Arrivée affichée : `ATA` si présent, sinon `ETA`, sinon `STA`.

Les champs restent séparés en stockage et dans l'historique.

## Import théorique

Un `STD` ou `STA` provenant de l'import n'est pas considéré comme confirmé. La politique continue à demander `std` / `sta` tant que leur source n'est pas une source opérationnelle reconnue.

Une source externe peut remplacer une valeur théorique importée. Une heure réelle `ATD` / `ATA` confirmée n'est jamais écrasée automatiquement.

## Cadence de suivi par vol

| Phase | Cadence cible |
|---|---:|
| Plus de 6 h avant STD | 60 min |
| H-6 à H-3 | 30 min |
| H-3 à H-1 | 15 min |
| H-1 jusqu'à ATD | 5 min |
| Après ATD jusqu'à ATA | 15 min |
| Après ATA | STOP |

Le cron Worker peut continuer à s'exécuter toutes les 5 minutes : `trackingCadenceMinutes()` décide si le vol est réellement dû pour un nouveau cycle d'enrichissement.

## Needs et STOP conditions

Les besoins sont indépendants : `std`, `sta`, `etd`, `eta`, `atd`, `ata`, `gate`, `reg`, `aircraft`, `status`.

Un fournisseur n'est placé dans la queue que s'il peut répondre à au moins un champ encore nécessaire.

Après `ATA` confirmé, le suivi live s'arrête. Les éventuels trous historiques (gate/immat/type) pourront être traités par un backfill distinct sans continuer à consommer les quotas live.

## Priorité / fallback

La politique existante reste multi-source et par champ. Elle privilégie les sources déjà configurées et utilise les fournisseurs plus coûteux seulement quand les sources prioritaires ont échoué ou quand le champ reste absent.

- `STD/STA` : source schedule prioritaire (notamment OAG schedule si disponible), puis autres sources compatibles.
- `ETD/ETA/ATD/ATA/GATE` : sources flight-status/live.
- `REG` : OpenSky/live providers puis API de fallback.
- `AIRCRAFT` : SkyLink/FR24 et fournisseurs exposant un type réel.
- AeroDataBox reste un fallback tardif pour les champs que son service interne expose déjà (`STD/STA/ETD/ETA/ATD/ATA/GATE/REG`).

## Phase de validation

La variable :

`ALYZIA_V2_TEST_CARRIERS = "TK"`

limite la première phase à Turkish Airlines. Tant qu'elle est définie, les autres compagnies ne sont pas ajoutées à la queue d'enrichissement V2.

Après validation TK, cette variable pourra être vidée ou élargie progressivement.

## Isolation Cloudflare V2

La V2 ne doit jamais utiliser les ressources de production V1.

Cibles prévues :
- Worker : `alyzia-ops-v2`
- D1 : `alyzia-ops-v2-db`
- R2 : `alyzia-ops-v2-files`

`wrangler.jsonc` contient volontairement un placeholder pour le `database_id` V2. Le déploiement doit rester bloqué tant que la nouvelle D1 n'a pas été créée et que son UUID réel n'a pas remplacé le placeholder.

Les secrets / clés fournisseurs devront ensuite être ajoutés au Worker V2 séparément. Aucun secret V1 ne doit être copié en clair dans GitHub.
