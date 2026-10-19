import {Type} from 'class-transformer';
import {IsEmail,IsIn,IsOptional,Max,IsBoolean} from 'class-validator';
import {ArrayMaxSize,ArrayMinSize,Equals,IsArray,IsInt,IsString,IsUUID,Matches,MaxLength,Min,ValidateNested} from 'class-validator';
export class SupplierLineDto {
 @IsString() @MaxLength(100) itemId!:string;
 @IsString() @Matches(/\S/) @MaxLength(160) supplier!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) code!:string;
 @IsString() @Matches(/\S/) @MaxLength(4000) specifications!:string;
 @IsInt() @Min(1) quantity!:number;
}
export class PrepareOrdersDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @Equals(true) reviewed!:boolean;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>SupplierLineDto) lines!:SupplierLineDto[];
}
export class OrderPreviewDto {
 @IsInt() @Min(0) groupIndex!:number;
 @IsEmail() @MaxLength(254) recipient!:string;
}
export class SendOrderDto extends OrderPreviewDto {
 @IsUUID() requestKey!:string;
 @IsString() @Matches(/^[a-f0-9]{64}$/) snapshotHash!:string;
 @Equals(true) reviewed!:boolean;
}
export class ReceivedLineDto {
 @IsString() @MaxLength(100) itemId!:string;
 @IsInt() @Min(0) @Max(10000) received!:number;
}
export class SupplierOrderEventDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsInt() @Min(0) groupIndex!:number;
 @IsIn(['CONFIRMATION','RECEIPT','INVOICE']) kind!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) reference!:string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsString() @Matches(/\S/) @MaxLength(2000) note!:string;
 @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedOn?:string;
 @IsOptional() @IsInt() @Min(0) @Max(100000000) netCostCents?:number;
 @IsOptional() @IsString() @MaxLength(100) fileId?:string;
 @IsOptional() @IsBoolean() financeReviewed?:boolean;
 @IsOptional() @IsBoolean() invoiceComplete?:boolean;
 @IsOptional() @IsString() @MaxLength(100) supersedesFinanceId?:string;
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>ReceivedLineDto) quantities!:ReceivedLineDto[];
 @Equals(true) reviewed!:boolean;
}
