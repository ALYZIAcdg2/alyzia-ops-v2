# Règles verrouillées (statuts, horaires, lectures)

Ces règles ont été décidées avec l'exploitant. **Aucune nouvelle fonction ne doit les modifier sans changer explicitement `src/rules-lock.test.js`** : ce test casse si une règle change. Modifier une règle = modifier ce fichier ET ce test, dans la même PR, avec l'accord de l'exploitant.

## Horaires
1. STD et STA sont théoriques : aucune source ne les modifie. Une STA vide peut être renseignée une seule fois par FR24 ; une STA présente ou saisie à la main n'est jamais changée.
2. Aucun horaire calculé, sauf deux exceptions acceptées : ATD « parti à l'heure » du FIDS (`FIDS_ONTIME`) et ATD estimée du premier mouvement FR24 (`FR24MOVE`, seulement après le décollage). Toute vraie source les remplace.
3. ATA calculée = atterrissage + 10 min, seulement si l'atterrissage est connu et date de 15 min ou plus (ENT / E4 : tout de suite). Une vraie ATA la remplace.
4. Une saisie manuelle n'est jamais écrasée.
5. Source de l'ETD de CDG : le tableau FR24 « TABLEAU DE BORD CDG ». Il n'est pas écrasé par le FIDS.
6. Priorité de l'ATA : FIDS, puis FlightStats, puis FlightAware. FlightAware est coupé (réglage `fa-policy.js`).

## Statuts
7. ARRIVÉ = une ATA existe (réelle ou calculée). **Jamais** d'ARRIVÉ par « ETA dépassée ».
8. ATTERRI = atterrissage connu sans ATA. EN VOL = décollage connu. PARTI = ATD connue sans décollage.
9. RETARDÉ : vol non parti dont l'ETD dépasse la STD de plus de 15 min, ou, sans ETD, dont l'heure atteint STD + 15 min.
10. Pas de « EMBARQUEMENT CLOS » calculé : seul Paris Aéroport / Gatenavo le donne.

## Lectures
11. Un vol parti dont l'ETA est dépassée de 15 min ou plus, sans atterrissage ni ATA, est lu EN PRIORITÉ (rang 0,1), avant les vols plus lointains, toutes les 6 min (puis 15 min après 2 h, 1 h après 6 h).
12. La page FIDS du vol (ATA / ATD réels) est lue à CHAQUE passage du cron (toutes les 2 min) pour tout vol décollé ou posé sans ATA réelle (vide ou calculée), les vols dont l'ETA est dépassée d'abord. Le FIDS n'a pas de risque de pause : on le lit souvent. FlightStats garde sa règle d'origine (dernier secours, pause automatique) : ne pas l'élargir.
13. Un vol COMPLET (ATA réelle + ATD) n'est plus lu du tout.
14. Un vol qui ne répond pas (TIMEOUT 25 s) passe au bout de la file ; le passage a une échéance de 40 s pour les lectures par vol.

15. FlightStats prend le relais pour l'ATA (ordre FIDS, puis FlightStats, puis FlightAware) seulement quand le FIDS n'a plus accès au vol (page du vol disparue, 404 / 410) : vol parti sans atterrissage ni ATA. Tant que le FIDS répond, FlightStats n'est pas appelé pour cela. Le plafond et la pause automatique de FlightStats ne sont pas modifiés.

17. Relecture UNIQUE par FlightStats (marquée `fsRepairAt`) des vols arrivés dont le LDG manque, dont l'ATA est calculée, ou dont le LDG / l'ATA vient de FlightStats. Elle n'écrit que LDG et ATA : un LDG FR24 n'est pas remplacé, une ATA FIDS non plus, une saisie manuelle jamais. Elle a sa PROPRE étape du cron (`fs-repair`, 1 vol par passage, 8 s au plus, après les pages FIDS, les plus anciennement lus d'abord) : elle ne passe jamais dans les lectures par vol, qu'elle ralentirait. FlightStats : LDG = Runway Actual, ATA = Gate Actual, première valeur de chaque libellé (l'historique « Event Timeline » en bas de page est ignoré). FR24 : « Landed » = LDG, jamais ATA.

## Passage automatique (cron)
16. Étapes essentielles, jamais sautées : Gatenavo, flux FIDS en bloc, lectures par vol, tableau FR24, statuts. Les autres sont facultatives (sautées passé 60 s, durée maximale chacune). Les pages FIDS par vol viennent juste après les lectures par vol, AVANT les étapes lentes (relecture FlightStats, ETD) : elles donnent les ATA réelles et ne doivent pas être sautées.
