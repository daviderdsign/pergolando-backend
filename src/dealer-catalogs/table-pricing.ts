// Pricing rules mirrored from the browser importer; parity covered by tests.
export type PriceTable={id:string;source:string;page:number;title:string;columns:number[];rows:{depth:number;prices:(number|null)[]}[];unit:'cm'|'mm'|'m';horizontal:'width'|'depth';confirmed:boolean;notesReviewed:boolean;notes:string;preview?:string};
export function validateTable(table:PriceTable):string[]{
 const errors:string[]=[];if(!table.title.trim())errors.push('Inserisci il nome del modello e della variante.');
 if(table.columns.length<2||table.rows.length<2)errors.push('Servono almeno due larghezze e due profondità.');
 if(table.columns.some((n,i)=>!Number.isFinite(n)||n<=0||i>0&&n<=table.columns[i-1]))errors.push('Le dimensioni delle colonne devono crescere, senza duplicati.');
 if(table.rows.some((r,i)=>!Number.isFinite(r.depth)||r.depth<=0||i>0&&r.depth<=table.rows[i-1].depth))errors.push('Le dimensioni delle righe devono crescere, senza duplicati.');
 if(table.rows.some(r=>r.prices.length!==table.columns.length||r.prices.some(p=>p!==null&&(!Number.isFinite(p)||p<=0))))errors.push('I prezzi devono essere positivi. Lascia vuote le celle non disponibili.');
 if(!table.rows.some(r=>r.prices.some(p=>p!==null)))errors.push('Nessun prezzo disponibile.');
 if(!table.notesReviewed)errors.push('Verifica le note, le inclusioni e gli eventuali supplementi.');return errors;
}
export function priceFromImportedTable(table:PriceTable,widthCm:number,depthCm:number,rule:'ceil'|'exact'='ceil'){
 if(!table.confirmed||validateTable(table).length)throw new Error('La tabella deve essere verificata e confermata.');
 if(!Number.isFinite(widthCm)||!Number.isFinite(depthCm)||widthCm<=0||depthCm<=0)throw new Error('Inserisci misure positive.');
 const factor=table.unit==='mm'?.1:table.unit==='m'?100:1,x=table.horizontal==='width'?widthCm:depthCm,y=table.horizontal==='width'?depthCm:widthCm;
 const col=table.columns.findIndex(n=>rule==='exact'?Math.abs(n*factor-x)<.001:n*factor>=x),row=table.rows.findIndex(r=>rule==='exact'?Math.abs(r.depth*factor-y)<.001:r.depth*factor>=y);
 if(col<0||row<0)throw new Error('Misure non coperte dal listino. Nessuna estrapolazione dei prezzi.');
 const price=table.rows[row].prices[col];if(price===null)throw new Error('La combinazione scelta non ha un prezzo nel documento.');
 return {price,widthBucketCm:(table.horizontal==='width'?table.columns[col]:table.rows[row].depth)*factor,depthBucketCm:(table.horizontal==='width'?table.rows[row].depth:table.columns[col])*factor};
}
