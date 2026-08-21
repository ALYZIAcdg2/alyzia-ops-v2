# ALYZIA OPS V2 — Lots 1 à 3

ALYZIA OPS V2 est une application Cloudflare Workers + D1 destinée à stocker
et consulter une représentation structurée des vols. Le Lot 1 fournit le socle
de données commun. Le Lot 2 ajoute une API de consultation/création, la
recherche et une fiche vol opérationnelle sans framework frontend lourd. Le
Lot 3 livre le moteur prudent d’import de modèles déjà structurés.

Version applicative : `0.3.0`.

## Accès

- application : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev> ;
- santé : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev/api/health> ;
- dépôt : <https://github.com/ALYZIAcdg2/alyzia-ops-v2> ;
- branche de production : `main` ;
- binding D1 : `DB` vers `alyzia-ops-db`.

L’utilisateur final a uniquement besoin d’un navigateur. Node.js et Wrangler
sont des outils de développement et de déploiement, pas des prérequis du poste
opérationnel.

## Périmètre livré

### Lot 1 — fondation

- modèle `FlightImportModel` commun et indépendant d’une compagnie ;
- migration D1 initiale et 24 tables structurées ;
- modèles, repositories D1 et utilitaires ES Modules ;
- contrat initial de `importFlightData`, finalisé au Lot 3 ;
- historique et corrections manuelles préparés dans le schéma.

### Lot 2 — consultation et test

- `GET /api/flights` avec recherche et pagination ;
- `GET /api/flights/:id` avec agrégat complet ;
- `POST /api/flights` pour la création structurée protégée par secret ;
- liste des vols et fiche responsive ;
- affichage dynamique des cabines et des charges ;
- affichage des horaires, appareil, passagers, particularités, documents,
  connexions, groupes et commentaires de classe ;
- générateur manuel de fixture, toujours clairement marqué comme donnée de
  test et jamais exécuté automatiquement ;
- tests D1 en mémoire sur le schéma réel.

### Lot 3 — import structuré

- import manuel d’un `FlightImportModel` JSON déjà structuré ;
- validation du contrat et matching exact de l’identité canonique ;
- snapshot D1, comparaison stricte et plan d’exécution ;
- protection des overrides `TEMPORARY` et `LOCKED` ;
- suppressions conditionnées par la portée et la fiabilité du bloc ;
- exécution atomique des changements autorisés et `field_history` ;
- persistance des imports, sources et issues ;
- statuts `PROCESSED`, `NO_CHANGE`, `REVIEW_REQUIRED` et `ERROR` ;
- consultation des imports depuis l’API et l’interface.

Ne sont pas inclus : parser SQ complet, Gmail, IA, logique R2, logique Queues
ou upload de fichiers bruts/PDF. Aucun codeshare SQ V1 n’est ajouté.

## Architecture

```text
alyzia-ops-v2/
├── migrations/
│   └── 0001_initial_schema.sql
├── public/
│   ├── index.html
│   ├── styles.css
│   └── js/                  # interface navigateur ES Modules
├── src/
│   ├── database/            # requêtes D1, sans décision métier
│   ├── http/                # contrat HTTP et autorisation d’écriture
│   ├── import/              # comparaison, plan et moteur d’import structuré
│   ├── models/              # structures métier communes
│   ├── services/            # validation, création et agrégation
│   ├── utils/               # normalisation et comparaisons pures
│   └── worker.js            # routeur Cloudflare Worker
├── tests/
│   ├── fixtures/
│   ├── models/
│   ├── public/
│   ├── repositories/
│   ├── utils/
│   └── worker/
├── package.json
└── wrangler.jsonc
```

Les repositories préparent et exécutent les requêtes D1. La validation et
l’orchestration résident dans les services. L’interface utilise uniquement
HTML, CSS et JavaScript natifs.

## Prérequis de développement

- Node.js 22 ou supérieur ;
- npm ;
- un compte Cloudflare pour les opérations distantes.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Wrangler affiche l’URL locale dans le terminal. Les données D1 locales restent
dans `.wrangler/`, qui est ignoré par Git.

## Configuration D1

