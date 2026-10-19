import {Equals,IsEmail,IsIn,IsString,IsUUID,Matches,MaxLength} from 'class-validator';
export class PartOrderMailPreviewDto {@IsEmail() @MaxLength(254) recipient!:string;}
export class PartOrderMailSendDto extends PartOrderMailPreviewDto {
 @IsUUID() requestKey!:string;
 @IsString() @Matches(/^[a-f0-9]{64}$/) snapshotHash!:string;
 @Equals(true) reviewed!:boolean;
}
export class PartOrderMailResolutionDto {
 @IsUUID() requestKey!:string;
 @IsIn(['RECEIVED','NOT_RECEIVED']) outcome!:string;
 @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) occurredOn!:string;
 @IsString() @Matches(/\S/) @MaxLength(200) reference!:string;
 @IsString() @Matches(/\S/) @MaxLength(2000) note!:string;
 @Equals(true) reviewed!:boolean;
}
