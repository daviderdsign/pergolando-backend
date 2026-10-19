import {Equals,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
export class PartDocumentDto {
 @IsOptional() @IsString() @MaxLength(100) invoiceId?:string;
 @IsOptional() @IsString() @MaxLength(100) basisCostId?:string;
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) financeRevision!:number;
 @IsString() @MaxLength(100) documentId!:string;
 @IsIn(['INVOICE','CREDIT','CONFIRMATION','OTHER']) kind!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) reference!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsInt() @Min(0) @Max(100000000) netCents!:number;
 @IsInt() @Min(0) @Max(100000000) allocatedCents!:number;
 @IsOptional() @IsString() @MaxLength(100) costId?:string;
 @IsOptional() @IsString() @MaxLength(100) supersedesId?:string;
 @IsString() @Matches(/\S/) @MaxLength(2000) note!:string;
 @Equals(true) reviewed!:boolean;
}

