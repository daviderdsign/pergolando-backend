import {IsIn,IsInt,Min,Max,IsString,MaxLength,IsOptional,IsNumber,IsUUID,IsBoolean,Matches} from 'class-validator';
export class FinanceEntryDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['REVENUE','SUPPLIER','LABOR','TRANSPORT','TRAVEL','OTHER','OVERHEAD','CASH_IN','CASH_OUT']) kind!:string;
 @IsIn(['PLANNED','ACTUAL']) stage!:string;
 @IsString() @Matches(/\S/) @MaxLength(250) description!:string;
 @IsString() @MaxLength(120) supplier!:string;
 @IsInt() @Min(0) @Max(100000000) amountCents!:number;
 @IsOptional() @IsNumber() @Min(0) @Max(100000) hours?:number;
 @IsOptional() @IsInt() @Min(0) @Max(1000000) hourlyRateCents?:number;
 @IsOptional() @IsString() @MaxLength(100) supersedesId?:string;
 @IsOptional() @IsString() @MaxLength(100) documentId?:string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
}
export class FinanceStateDto {
 @IsInt() @Min(0) revision!:number;
 @IsBoolean() costsComplete!:boolean;
 @IsBoolean() delivered!:boolean;
}
export class FinanceDocumentDto {
 @IsString() @Matches(/\S/) @MaxLength(160) name!:string;
 @IsString() @MaxLength(4000000) data!:string;
 @IsIn(['application/pdf','image/png','image/jpeg']) mimeType!:string;
}
