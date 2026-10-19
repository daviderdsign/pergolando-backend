import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {DomainException} from '../common/domain-exception.js';import {HttpStatus} from '@nestjs/common';
export async function supportQuotePdf(s:any){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.HelveticaBold);let page:any,y=0,n=0;
 function clean(v:unknown){const value=String(v??'');for(const c of value){if(c==='\n')continue;try{font.encodeText(c);}catch{throw new DomainException('TESTO_PDF','Il PDF contiene un carattere non supportato: '+c+'. Correggi il testo prima di emettere.',HttpStatus.CONFLICT);}}return value;}
 function next(){page=doc.addPage([841.89,595.28]);n++;y=548;page.drawText('pergolando',{x:44,y,font:bold,size:21,color:rgb(.09,.25,.21)});for(const i of [4,9]){const x=44+bold.widthOfTextAtSize('pergolando'.slice(0,i),21);page.drawLine({start:{x:x+3,y:y+3},end:{x:x+9,y:y+9},thickness:1.7,color:rgb(.09,.25,.21)});}y-=38;page.drawText('PREVENTIVO ASSISTENZA',{x:44,y,font:bold,size:16});y-=30;page.drawText(`Versione ${s.number} - pagina ${n}`,{x:44,y:23,font,size:9});}
 function text(v:unknown,strong=false){const f=strong?bold:font;for(const p of clean(v).split('\n')){let line='';for(const c of p){if(f.widthOfTextAtSize(line+c,12)>750){if(y<65)next();page.drawText(line,{x:44,y,font:f,size:12});y-=18;line='';}line+=c;}if(y<65)next();page.drawText(line,{x:44,y,font:f,size:12});y-=18;}}
 const money=(n:number)=>(n/100).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' EUR';
 next();text(`Rivenditore: ${s.dealer}`,true);text(`Cliente: ${s.client} - ${s.email}`);text(`Pratica: ${s.caseName}`);text(`Intervento: ${s.title}`);text(`Emesso: ${s.issuedOn} - Valido fino al ${s.validUntil} (UTC)`);y-=12;
 for(const l of s.lines){text(l.description,true);text(`Quantita ${l.quantity} x ${money(l.unitPriceCents)} netto IVA | IVA ${l.vatBps/100}% | Totale ${money(l.grossCents)}`);y-=9;}
 text(`Imponibile ${money(s.netCents)} - IVA ${money(s.vatCents)} - Totale ${money(s.grossCents)}`,true);y-=12;text('Condizioni e attivita comprese',true);text(s.terms);y-=12;text('Documento commerciale. Non attesta accettazione, pagamento o fatturazione.');
 return Buffer.from(await doc.save());
}
