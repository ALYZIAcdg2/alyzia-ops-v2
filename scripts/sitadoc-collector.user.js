// ==UserScript==
// @name         Alyzia · collecteur Sitadoc « Vols Départ »
// @namespace    alyzia-ops
// @version      1.0
// @description  Lit le tableau « Vols Départ » de Sitadoc CDG toutes les 2 minutes et envoie les heures (ATD, décollage, ETD) à Alyzia Ops.
// @match        http://sitadoc-cdg/sitadoc/intranet/voltvm.php*
// @grant        GM_xmlhttpRequest
// @connect      alyzia-ops-v2.alyzia-cdg2.workers.dev
// ==/UserScript==
//
// Installation : extension Tampermonkey (Chrome) -> nouveau script -> coller ce fichier -> remplacer TOKEN par le secret SITADOC_TOKEN
// du Worker -> enregistrer. Garder l'onglet « Vols Départ » ouvert sur le poste connecté à Sitadoc. Le script n'envoie que les heures,
// l'immatriculation, le type, le parc, la porte et le nombre de passagers de nos vols : aucun message n'est lu ni transmis.
(function(){
  "use strict";
  var WORKER="https://alyzia-ops-v2.alyzia-cdg2.workers.dev/api/v2/sitadoc/departures";
  var TOKEN="COLLER_ICI_LE_JETON";
  var EVERY_MS=120000;

  // Une ligne du tableau (19 cellules) + l'adresse du lien du vol -> objet à envoyer, ou null si ce n'est pas une ligne de vol.
  // Cellules : 0 Messages · 1 InfoVol · 2 Site · 3 Vol · 4 SCH · 5 TSA · 6 HDB · 7 CODE · 8 HPD · 9 Nature · 10 Dest · 11 Cust · 12 Immat · 13 A/C · 14 Parc · 15 Porte · 16 BNQ · 17 PAX · 18 Stay
  function rowFromCells(c,href){
    if(!c||c.length<18)return null;
    var t=function(i){return String(c[i]==null?"":c[i]).replace(/\s+/g," ").trim()};
    var sch=t(4),m=/date=(\d{4})(\d{2})(\d{2})/.exec(String(href||""));
    if(!/^\d{1,2}:\d{2}$/.test(sch)||!m||!/^[A-Z0-9]{2}\s*\d{1,4}/i.test(t(3)))return null;
    return {date:m[1]+"-"+m[2]+"-"+m[3],flight:t(3),sch:sch,tsa:t(5),hdb:t(6),code:t(7),hpd:t(8),dest:t(10),reg:t(12),type:t(13),parking:t(14),gate:t(15),counter:t(16),pax:t(17)};
  }

  function collect(doc){
    var out=[],seen={},trs=doc.querySelectorAll("tr");
    for(var i=0;i<trs.length;i++){
      var tds=trs[i].querySelectorAll(":scope > td");if(tds.length<18)continue;
      var cells=[],k;for(k=0;k<tds.length;k++)cells.push(tds[k].textContent);
      var a=trs[i].querySelector("td:nth-child(4) a"),row=rowFromCells(cells,a&&a.getAttribute("href"));
      if(!row)continue;var key=row.date+"|"+row.flight+"|"+row.sch;if(seen[key])continue;seen[key]=1;out.push(row);
    }
    return out;
  }

  function send(){
    var rows=collect(document);if(!rows.length)return;
    GM_xmlhttpRequest({method:"POST",url:WORKER,headers:{"content-type":"application/json","x-sitadoc-token":TOKEN},data:JSON.stringify({rows:rows}),timeout:30000,
      onload:function(r){var j={};try{j=JSON.parse(r.responseText)}catch(e){}
        console.log("[Alyzia] envoi",rows.length,"lignes ->",r.status,j.updated!=null?(j.updated+" vols mis à jour, "+j.unmatched+" non trouvés"):r.responseText.slice(0,120))},
      onerror:function(){console.warn("[Alyzia] envoi impossible")},ontimeout:function(){console.warn("[Alyzia] délai dépassé")}});
  }

  if(typeof document!=="undefined"&&typeof GM_xmlhttpRequest!=="undefined"){
    send();
    if(!document.querySelector('meta[http-equiv="refresh"]'))setTimeout(function(){location.reload()},EVERY_MS);
  }
  if(typeof window!=="undefined")window.__alyziaSitadoc={collect:collect};
  if(typeof module!=="undefined")module.exports={rowFromCells:rowFromCells};
})();
