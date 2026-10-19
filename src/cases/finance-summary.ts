type Entry={id:string;supersedesId:string|null;absorbsEntryId?:string|null;kind:string;stage:string;amountCents:number;costPending?:boolean};
export function financeSummary(entries:Entry[],costsComplete:boolean,delivered:boolean){
 const absorbed=new Set(entries.map(e=>e.absorbsEntryId).filter(Boolean));const superseded=new Set(entries.flatMap(e=>[e.supersedesId,e.absorbsEntryId]).filter(Boolean));const active=entries.filter(e=>!superseded.has(e.id));
 const sum=(kinds:string[],stage:string)=>active.filter(e=>kinds.includes(e.kind)&&e.stage===stage).reduce((s,e)=>s+e.amountCents,0);
 const costs=['SUPPLIER','LABOR','TRANSPORT','TRAVEL','OTHER'];
 const replacedPlans=new Set(entries.filter(e=>e.stage==='PLANNED').map(e=>e.supersedesId));const planned=(kinds:string[])=>entries.filter(e=>e.stage==='PLANNED'&&kinds.includes(e.kind)&&!replacedPlans.has(e.id)&&!absorbed.has(e.id)).reduce((total,e)=>total+e.amountCents,0);
 const revenue=sum(['REVENUE'],'ACTUAL'),plannedRevenue=planned(['REVENUE']);const actualCosts=sum(costs,'ACTUAL'),plannedCosts=planned(costs);const overhead=sum(['OVERHEAD'],'ACTUAL');
 const hasRevenue=active.some(e=>e.kind==='REVENUE'&&e.stage==='ACTUAL');const margin=hasRevenue?revenue-actualCosts:null;
 const provisional=!costsComplete||active.some(e=>costs.includes(e.kind)&&(e.stage==='PLANNED'||e.costPending))||!hasRevenue;
 return{revenue,plannedRevenue,actualCosts,plannedCosts,overhead,directMargin:margin,marginPercent:margin!==null&&revenue>0?margin/revenue*100:null,marginAfterOverhead:margin===null?null:margin-overhead,forecastMargin:plannedRevenue-plannedCosts,cashIn:sum(['CASH_IN'],'ACTUAL'),cashOut:sum(['CASH_OUT'],'ACTUAL'),provisional,assistanceEligible:delivered,activeIds:active.map(e=>e.id)};
}
