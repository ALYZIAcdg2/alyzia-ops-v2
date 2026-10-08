// Tuiles WEB / STANDBY / AVAILABLE de la fiche vol : les classes (F J S Y ou C Y) passent en ligne au lieu d'être empilées en colonne.
// Chaque classe = lettre au-dessus de sa valeur ; la tuile mesure sa propre largeur (container query) : 4 classes sur une ligne si la place le permet, sinon 2 × 2.
export const CLASS_ROWS_UI=String.raw`<style id="alyzia-class-rows-css">
#app .wsa-cell{container-type:inline-size}
#app .wsa-cell .wsa-mini-classes{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px 4px!important;align-items:stretch!important;justify-content:stretch!important;width:100%!important;margin-top:4px!important}
#app .wsa-cell .wsa-mini-row{display:flex!important;flex-direction:column!important;align-items:center!important;gap:2px!important;grid-template-columns:none!important;min-width:0!important;font-size:inherit!important}
#app .wsa-cell .wsa-mini-row span{font-size:10px!important;line-height:1!important;letter-spacing:.04em}
#app .wsa-cell .wsa-mini-row button{width:100%!important;min-width:0!important;height:28px!important;padding:0 2px!important;font-size:13px!important;border-radius:9px!important}
@container (min-width:150px){#app .wsa-cell .wsa-mini-classes{grid-template-columns:repeat(auto-fit,minmax(34px,1fr))!important}}
@container (min-width:220px){#app .wsa-cell .wsa-mini-row button{height:32px!important;font-size:15px!important}#app .wsa-cell .wsa-mini-row span{font-size:11px!important}}
</style>`;
