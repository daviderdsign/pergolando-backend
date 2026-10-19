import {Equals,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
export class SupportSettlementDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) financeRevision!:number;
 @IsString() @MaxLength(100) quoteId!:string;
 @IsIn(['REVENUE','CASH_IN','CASH_OUT']) kind!:string;
 @IsInt() @Min(0) @Max(100000000) amountCents!:number;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsIn(['NOT_APPLICABLE','BANK_TRANSFER','CARD','CASH','OTHER']) method!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) reference!:string;
 @IsString() @Matches(/\S/) @MaxLength(2000) note!:string;
 @IsOptional() @IsString() @MaxLength(100) replacesEntryId?:string;
 @Equals(true) reviewed!:boolean;
}
