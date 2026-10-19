export type EnvironmentKind='residenziale'|'horeca';
export function tableLayout(widthCm:number,depthCm:number){
 const width=widthCm/100,depth=depthCm/100,area=width*depth;
 const capacity=Math.floor(area/2);
 if(capacity<1)return {area,count:0,rows:0,columns:0};
 if(capacity===1)return {area,count:1,rows:1,columns:1};
 const maximum=capacity-capacity%2;
 let best={area,count:maximum,rows:1,columns:maximum},score=Infinity;
 // Prefer a full, regular grid oriented to the actual footprint. Avoid a long single row when a slightly smaller grid fits better.
 for(let count=maximum;count>=Math.max(2,maximum-4);count-=2){
  for(let rows=1;rows<=count;rows++){if(count%rows)continue;const columns=count/rows;
   const candidate=Math.abs(Math.log((columns/rows)/(width/depth)))+2*(maximum-count)/maximum;
   if(candidate<score){score=candidate;best={area,count,rows,columns};}
  }
 }
 return best;
}
export function furniturePrompt(kind:EnvironmentKind,widthCm:number,depthCm:number,random=Math.random){
 const area=widthCm*depthCm/10000;
 const dimensions=`La pergola misura ${(widthCm/100).toFixed(2)} m di larghezza e ${(depthCm/100).toFixed(2)} m di profondità, superficie ${area.toFixed(1)} m². Mantieni gli arredi dentro questa pianta, senza ingrandire la struttura.`;
 if(kind==='residenziale')return dimensions+' '+(random()<.5
  ?'Crea un ambiente residenziale per pranzo all’aperto: un tavolo da pranzo da esterno, sedie proporzionate allo spazio, alcune persone sedute che mangiano e due piante in vaso ai margini.'
  :'Crea un salotto residenziale da esterno: un divano, due poltrone, un tavolino basso, due piante in vaso e alcune persone sedute che chiacchierano. Se lo spazio è ridotto, riduci gli arredi senza affollarlo.');
 const layout=tableLayout(widthCm,depthCm),style=random()<.5?'bar, con bevande e caffè':'ristorante, con tavoli apparecchiati';
 return dimensions+` Crea un ambiente Ho.Re.Ca. da ${style}. `+(layout.count
  ?`Inserisci ${layout.count} tavolini con quattro sedie ciascuno, ordinati in ${layout.rows} file lungo la profondità e ${layout.columns} tavoli per fila lungo la larghezza. La stima è circa 2 m² per gruppo tavolo e sedie; lascia spazio visivo per accesso e passaggi, riducendo gli arredi se necessario anziché sovrapporli. Alcuni clienti sono seduti, senza occupare tutte le sedie.`
  :'Lo spazio è troppo piccolo per un gruppo tavolo e quattro sedie: non forzare un arredamento affollato.');
}
