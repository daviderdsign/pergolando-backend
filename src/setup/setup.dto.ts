import {IsInt,Min,IsString,MaxLength,Equals} from 'class-validator';
export class SetupSaveDto{@IsInt() @Min(0) revision!:number;@IsString() @MaxLength(11000000) profile!:string;}
export class SetupAcceptDto{@IsString() @MaxLength(64) hash!:string;@IsString() @MaxLength(160) signer!:string;@IsString() @MaxLength(180) company!:string;@Equals(true) authorized!:boolean;@Equals(true) reviewed!:boolean;}
export class SetupFinishDto{@IsInt() @Min(1) revision!:number;@Equals(true) reviewed!:boolean;}
