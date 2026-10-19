import {IsUUID,IsInt,Min,IsString,MaxLength,Matches,IsIn,Equals} from 'class-validator';
export class PaymentCheckDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsString() @MaxLength(100) entryId!:string;
 @IsIn(['VERIFIED','REVOKED']) status!:string;
 @IsIn(['TRANSFER','CARD','OTHER']) method!:string;
 @IsString() @MaxLength(160) reference!:string;
 @IsString() @Matches(/\S/) @MaxLength(1000) note!:string;
 @Equals(true) reviewed!:boolean;
}
