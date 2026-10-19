import {IsString,IsNotEmpty,MaxLength,IsEmail,IsOptional,IsUUID,IsInt,Min,Max,IsBoolean,Equals,Matches} from 'class-validator';
import {ConfiguraDto} from '../bundle/dto/configura.dto.js';
export class CreateCaseDto {
 @IsOptional() @IsString() @Matches(/\S/) @MaxLength(160) caseName?:string;
 @IsOptional() @IsString() @MaxLength(180) companyName?:string;
 @IsOptional() @IsString() @MaxLength(500) siteAddress?:string;
 @IsOptional() @IsString() @MaxLength(2000) projectNotes?:string;
 @IsOptional() @IsUUID() creationKey?:string;

 @IsString() @IsNotEmpty() @MaxLength(100) firstName!:string;
 @IsString() @IsNotEmpty() @MaxLength(100) lastName!:string;
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
 @IsString() @MaxLength(50) phone!:string;
 @IsString() @MaxLength(500) address!:string;
}
export class AddCaseItemDto extends ConfiguraDto { @IsUUID() requestKey!:string; @IsOptional() @IsInt() @Min(0) deltaHCm?:number; }

export class UpdateCaseItemDto extends AddCaseItemDto { @IsInt() @Min(1) version!:number; }
export class ArchiveCaseItemDto { @IsInt() @Min(1) version!:number; @IsBoolean() archived!:boolean; }
export class CreateProposalDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsInt() @Min(0) @Max(100000000) installationCents!:number;
 @IsInt() @Min(0) @Max(100000000) transportCents!:number;
 @IsInt() @Min(0) @Max(10000) discountBps!:number;
 @IsInt() @Min(0) @Max(10000) vatBps!:number;
 @IsInt() @Min(0) @Max(10000) depositBps!:number;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) validUntil!:string;
 @IsString() @MaxLength(2000) notes!:string;
 @Equals(true) netPricesConfirmed!:boolean;
}
