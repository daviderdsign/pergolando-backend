import {Type} from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,Equals,IsArray,IsIn,IsInt,IsNumber,IsString,IsUUID,Matches,Max,MaxLength,Min,ValidateNested} from 'class-validator';
export class SupportQuoteLineDto {
 @IsString() @Matches(/\S/) @MaxLength(250) description!:string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(10000) quantity!:number;
 @IsInt() @Min(0) @Max(100000000) unitPriceCents!:number;
 @IsInt() @Min(0) @Max(10000) vatBps!:number;
}
export class SupportQuoteDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) workRevision!:number;
 @IsInt() @Min(0) quoteRevision!:number;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) validUntil!:string;
 @IsString() @Matches(/\S/) @MaxLength(2000) terms!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>SupportQuoteLineDto) lines!:SupportQuoteLineDto[];
 @Equals(true) reviewed!:boolean;
}
export class SupportQuoteDecisionDto {
 @IsUUID() requestKey!:string;
 @IsIn(['ACCEPTED','REJECTED','WITHDRAWN']) decision!:string;
 @IsString() @MaxLength(2000) note!:string;
 @Equals(true) reviewed!:boolean;
}
