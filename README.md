# ALYZIA OPS V2 — Lots 1 à 8

ALYZIA OPS V2 est une application Cloudflare Workers + D1 destinée à stocker
et consulter une représentation structurée des vols. Le Lot 1 fournit le socle
de données commun. Le Lot 2 ajoute les repositories D1 et le moteur prudent
d’import de modèles déjà structurés. Le Lot 3 ajoute le parser SQ textuel avec
prévisualisation obligatoire avant écriture. Le Lot 4 livre l’API de suivi et
un Import Center filtrable avec décisions humaines explicites sur les issues.
Le Lot 5 ajoute une matrice reproductible pour SQ335 et SQ337. Le Lot 6 ajoute
l'archivage R2 et un contrat d'ingestion Gmail sans OAuth embarqué. Le Lot 7
livre l'interface opérationnelle et le Lot 8 la supervision et le registre
d'extensions.

Version applicative : `0.9.0`.

## Accès

- application : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev> ;
- santé : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev/api/health> ;
- disponibilité : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev/api/readiness> ;
- dépôt : <https://github.com/ALYZIAcdg2/alyzia-ops-v2> ;
- branche de production : `main` ;
- binding D1 : `DB` vers `alyzia-ops-db` ;
- binding R2 : `SOURCE_ARCHIVE` vers `alyzia-ops-sources`.

L’utilisateur final a uniquement besoin d’un navigateur. Node.js et Wrangler
sont des outils de développement et de déploiement, pas des prérequis du poste
opérationnel.

## Périmètre livré

### Lot 1 — fondation

- modèle `FlightImportModel` commun et indépendant d’une compagnie ;
- migration D1 initiale et 24 tables structurées ;
- modèles, repositories D1 et utilitaires ES Modules ;
- contrat initial de `importFlightData`, finalisé au Lot 2 ;
- historique et corrections manuelles préparés dans le schéma.

### Lot 2 — repositories et moteur d’import

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
- import manuel d’un `FlightImportModel` JSON déjà structuré ;
- validation du contrat et matching exact de l’identité canonique ;
- snapshot D1, comparaison stricte et plan d’exécution ;
- protection des overrides `TEMPORARY` et `LOCKED` ;
- suppressions conditionnées par la portée et la fiabilité du bloc ;
- exécution atomique des changements autorisés et `field_history` ;
- persistance des imports, sources et issues ;
- statuts `PROCESSED`, `NO_CHANGE`, `REVIEW_REQUIRED` et `ERROR` ;
- consultation des imports depuis l’API et l’interface.

### Lot 3 — parser SQ prudent

- parser SQ séparé des composants communs et versionné `sq-editing@0.1.0` ;
- extraction des identités, horaires explicitement libellés, appareil, cabines,
  charges, passagers explicitement typés, SSR et documents ;
- conservation des SSR multiples d’une même catégorie avec le détail exact et
  le compte par code ;
- catégorie `OTHER` pour les SSR inconnus et catégorie `MEAL` seulement avec
  un contexte meal explicite ;
- ETKT et EMD classés uniquement lorsque leur type est explicite, sinon
  stockage non classé ;
- année et mouvement fournis explicitement, sans choix automatique de l’année
  courante ;
- prévisualisation sans écriture, diagnostic des lignes non mappées et blocage
  de l’import en cas d’issue `REVIEW` ou `BLOCKING` ;
- import D1 protégé par le même secret, avec métadonnées et issues du parser.

### Lot 4 — API et Import Center

- filtres d’import par statut, mode et recherche textuelle bornée ;
- pagination stable avec navigation précédente/suivante ;
- synthèse des imports et des issues ouvertes ;
- détail complet des sources, issues et changements d’historique ;
- résolution humaine explicite d’une issue en `RESOLVED` ou `IGNORED` ;
- protection de chaque décision par `API_WRITE_TOKEN` et identifiant opérateur ;
- aucune relance d’import ni modification automatique du statut après décision ;
- interface responsive sans framework frontend lourd.

### Lot 5 — tests SQ335 / SQ337

- cas automatisés distincts SQ335 et SQ337, uniquement avec données fixture ;
- validation de l’identité, de la date raw et du mouvement explicite ;
- doubles et triples SSR d’une même catégorie conservés par code ;
- contrôle des passagers uniques, meals ouverts, SSR inconnus et documents ;
- matrice de validation documentée dans `docs/lot5-validation.md` ;
- validation des fichiers opérationnels réels réservée à leur rattachement
  sécurisé, sans commit de données personnelles.

