import {Type} from 'class-transformer';import {ArrayMaxSize,Equals,IsArray,IsBoolean,IsIn,IsInt,IsISO8601,IsNumber,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min,ValidateNested} from 'class-validator';
export class CreateSupportWorkDto {@IsUUID() requestKey!:string;@IsString() @Matches(/\S/) @MaxLength(150) title!:string;}
export class WorkPartDto {
 @IsString() @Matches(/\S/) @MaxLength(120) code!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) description!:string;
 @IsString() @MaxLength(150) supplier!:string;
 @IsInt() @Min(1) @Max(10000) required!:number;
 @IsInt() @Min(0) @Max(10000) available!:number;
 @IsOptional() @IsInt() @Min(0) @Max(10000) used?:number;
 @IsOptional() @IsInt() @Min(0) @Max(100000000) unitCostCents?:number;
}
export class SupportWorkDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['PLANNED','CONFIRMED','COMPLETED','CANCELLED']) status!:string;
 @IsIn(['TO_ASSESS','WARRANTY','CHARGEABLE']) coverage!:string;
 @IsString() @MaxLength(150) crew!:string;
 @IsOptional() @IsISO8601() startAt?:string;
 @IsOptional() @IsInt() @Min(15) @Max(10080) durationMinutes?:number;
 @IsBoolean() availabilityChecked!:boolean;
 @IsBoolean() customerAgreed!:boolean;
 @IsArray() @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>WorkPartDto) parts!:WorkPartDto[];
 @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn?:string;
 @IsOptional() @IsNumber() @Min(0) @Max(10000) hours?:number;
 @IsOptional() @IsInt() @Min(0) @Max(1000000) hourlyRateCents?:number;
 @IsOptional() @IsInt() @Min(0) @Max(100000000) otherCostCents?:number;
 @IsOptional() @IsInt() @Min(0) @Max(100000000) proposedChargeCents?:number;
 @IsOptional() @IsString() @MaxLength(100) replacesLaborId?:string;
 @IsOptional() @IsString() @MaxLength(100) replacesPartsId?:string;
 @IsOptional() @IsString() @MaxLength(100) replacesOtherId?:string;
 @IsBoolean() financeReviewed!:boolean;
 @IsOptional() @IsInt() @Min(0) financeRevision?:number;
 @IsString() @Matches(/\S/) @MaxLength(3000) note!:string;
 @IsString() @MaxLength(4000) customerMessage!:string;
 @Equals(true) reviewed!:boolean;
}
