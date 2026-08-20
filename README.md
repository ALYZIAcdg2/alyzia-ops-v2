# ALYZIA OPS V2 — Lot 1

Fondation technique d’ALYZIA OPS sur Cloudflare Workers et Cloudflare D1.
Ce lot fournit le schéma structuré, les modèles communs, les repositories D1,
les utilitaires de normalisation/comparaison, le contrat du futur moteur
d’import et un Worker HTTP minimal.

Version du socle : `0.1.0`.

## État de production

Le socle est déployé sur Cloudflare Workers :

- URL publique : <https://alyzia-ops-v2.alyzia-cdg2.workers.dev> ;
- contrôle de santé :
  <https://alyzia-ops-v2.alyzia-cdg2.workers.dev/api/health> ;
- branche de production : `main` ;
- commande de déploiement Cloudflare Builds : `npx wrangler deploy` ;
- binding D1 : `DB` vers `alyzia-ops-db` ;
- migration appliquée : `0001_initial_schema.sql`.

Le déploiement initial a été vérifié le 21 août 2026 : la page d’accueil et
la route de santé répondent en HTTP 200, tandis qu’un vol ou un import absent
renvoie correctement HTTP 404.

La base contenait auparavant 13 lignes issues d’un ancien schéma incompatible
(`flight_identity`, `flight_date`, `data_json`). Elles ont été conservées sans
transformation dans la table technique `legacy_flights_pre_v2`. Cette archive
n’est pas lue par les repositories V2 et ne doit pas être assimilée aux vols du
nouveau modèle.

## Périmètre

Ce dépôt contient uniquement le Lot 1 :

- modèle de vol commun et indépendant d’une compagnie ;
- migration D1 initiale ;
- repositories sans décision métier ;
- utilitaires validés pour identité, dates, horaires, SSR, documents, scopes et
  overrides ;
- squelette sécurisé de `importFlightData` ;
- routes de lecture minimales ;
- page d’accueil statique ;
- tests unitaires, de contrat repository, SQL et Worker.

Ne sont volontairement pas implémentés dans ce lot : parser SQ complet, upload,
Gmail, IA, logique R2 et consommateurs/producteurs Queues.

## Architecture

```text
alyzia-ops/
├── migrations/
│   └── 0001_initial_schema.sql
├── public/
│   └── index.html
├── src/
│   ├── database/       # accès D1 uniquement
│   ├── import/         # contrat du futur moteur d’import
│   ├── models/         # structures métier communes
│   ├── utils/          # fonctions pures et règles techniques validées
│   └── worker.js       # routeur Worker natif
├── tests/
│   ├── models/
│   ├── repositories/
│   ├── utils/
│   └── worker/
├── package.json
└── wrangler.jsonc
```

Le Worker utilise directement les bindings Cloudflare. Aucun framework
frontend ou serveur lourd n’est ajouté.

## Prérequis de développement

- Node.js 20 ou supérieur ;
- npm ;
- un compte Cloudflare uniquement pour créer/appliquer la base distante et
  déployer.

Ces prérequis concernent le développement ou la CI. L’utilisateur final n’a
besoin ni de Node.js ni d’un logiciel local : il accède au Worker depuis son
navigateur.

## Installation locale

```bash
npm install
npm run db:migrate:local
npm run dev
```

Wrangler ouvre par défaut le service local sur l’adresse indiquée dans son
terminal. Les données D1 locales restent dans le dossier technique `.wrangler/`,
ignoré par Git.

## Configuration D1

Le binding applicatif est `DB` et le nom logique est `alyzia-ops-db`. Le
`database_id` versionné rattache le Worker à la base D1 créée dans le compte
Cloudflare du projet. Cet identifiant de ressource n’est pas un secret.

En développement local, Wrangler utilise par défaut son stockage local dans
`.wrangler/` ; aucun `preview_database_id` fictif n’est nécessaire. Pour créer
une base équivalente dans un autre compte Cloudflare :

```bash
npx wrangler d1 create alyzia-ops-db
```

