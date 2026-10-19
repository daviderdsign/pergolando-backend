import {Type} from 'class-transformer';
import {ArrayMaxSize,ArrayMinSize,Equals,IsArray,IsBoolean,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min,ValidateNested} from 'class-validator';
export class PartOrderLineDto {
 @IsInt() @Min(0) @Max(29) partIndex!:number;
 @IsInt() @Min(1) @Max(10000) quantity!:number;
}
export class CreatePartOrderDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) workRevision!:number;
 @IsInt() @Min(0) ordersRevision!:number;
 @IsString() @Matches(/\S/) @MaxLength(1000) deliveryAddress!:string;
 @IsString() @Matches(/\S/) @MaxLength(3000) note!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>PartOrderLineDto) lines!:PartOrderLineDto[];
 @Equals(true) reviewed!:boolean;
}
export class PartArrivalDto {
 @IsInt() @Min(0) @Max(29) partIndex!:number;
 @IsInt() @Min(0) @Max(10000) received!:number;
}
export class PartOrderEventDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['SENT','CONFIRMATION','RECEIPT','RETURN','CANCELLED']) kind!:string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) reference!:string;
 @IsString() @Matches(/\S/) @MaxLength(3000) note!:string;
 @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedOn?:string;
 @IsArray() @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>PartArrivalDto) quantities!:PartArrivalDto[];
 @IsBoolean() correction!:boolean;
 @Equals(true) reviewed!:boolean;
}

