import {Equals,IsBoolean,IsIn,IsInt,IsISO8601,IsString,IsUUID,Matches,Max,MaxLength,Min} from 'class-validator';
export class InstallationDto {
 @IsUUID() requestKey!:string;
 @IsInt() @Min(0) revision!:number;
 @IsIn(['PROVISIONAL','CONFIRMED','CANCELLED']) status!:string;
 @IsString() @Matches(/\S/) @MaxLength(150) crew!:string;
 @IsString() @MaxLength(1000) resources!:string;
 @IsISO8601() startAt!:string;
 @IsInt() @Min(15) @Max(10080) durationMinutes!:number;
 @IsString() @Matches(/\S/) @MaxLength(2000) note!:string;
 @IsBoolean() crewAvailable!:boolean;
 @IsBoolean() siteReady!:boolean;
 @IsBoolean() deliveryReliable!:boolean;
 @IsBoolean() customerAgreed!:boolean;
 @Equals(true) reviewed!:boolean;
}
