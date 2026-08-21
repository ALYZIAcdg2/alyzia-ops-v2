# Lot 5 — matrice de validation SQ335 / SQ337

Cette matrice distingue les tests automatisés reproductibles des validations
sur documents opérationnels réels.

## Tests automatisés livrés

- identité canonique distincte pour SQ335 et SQ337 ;
- conservation exacte de `service_date_raw` ;
- année interne uniquement fournie explicitement ;
- SSR PRM doubles et triples conservés par code ;
- `pax_count` calculé sur les passagers uniques référencés par la source ;
- special meals ouverts lorsqu’ils sont explicitement identifiés ;
- SSR inconnu conservé sous `OTHER` ;
- ETKT explicite et document ambigu non classé ;
- aucune fusion de vol ou de passager entre les deux cas.

Les données de ces tests sont exclusivement des fixtures techniques portant des
noms `FIXTURE/...`, des classes `TEST_*` et des documents `FIXTURE-*`.

## Validation opérationnelle encore requise

Les pièces jointes du chat partagé ne sont pas exposées au téléchargement dans
la copie publique. Les tests automatisés ne prétendent donc pas valider la mise
en page ou la grammaire exacte des fichiers opérationnels SQ335/SQ337.

Lorsque les deux fichiers de référence seront attachés au dépôt ou à la
conversation de travail, ils devront être testés sans être commités s’ils
contiennent des données personnelles. Le résultat attendu est un rapport de
diagnostic anonymisé, puis des fixtures minimales nettoyées si une nouvelle
grammaire doit être couverte.