### Lot 6 — R2 et ingestion Gmail

- binding R2 `SOURCE_ARCHIVE` vers `alyzia-ops-sources` ;
- migration D1 séparée pour les messages et objets d'ingestion ;
- endpoint Gmail protégé, idempotent et indépendant du fournisseur OAuth ;
- archivage du corps exact, du message RFC 822 et des pièces jointes ;
- clés R2 hachées sans identifiant Gmail ni nom de fichier ;
- ZIP archivé sans extraction ou classification fictive ;
- import SQ désactivé par défaut et exécution uniquement sur demande explicite ;
- limites de taille et validation intégrale avant la première écriture D1.

### Lot 7 — interface opérationnelle

- tableau de vols, Import Center et centre d'ingestion réunis dans une interface
  responsive en HTML, CSS et JavaScript natifs ;
- archivage manuel d'une source autorisée pour tester R2 sans accès direct à
  Gmail ni import métier implicite ;
- consultation protégée et paginée des ingestions et objets R2 ;
- secrets conservés uniquement dans les champs de la page courante, jamais en
  stockage local ou de session ;
- états vides, erreurs explicites et échappement de toutes les valeurs externes.

### Lot 8 — supervision et extensions

- synthèse protégée des volumes D1, erreurs, issues et overrides actifs ;
- visibilité sur la disponibilité des bindings D1, R2 et Queues ;
- registre explicite des extensions actives ou planifiées ;
- identifiant `X-Request-Id` sur chaque réponse et corrélation des erreurs ;
- logs d'erreur structurés sans contenu source ou donnée passager.

Ne sont pas inclus dans les Lots 1 à 8 : extraction PDF/ZIP, connexion OAuth
directe à Gmail, IA ou logique Queues. Aucun codeshare SQ V1 n’est ajouté. Les formats
SQ335/SQ337 réels restent à valider dès que les fichiers opérationnels de
référence sont accessibles hors de la copie publique du chat partagé.

## Architecture

```text
alyzia-ops-v2/
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_ingestion_sources.sql
├── public/
│   ├── index.html
│   ├── styles.css
│   └── js/                  # interface navigateur ES Modules
├── src/
│   ├── database/            # requêtes D1, sans décision métier
│   ├── extensions/          # registre déclaratif des adaptateurs
│   ├── http/                # contrat HTTP et autorisation d’écriture
│   ├── import/              # comparaison, plan et moteur d’import structuré
│   ├── models/              # structures métier communes
│   ├── parsers/sq/          # parser SQ isolé et prudent
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

Les migrations `0001_initial_schema.sql` et `0002_ingestion_sources.sql` sont
appliquées dans l'ordre. La seconde ajoute uniquement les métadonnées
d'ingestion ; le contenu source est conservé dans R2.

## Configuration R2

Créer le bucket avant le premier déploiement de la version `0.9.0` :

```bash
npx wrangler r2 bucket create alyzia-ops-sources
```

Le binding `SOURCE_ARCHIVE` est déclaré dans `wrangler.jsonc`. Le nom du bucket
est un identifiant de ressource et non un secret. Aucun objet R2 n'est public et
aucune route de téléchargement n'est exposée.

La base contenait auparavant 13 lignes d’un ancien schéma incompatible. Elles
ont été préservées sans transformation dans `legacy_flights_pre_v2`. Cette
archive n’est jamais lue par les repositories V2.

## Secret d’écriture

Les lectures des vols et imports sont publiques. Les ingestions, la supervision
et toutes les écritures exigent le secret Worker `API_WRITE_TOKEN`. Il ne doit
jamais être ajouté à Git, à `wrangler.jsonc`, à une fixture ou à une capture
d’écran.

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
  "version": "0.9.0"
}
```

`GET /api/readiness` vérifie uniquement la présence de D1, du schéma
d'ingestion et du binding R2. Il ne retourne aucun compteur ni aucune donnée.

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
GET /api/imports/summary
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

La liste accepte les filtres optionnels `status`, `mode` et `q`. La recherche
porte uniquement sur l’identifiant d’import, le vol, le parser et l’opérateur.
La synthèse retourne des compteurs globaux et ne modifie aucune donnée.

Une décision humaine sur une issue utilise :

```http
PATCH /api/imports/:import_id/issues/:issue_id
Content-Type: application/json
Authorization: Bearer <API_WRITE_TOKEN>
```

```json
{
  "resolution_status": "RESOLVED",
  "resolved_by": "identifiant-operateur"
}
```

