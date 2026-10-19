import {Equals,IsEmail,IsString,Matches,MaxLength} from 'class-validator';
export class OfferCodeRequestDto{@IsEmail() @MaxLength(254) email!:string;}
export class AcceptProposalDto{
 @IsString() @Matches(/^\d{6}$/) code!:string;
 @IsString() @Matches(/\S/) @MaxLength(180) name!:string;
 @IsEmail() @MaxLength(254) email!:string;
 @Equals(true) reviewed!:boolean;
}
export class DecideProposalDto{@IsString() @MaxLength(1000) note!:string;}
