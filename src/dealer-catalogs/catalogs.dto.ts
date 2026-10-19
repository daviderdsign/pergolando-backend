import {IsObject,IsString,Matches,MaxLength,IsOptional,IsInt,Min,Max,IsIn,IsBoolean,IsNumber,Equals} from 'class-validator';
export class CatalogDraftDto{@IsString() @Matches(/\S/) @MaxLength(120) name!:string;@IsString() @Matches(/\S/) @MaxLength(120) brand!:string;@IsString() @MaxLength(8000000) dataset!:string;@IsOptional() @IsString() @MaxLength(100) previousId?:string;}
export class CatalogUpdateDto extends CatalogDraftDto{@IsInt() @Min(1) revision!:number;}
export class CatalogPriceDto{@IsString() @MaxLength(300) tableId!:string;@IsNumber() @Min(.01) @Max(1000000) widthCm!:number;@IsNumber() @Min(.01) @Max(1000000) depthCm!:number;@IsIn(['exact','ceil']) rule!:'exact'|'ceil';}
export class CatalogCheckDto extends CatalogPriceDto{@IsInt() @Min(1) revision!:number;@IsBoolean() expectedReject!:boolean;@IsOptional() @IsInt() @Min(0) @Max(100000000) expectedCents?:number;}
export class CatalogApproveDto{@IsInt() @Min(1) revision!:number;@Equals(true) conditionsReviewed!:boolean;}
export class CatalogSourceDto{@IsString() @Matches(/\S/) @MaxLength(180) name!:string;@IsString() @Matches(/^[a-f0-9]{64}$/) hash!:string;@IsInt() @Min(1) @Max(52428800) size!:number;}
export class CatalogChunkDto{@IsString() @Matches(/^[A-Za-z0-9+/]+={0,2}$/) @MaxLength(1400000) data!:string;}

export class CatalogDeleteDto{@IsInt() @Min(1) revision!:number;@Equals(true) confirmed!:boolean;}
export class CatalogGenerateDto{@IsInt() @Min(1) revision!:number;}
export class CatalogReviewDto extends CatalogGenerateDto{@Equals(true) reviewed!:boolean;@IsBoolean() matches!:boolean;@IsString() @MaxLength(1000) note!:string;}
export class CatalogAnswerDto extends CatalogGenerateDto{@IsString() @MaxLength(80) questionId!:string;@IsString() @Matches(/\S/) @MaxLength(4000) answer!:string;}
export class CatalogConfigurationDto extends CatalogPriceDto{@IsNumber() @Min(.01) @Max(1000000) heightCm!:number;@IsOptional() @IsObject() selection?:Record<string,string|number|boolean>;}

