import {Type} from 'class-transformer';
import {ArrayMaxSize,Equals,IsArray,IsInt,IsNumber,IsString,IsUUID,Matches,Max,MaxLength,Min,ValidateNested} from 'class-validator';
import {CatalogConfigurationDto} from '../dealer-catalogs/catalogs.dto.js';
export class ImportedSupplementDto{
 @IsString() @Matches(/\S/) @MaxLength(180) description!:string;
 @IsInt() @Min(0) @Max(100000000) amountCents!:number;
}
export class ImportedCaseItemDto extends CatalogConfigurationDto{
 @IsUUID() requestKey!:string;
 @IsString() @MaxLength(100) catalogId!:string;
 @IsString() @Matches(/^[a-f0-9]{64}$/) catalogHash!:string;

 @IsString() @MaxLength(180) color!:string;
 @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>ImportedSupplementDto) supplements!:ImportedSupplementDto[];
 @Equals(true) conditionsReviewed!:boolean;
}
export class UpdateImportedCaseItemDto extends ImportedCaseItemDto{@IsInt() @Min(1) version!:number;}