Le fichier `wrangler.jsonc` rattache le binding `DB` à `alyzia-ops-db`. Le
`database_id` versionné est un identifiant de ressource Cloudflare, pas un
secret.

Pour créer la base dans un autre compte :

```bash
npx wrangler d1 create alyzia-ops-db
```

Reporter l’identifiant retourné dans `wrangler.jsonc`, puis appliquer le schéma :

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply alyzia-ops-db --remote
```

La migration `0001_initial_schema.sql` est déjà appliquée à la base du projet.
Le Lot 2 ne requiert aucune nouvelle migration.

La base contenait auparavant 13 lignes d’un ancien schéma incompatible. Elles
ont été préservées sans transformation dans `legacy_flights_pre_v2`. Cette
archive n’est jamais lue par les repositories V2.

## Secret d’écriture

Les lectures sont publiques. Toute création exige le secret Worker
`API_WRITE_TOKEN`. Il ne doit jamais être ajouté à Git, à `wrangler.jsonc`, à
une fixture ou à une capture d’écran.

Configuration en ligne de commande :

```bash
npx wrangler secret put API_WRITE_TOKEN
```

Le même secret peut être ajouté dans le tableau Cloudflare sous le Worker
`alyzia-ops-v2`, section **Settings → Variables and secrets**. Choisir le type
**Secret**. Après configuration, le bouton **Créer une fixture** demande la
valeur uniquement pour la requête courante ; elle n’est stockée ni en local ni
en session par l’interface.

## API

Toutes les réponses API sont JSON, portent `Cache-Control: no-store` et ne
renvoient pas de source technique dans la fiche passager.

### Santé

```http
GET /api/health
```

```json
{
  "ok": true,
  "service": "ALYZIA OPS",
  "version": "0.3.0"
}
```

### Liste et recherche

```http
GET /api/flights?q=ZZ-TEST21-20991231-TST-LAB&limit=25&offset=0
```

- `q` recherche l’identité, compagnie + numéro, origine, destination et date ;
- `limit` vaut de 1 à 100 ;
- `offset` vaut de 0 à 100000 ;
- `pagination.has_more` indique si une page suivante existe.

Le tri est stable : date interne décroissante, puis compagnie et numéro.

### Fiche complète

```http
GET /api/flights/:flight_id
```

La réponse respecte la structure `FlightImportModel`. Les valeurs absentes,
`null` et `0` ne sont pas confondues par l’agrégateur ou l’interface.

### Création structurée

```http
POST /api/flights
Content-Type: application/json
Authorization: Bearer <API_WRITE_TOKEN>
```

Le corps suit `FlightImportModel`. La date interne ISO fiable est obligatoire
et l’identité canonique doit correspondre exactement. Le service valide puis
persiste les blocs structurés ; il ne calcule ni disponibilité, ni charge, ni
statut. En cas d’échec après la création du vol parent, un nettoyage en cascade
est tenté pour éviter un agrégat partiel.

Cette route directe ne crée pas d’import, d’issue ou d’extension compagnie.
Elle reste disponible pour les fixtures techniques du Lot 2.

### Imports structurés

```http
GET /api/imports?limit=25&offset=0
GET /api/imports/:import_id
POST /api/imports
Content-Type: application/json
Authorization: Bearer <API_WRITE_TOKEN>
```

Le corps du `POST` est de la forme :

```json
{
  "model": { "flight": {}, "timings": {} },
  "context": {
    "import_id": "IMPORT-IDENTIFIANT-UNIQUE",
    "import_mode": "MANUAL",
    "data_scope": "PARTIAL",
    "user_id": "identifiant-utilisateur"
  }
}
```

Pour autoriser une suppression, `data_scope: "FULL"` ne suffit pas. Le
contexte doit aussi déclarer le bloc concerné dans `block_scopes` comme complet,
fiable, présent, non ambigu et non protégé. Les changements structurels de
passagers, particularités, documents, connexions, groupes ou commentaires sont
comparés de façon stable mais placés en `REVIEW_REQUIRED` tant que leur matching
métier n’est pas finalisé.

## Tester la V2 dans le navigateur

1. Configurer `API_WRITE_TOKEN` dans Cloudflare.
2. Ouvrir l’application.
3. Cliquer sur **Créer une fixture**.
4. Choisir une date interne explicite, saisir le secret et confirmer que les
   données sont des données de test.
5. Vérifier la nouvelle fiche, la recherche par identité et les blocs détaillés.

Pour tester le Lot 3, cliquer sur **Import structuré**, fournir un
`FlightImportModel` JSON valide, une portée et un identifiant utilisateur. Le
secret n’est ni conservé dans `localStorage`, ni dans `sessionStorage`. Le
résultat peut être consulté dans la section **Imports structurés** avec ses
sources techniques, issues et entrées d’historique.

La fixture utilise une compagnie `ZZ`, des escales `TST`/`LAB`, des noms
`FIXTURE/...` et des classes `TEST_*`. Elle ne contient aucun faux passager
présenté comme réel. Chaque clic génère une identité unique. Rien n’est injecté
automatiquement au chargement de la page.

## Tests et validation

```bash
npm test
```

La suite couvre notamment :

- modèles et utilitaires du Lot 1 ;
- identité canonique et date fiable ;
- distinction absence / `undefined` / `null` / `0` ;
- SSR connus, special meal ouvert et SSR inconnu conservé ;
- schéma D1, clés étrangères, cascades et index partiels ;
- whitelists de colonnes repository ;
- création complète sur SQLite avec l’API D1 simulée ;
- sécurité du `POST`, doublon, recherche et fiche agrégée ;
- interface modulaire et fixture explicite ;
- pipeline Lot 3, absence/null/0, replay sans changement et historique ;
- protections FULL/PARTIAL, overrides et modifications structurelles ;
- routes de liste, création et détail des imports ;
- résolution de tous les imports ES Modules.

Pour tester aussi la migration locale et le bundle Worker :

```bash
npm run validate
```

## Déploiement Cloudflare

Contrôle du bundle puis déploiement manuel :

```bash
npm run check:worker
npx wrangler deploy
```

La configuration Cloudflare Builds recommandée est :

- **Build command** : vide ;
- **Deploy command** : `npx wrangler deploy` ;
- **Root directory** : `/`.

Une future migration D1 doit être ajoutée dans `migrations/`, testée localement,
fusionnée dans `main`, puis appliquée explicitement à distance. Ne pas laisser
une commande de migration distante active sur les previews. Les Preview URLs
sont désactivées dans `wrangler.jsonc` et `workers.dev` reste activé pour l’URL
opérationnelle actuelle.

Les emplacements des futurs bindings R2 et Queues restent documentés, sans
ressource, credential ou logique fictive.

## Principes critiques de données

1. **Absence ≠ 0.** Une propriété absente, `undefined`, `null` et `0` restent
   des états distincts dans les modèles et comparaisons.
2. **`service_date_raw` est conservé.** La valeur source n’est ni remplacée ni
   normalisée automatiquement.
3. **L’identité canonique utilise `service_date_internal`.** Elle combine
   compagnie, numéro, date interne fiable, origine et destination.
4. **Pas de codeshare SQ V1.** Le codeshare n’entre pas dans l’identité et aucun
   champ correspondant n’est ajouté.
5. **Repositories sans logique métier.** Ils ne classent, ne déduisent et ne
   recalculent aucune donnée.
6. **Sources techniques non affichées dans la fiche passager.** Elles restent
   rattachées au processus d’import.
7. **Pas d’écrasement automatique des corrections manuelles.** Le moteur
   protège les overrides `TEMPORARY` et `LOCKED` actifs.
8. **FULL/PARTIAL protège les suppressions.** `FULL` seul ne suffit jamais : le
   bloc doit aussi être fiable, complet, non ambigu et non protégé.

## Contrat `importFlightData`

```js
export async function importFlightData({ db, model, context })
```

Le contexte contient `import_id`, `import_mode`, `data_scope` et `user_id`, avec
`block_scopes` optionnel. Le pipeline réalise validation, matching exact,
snapshot, lecture des overrides, comparaison, plan, conflits, exécution et
historique. Il n’applique jamais partiellement un plan comportant un conflit :
l’import entier passe alors en `REVIEW_REQUIRED`.
