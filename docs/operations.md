# Supervision et extensions — Lot 8

## Synthèse protégée

```http
GET /api/ops/summary
Authorization: Bearer <API_WRITE_TOKEN>
```

La réponse agrège des compteurs D1 fixes : vols, imports, imports en erreur ou
à réviser, issues ouvertes, overrides actifs, ingestions et objets archivés.
Elle indique aussi la présence des bindings D1, R2 et Queues.

`OPERATIONAL` signifie qu'aucun import ou ingestion n'est actuellement en
erreur. `ATTENTION_REQUIRED` signale au moins une erreur enregistrée. Ce statut
est un indicateur technique ; il ne prend aucune décision métier et ne modifie
aucune donnée.

## Corrélation des requêtes

Chaque réponse Worker contient `X-Request-Id`. Les erreurs JSON contiennent le
même identifiant dans `request_id`, et les erreurs inattendues sont journalisées
avec cet identifiant. Aucun corps source, token ou dossier passager n'est ajouté
aux logs.

## Registre d'extensions

Le registre déclare les adaptateurs disponibles sans les mélanger aux modèles
communs :

- `sq-editing` : parser actif ;
- `gmail-relay` : ingestion active ;
- `queue-ingestion` : point d'extension planifié, sans binding ni logique.

L'ajout futur d'une extension doit fournir un identifiant stable, un type, une
version et un statut. Une déclaration `PLANNED` n'active aucune fonctionnalité.
