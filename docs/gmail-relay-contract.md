# Contrat du relais Gmail — Lot 6

ALYZIA OPS ne se connecte pas directement à une boîte Gmail. Un relais externe
authentifié lit les messages autorisés et appelle le Worker. Aucun jeton OAuth
Gmail, mot de passe ou identifiant de service ne doit être placé dans ce dépôt.

## Endpoint

```http
POST /api/ingestions/gmail
Content-Type: application/json
Authorization: Bearer <API_WRITE_TOKEN>
```

Le secret est configuré dans Cloudflare et dans le relais. Il n'est ni transmis
dans l'URL, ni journalisé, ni stocké dans D1 ou R2.

## Corps minimal

```json
{
  "provider_message_id": "identifiant-stable-du-message",
  "created_by": "identifiant-du-relais",
  "received_at": "2026-08-21T10:00:00.000Z",
  "text_content": "contenu source exact"
}
```

Champs optionnels :

- `provider_thread_id` pour l'idempotence et le diagnostic interne ;
- `raw_message_base64` pour archiver le message RFC 822 complet ;
- `attachments`, tableau de `{ filename, media_type, content_base64 }` ;
- `sq_import`, uniquement lorsqu'une analyse ou une exécution SQ est demandée
  explicitement.

Au moins une source de contenu est obligatoire. Les pièces sont limitées à
20 éléments, 10 Mo par objet et 25 Mo au total après décodage. Un ZIP est
archivé comme source mais n'est pas extrait dans ce lot.

## Idempotence et confidentialité

`provider_message_id` est unique dans D1. Un second envoi retourne
`GMAIL_MESSAGE_ALREADY_INGESTED` sans réécrire R2. Les clés R2 utilisent des
empreintes SHA-256 et ne contiennent ni identifiant Gmail ni nom de fichier.
Les listes API n'exposent pas les identifiants techniques du fournisseur.

Les objets R2 sont rattachés à l'ingestion dans D1 avec leur rôle, type MIME,
taille et empreinte. Les sources techniques restent dans le centre d'ingestion
et ne sont jamais affichées dans la fiche passager.

## Import SQ explicite

Sans `sq_import`, le message est seulement archivé avec le statut `STORED`.

Une prévisualisation sans écriture utilise :

```json
{
  "sq_import": {
    "execute": false,
    "options": { "service_year": 2026 }
  }
}
```

Une exécution demande `execute: true` et un contexte complet :

```json
{
  "sq_import": {
    "execute": true,
    "options": { "service_year": 2026 },
    "context": {
      "import_id": "identifiant-unique",
      "import_mode": "AUTOMATIC",
      "data_scope": "PARTIAL",
      "user_id": "identifiant-du-relais"
    }
  }
}
```

Les mêmes protections que l'import interactif s'appliquent : année fiable,
ambiguïtés bloquantes, overrides et règles FULL/PARTIAL. Le relais ne doit pas
inventer les options manquantes.

## Consultation protégée

```http
GET /api/ingestions?limit=25&offset=0
GET /api/ingestions/:ingestion_id
Authorization: Bearer <API_WRITE_TOKEN>
```

Ces routes sont protégées car elles exposent des métadonnées d'exploitation et
les références techniques R2. Elles ne permettent pas de télécharger les
objets archivés.
