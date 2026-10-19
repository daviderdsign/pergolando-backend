import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
export async function orderPdf(batchId:string,snapshot:any,groupIndex:number){
 const group=snapshot.groups[groupIndex];if(!group)throw new Error('Produttore non disponibile.');
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page:any,y=0,count=0;
 const clean=(s:unknown)=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/\t/g,' ');
 function next(){page=doc.addPage([595.28,841.89]);count++;y=785;page.drawText('pergolando',{x:42,y,font:bold,size:19,color:rgb(.09,.25,.21)});for(const i of [4,9]){const x=42+bold.widthOfTextAtSize('pergolando'.slice(0,i),19);page.drawLine({start:{x:x+3,y:y+2.5},end:{x:x+8,y:y+8},thickness:1.7,color:rgb(.09,.25,.21)});}y-=30;page.drawText('ORDINE AL PRODUTTORE',{x:42,y,font:bold,size:13});y-=25;page.drawText(`Rif. ${batchId} / ${groupIndex+1} - pag. ${count}`,{x:42,y:28,font,size:9});}
 function text(value:unknown,size=11,strong=false){const f=strong?bold:font;for(const paragraph of clean(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){let parts=[word];if(f.widthOfTextAtSize(word,size)>510){parts=[];let part='';for(const c of word){if(f.widthOfTextAtSize(part+c,size)>500){parts.push(part);part='';}part+=c;}parts.push(part);}for(const part of parts){const candidate=line?line+' '+part:part;if(f.widthOfTextAtSize(candidate,size)>510){if(y<65)next();page.drawText(line,{x:42,y,font:f,size});y-=16;line=part;}else line=candidate;}}if(y<65)next();page.drawText(line,{x:42,y,font:f,size});y-=16;}}
 next();text(group.supplier,15,true);text(`Offerta cliente confermata: revisione ${snapshot.proposal.number}`);text(`Preparazione: ${snapshot.reviewedAt}`);y-=10;
 if(snapshot.dealer){text('RIVENDITORE',11,true);for(const key of ['company','vatNumber','address','email','phone'])if(snapshot.dealer[key])text(snapshot.dealer[key]);y-=10;}
 for(const line of group.lines){if(y<150)next();text(`${line.quantity} x ${line.productName}`,12,true);text(`Marchio: ${line.brand} - Codice: ${line.code}`);text('Specifiche verificate dal rivenditore:',11,true);text(line.specifications);y-=18;}
 text('Richiesta di conferma: codici, specifiche, prezzo di acquisto e data di consegna.',10);return Buffer.from(await doc.save());
}

