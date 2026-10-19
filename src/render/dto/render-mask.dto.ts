import {IsString,MaxLength,Matches,IsIn,IsNumber,Min,Max} from 'class-validator';
export class RenderMaskDto {
 @IsIn(["residenziale","horeca"]) environment!:"residenziale"|"horeca";
 @IsNumber() @Min(1) @Max(10000) widthCm!:number;
 @IsNumber() @Min(1) @Max(10000) depthCm!:number;
 @IsString() @MaxLength(10000000) @Matches(/^data:image\/(png|jpeg|webp);base64,/) image!:string;
 @IsString() @MaxLength(5000000) @Matches(/^data:image\/png;base64,/) mask!:string;
 @IsString() @MaxLength(120) color!:string;
}
