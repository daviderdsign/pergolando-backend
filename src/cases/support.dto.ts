import {Type} from 'class-transformer';import {ArrayMaxSize,Equals,IsArray,IsIn,IsInt,IsString,IsUUID,Matches,MaxLength,Min,ValidateNested} from 'class-validator';
export class SupportPhotoDto {
 @IsString() @Matches(/\S/) @MaxLength(120) name!:string;
 @IsIn(['image/png','image/jpeg']) mimeType!:string;
 @IsString() @MaxLength(4200000) data!:string;
}
export class CreateSupportTicketDto {
 @IsUUID() requestKey!:string;
 @IsString() @Matches(/\S/) @MaxLength(150) title!:string;
 @IsString() @Matches(/\S/) @MaxLength(4000) description!:string;
 @IsIn(['NORMAL','HIGH']) priority!:string;
 @IsArray() @ArrayMaxSize(3) @ValidateNested({each:true}) @Type(()=>SupportPhotoDto) photos!:SupportPhotoDto[];
}
export class SupportReplyDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsString() @Matches(/\S/) @MaxLength(4000) message!:string;
 @IsArray() @ArrayMaxSize(3) @ValidateNested({each:true}) @Type(()=>SupportPhotoDto) photos!:SupportPhotoDto[];
}
export class SupportUpdateDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED']) status!:string;
 @IsIn(['NORMAL','HIGH']) priority!:string;
 @IsString() @MaxLength(150) assignee!:string;
 @IsString() @MaxLength(4000) internalNote!:string;
 @IsString() @MaxLength(4000) message!:string;
 @Equals(true) reviewed!:boolean;
}
