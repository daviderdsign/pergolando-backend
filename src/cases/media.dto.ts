import {Type} from 'class-transformer';import {IsInt,Min,IsUUID,IsArray,ArrayMinSize,ArrayMaxSize,ValidateNested,IsIn,IsString,MaxLength,Matches} from 'class-validator';
class MediaImageDto{
 @IsIn(['render','plan','front','side']) kind!:string;
 @IsString() @MaxLength(2200000) @Matches(/^data:image\/(png|jpeg);base64,/) data!:string;
}
export class CaseMediaDto{
 @IsUUID() requestKey!:string;
 @IsInt() @Min(1) version!:number;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @ValidateNested({each:true}) @Type(()=>MediaImageDto) images!:MediaImageDto[];
}
