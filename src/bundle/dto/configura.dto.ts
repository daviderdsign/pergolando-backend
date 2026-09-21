import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfiguraDto {
  @IsString()
  sottoModello!: string;

  @IsString()
  varianteMontaggio!: string;

  @IsInt()
  @Min(1)
  pRichiestaCm!: number;

  @IsInt()
  @Min(1)
  lRichiestaCm!: number;

  @IsString()
  coloreStruttura!: string;

  @IsString()
  colorePlastica!: string;

  @IsInt()
  @Min(1)
  altezzaMontantiCm!: number;

  @IsOptional()
  @IsString()
  opzioneTecnica?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nModuli?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  opzioniPrezzoFisso?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessoriSelezionati?: string[];
}
