import {createHash} from 'node:crypto';
export function currentContract(){
 const draft={version:'prova-2026-10-15',mode:'trial',title:'Configurazione di prova — rapporto con Pergolando',text:'BOZZA DA REVISIONARE LEGALMENTE. Non è un contratto commerciale definitivo e non attiva addebiti.\n\nIl servizio permette di preparare cataloghi, preventivi e immagini. Prima dell’utilizzo commerciale devono essere definite e approvate condizioni del servizio, assistenza, disponibilità, rinnovo, disdetta, conservazione/esportazione dei dati e privacy.\n\nIl rivenditore verifica prezzi estratti, condizioni, misure e fattibilità tecnica prima di inviare offerte o ordini. Dichiara di disporre dei diritti necessari sui cataloghi, loghi e fotografie caricati. Rendering e immagini IA sono illustrativi e richiedono controllo.\n\nQuesta conferma registra solo l’avvio della prova e la presa visione delle indicazioni. Non esclude responsabilità inderogabili di Pergolando. L’abbonamento Pergolando è separato da acconti e saldi delle commesse, gestiti dal rivenditore. Non è richiesto alcun consenso marketing.',plan:'Prova — nessun pagamento attivato'};
 let document=draft;
 if(process.env.PERGOLANDO_CONTRACT_JSON){
  const parsed=JSON.parse(process.env.PERGOLANDO_CONTRACT_JSON);
  if(!parsed||parsed.mode!=='approved'||!['version','title','text','plan'].every(k=>typeof parsed[k]==='string'&&parsed[k].trim()&&parsed[k].length<50000))throw new Error('Configurazione contratto Pergolando non valida.');
  document={version:parsed.version,mode:parsed.mode,title:parsed.title,text:parsed.text,plan:parsed.plan};
 }
 return {...document,hash:createHash('sha256').update(JSON.stringify(document)).digest('hex')};
}