Reporter ensuite le `database_id` retourné dans l’entrée `d1_databases` de
`wrangler.jsonc`, puis appliquer les migrations :

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply alyzia-ops-db --remote
```

Les futurs secrets devront être ajoutés avec `wrangler secret put`, jamais dans
le code ou la configuration versionnée.

## Schéma initial

La migration crée 24 tables :

- vol, timings, appareil, configuration cabine et charge ;
- passagers, particularités, ETKT, EMD et documents non classés ;
- inbound, outbound, charges outbound et liens passagers ;
- groupes et commentaires de classe ;
- imports, sources, issues, historique et corrections manuelles.

Les clés étrangères, suppressions en cascade, contraintes d’énumération et
index de recherche sont définis dans la migration. Les connexions passager
utilisent des index uniques partiels compatibles SQLite/D1. La clé logique
inbound reste un index non unique afin de ne pas bloquer deux informations
sources distinctes.

## Tests et validation

Exécuter les tests :

```bash
npm test
```

Valider en une commande les tests, la migration D1 locale et le bundle Worker :

```bash
npm run validate
```

La suite vérifie notamment :

- identité canonique et date interne ;
- conservation des accents, espaces et zéros initiaux ;
- ambiguïté de `19AUG` sans année explicite ;
- horaires et durées séparés ;
- SSR connu, meal ouvert et SSR inconnu conservé ;
- ETKT/EMD uniquement avec contexte explicite ;
- distinction `absent` / `undefined` / `null` / `0` ;
- protections FULL/PARTIAL et overrides ;
- création du `FlightImportModel` ;
- listes blanches des repositories ;
- exécution SQL, clés étrangères et index partiels ;
- imports ES Modules et routes Worker.

Toutes les données présentes dans les tests sont explicitement des fixtures et
ne sont jamais insérées dans une base de production.

## Routes Worker

### Santé

```http
GET /api/health
```

```json
{
  "ok": true,
  "service": "ALYZIA OPS",
  "version": "0.1.0"
}
```

### Vol

```http
GET /api/flights/:id
```

La route lit le vol par son identifiant canonique avec `flightRepository`.

### Import

```http
GET /api/imports/:id
```

La route renvoie l’import, ses sources et ses issues avec `importRepository`.

La racine sert `public/index.html` via le binding Cloudflare Static Assets.

## Déploiement Cloudflare

Après création/rattachement de D1 et application de la migration distante :

```bash
npm run check:worker
npx wrangler deploy
```

Un déploiement GitHub peut exécuter les mêmes commandes dans l’environnement de
build Cloudflare. Aucun Node.js n’est alors requis sur le poste opérationnel.

La configuration de production utilise normalement un champ **Build command**
vide et la commande **Deploy command** suivante :

```text
npx wrangler deploy
```

Cette séparation empêche une branche de prévisualisation d’appliquer une
migration à la base de production avant sa fusion.

### Procédure pour une future migration D1

1. Ajouter une migration SQL versionnée dans `migrations/` et la valider
   localement avec `npm run validate`.
2. Fusionner la modification validée dans `main`.
3. Vérifier que le jeton Cloudflare Builds du projet possède la permission
   `D1 Edit`.
4. Renseigner temporairement cette commande dans **Settings → Build → Build
   command** :

   ```text
   npx wrangler d1 migrations apply alyzia-ops-db --remote
   ```

5. Relancer un build de `main`, contrôler le journal de migration puis vérifier
   `/api/health` et les routes D1 concernées.
6. Vider de nouveau **Build command** après succès. Ne pas laisser cette
   commande active pour les builds de branches de prévisualisation.

Wrangler enregistre chaque migration appliquée dans `d1_migrations`. Il ne faut
ni modifier cette table manuellement ni rejouer directement le contenu SQL dans
la console D1.

Les emplacements des futurs bindings R2 et Queues sont documentés dans
`wrangler.jsonc`, sans ressource, credential ou logique fictive.

## Principes critiques de données

1. **Absence ≠ 0.** Une propriété absente, `undefined`, `null` et `0` restent
   quatre états distincts pendant la comparaison.
2. **`service_date_raw` est conservé.** La valeur source n’est ni remplacée ni
   normalisée automatiquement.
3. **L’identité canonique utilise `service_date_internal`.** Elle combine
   compagnie, numéro de vol, date interne fiable, origine et destination. Un
   import dont l’année reste ambiguë demeure en revue et ne crée pas de ligne
   canonique dans `flights` tant que cette date n’est pas résolue.
4. **Pas de codeshare SQ V1.** Le codeshare n’entre jamais dans l’identité et
   aucun champ codeshare n’est ajouté au modèle SQ V1.
5. **Repositories sans logique métier.** Ils préparent, lient et exécutent les
   requêtes D1 ; ils ne classent et ne recalculent aucune donnée.
6. **Sources techniques non affichées dans la fiche passager.** Elles restent
   des données d’import et ne deviennent pas des informations opérationnelles
   passager.
7. **Pas d’écrasement automatique des corrections manuelles.** Les overrides
   `TEMPORARY` et `LOCKED` sont préparés pour le futur moteur de conflit.
8. **FULL/PARTIAL protège les suppressions.** `FULL` seul ne suffit jamais : le
   bloc doit aussi être présent, fiable, complet, non ambigu et non protégé.

## Contrat `importFlightData`

```js
export async function importFlightData({ db, model, context })
```

Le contexte attendu contient `import_id`, `import_mode`, `data_scope` et
`user_id`. Dans ce Lot 1, la fonction valide le contrat puis s’arrête
explicitement avec `REVIEW_REQUIRED`. Les phases matching, snapshot, overrides,
comparaison, plan, conflits, exécution, historique et statut final restent
`PENDING`. Aucun changement D1 n’est exécuté par ce squelette.
