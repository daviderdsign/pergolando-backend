import {Type} from 'class-transformer';
import {ArrayMaxSize,ArrayUnique,Equals,IsArray,IsIn,IsInt,IsString,IsUUID,Matches,MaxLength,Min,ValidateNested} from 'class-validator';
export const HANDOVER_CHECKS={installation:'Posa e componenti installati',fastenings:'Fissaggi verificati dal tecnico',operation:'Prova di funzionamento',site:'Riordino e condizioni del cantiere',instructions:'Istruzioni di uso e manutenzione',documents:'Documenti e garanzie consegnati'};
export class HandoverCheckDto {
 @IsIn(Object.keys(HANDOVER_CHECKS)) id!:string;
 @IsIn(['OK','ISSUE','NA']) result!:string;
 @IsString() @MaxLength(1000) note!:string;
}
export class HandoverDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['COMPLETED','RESERVATIONS','NOT_COMPLETED']) outcome!:string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsString() @Matches(/\S/) @MaxLength(150) technician!:string;
 @IsString() @MaxLength(150) receiver!:string;
 @IsString() @Matches(/\S/) @MaxLength(3000) note!:string;
 @IsString() @MaxLength(3000) reservations!:string;
 @IsArray() @ArrayMaxSize(6) @ValidateNested({each:true}) @Type(()=>HandoverCheckDto) checks!:HandoverCheckDto[];
 @IsArray() @ArrayMaxSize(8) @ArrayUnique() @IsString({each:true}) @MaxLength(100,{each:true}) fileIds!:string[];
 @Equals(true) reviewed!:boolean;
}