Les seules décisions acceptées sont `RESOLVED` et `IGNORED`. Cette route ne
relance pas le moteur et ne change pas le statut de l’import.

### Parser SQ

```http
POST /api/sq/parse
POST /api/sq/import
Content-Type: application/json
Authorization: Bearer <API_WRITE_TOKEN>
```

`/api/sq/parse` retourne une prévisualisation sans écrire dans D1. Le corps
contient `source_text` et des options explicites :

```json
{
  "source_text": "SQ335/19AUG CDGSIN\nMOVEMENT: DEPARTURE",
  "options": {
    "service_year": 2026,
    "movement_type": "DEPARTURE"
  }
}
```

`/api/sq/import` reprend ces champs et ajoute `source_name` et le `context`
d’import. Une source comportant une ambiguïté `REVIEW` ou `BLOCKING` est
refusée avec `SQ_REVIEW_REQUIRED` et ne crée aucun import. Le texte brut n’est
pas recopié dans les issues ni dans la fiche passager.

### Ingestion Gmail et R2

```http
POST /api/ingestions/gmail
GET /api/ingestions?limit=25&offset=0
GET /api/ingestions/:ingestion_id
Authorization: Bearer <API_WRITE_TOKEN>
```

Les trois routes sont protégées. Le `POST` archive les sources dans R2 et leurs
métadonnées dans D1. Par défaut, aucune écriture métier n'est déclenchée. Un
import SQ exige `sq_import.execute: true` et un contexte complet. Le contrat
du relais et les limites sont détaillés dans
`docs/gmail-relay-contract.md`.

### Supervision

```http
GET /api/ops/summary
Authorization: Bearer <API_WRITE_TOKEN>
```

La synthèse retourne des compteurs techniques D1, l'état des bindings et le
registre d'extensions. Elle ne modifie aucune donnée et n'interprète aucun
statut métier. Le contrat détaillé se trouve dans `docs/operations.md`.

## Tester la V2 dans le navigateur

1. Configurer `API_WRITE_TOKEN` dans Cloudflare.
2. Ouvrir l’application.
3. Cliquer sur **Créer une fixture**.
4. Choisir une date interne explicite, saisir le secret et confirmer que les
   données sont des données de test.
5. Vérifier la nouvelle fiche, la recherche par identité et les blocs détaillés.

Pour tester le moteur du Lot 2, cliquer sur **Import structuré**, fournir un
`FlightImportModel` JSON valide, une portée et un identifiant utilisateur. Le
secret n’est ni conservé dans `localStorage`, ni dans `sessionStorage`. Le
résultat peut être consulté dans la section **Imports structurés** avec ses
sources techniques, issues et entrées d’historique.

Pour tester le Lot 3, cliquer sur **Parser un editing**, coller le texte SQ,
saisir une année fiable et choisir explicitement `DEPARTURE` ou `ARRIVAL`.
Cliquer d’abord sur **Analyser sans écrire**. Le bouton d’import reste désactivé
tant que le parser signale une ambiguïté nécessitant une révision.

Pour tester les Lots 6 à 8, utiliser **Archiver une source** avec une source
explicitement autorisée, puis saisir le jeton dans le **Centre d'ingestion**.
La section **État opérationnel** charge les métriques D1/R2 et les extensions.
Le formulaire manuel archive seulement la source : il ne se connecte pas à
Gmail et ne déclenche aucun import SQ.

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
- pipeline Lot 2, absence/null/0, replay sans changement et historique ;
- protections FULL/PARTIAL, overrides et modifications structurelles ;
- routes de liste, création et détail des imports ;
- parser SQ, SSR multiples, documents explicites et blocage des ambiguïtés ;
- ingestion Gmail idempotente, validation base64 et conservation exacte ;
- références R2 sans identifiant fournisseur et import SQ explicitement activé ;
- interface d'ingestion responsive et secrets non persistés ;
- supervision protégée, registre d'extensions et corrélation des requêtes ;
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

Une migration D1 doit être ajoutée dans `migrations/`, testée localement,
fusionnée dans `main`, puis appliquée explicitement à distance. Ne pas laisser
une commande de migration distante active sur les previews. Les Preview URLs
sont désactivées dans `wrangler.jsonc` et `workers.dev` reste activé pour l’URL
opérationnelle actuelle.

Le bucket R2 `alyzia-ops-sources` est relié au binding `SOURCE_ARCHIVE`. Le
binding ne contient aucun credential. L'emplacement du futur binding Queues
reste commenté, sans ressource ou logique fictive.

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
