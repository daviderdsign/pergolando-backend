import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * A point tapped by the seller on the site photo, normalized (0-1) relative
 * to the photo's own natural width/height — same convention the frontend
 * uses to store it, so no pixel/DPI ambiguity crosses the wire.
 */
export class PuntoRiferimentoDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  xNorm!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  yNorm!: number;
}

/**
 * Input for step 3 of the "compose on a real photo" pipeline: exactly 2
 * points tracing the wall-floor intersection line, in this fixed order
 * (start/end), plus its real length, plus the photo itself and the
 * pergola's own real dimensions.
 *
 * A traced line rather than 2 tapped feet: the pergola doesn't exist yet, so
 * asking the seller to tap where its (possibly nonexistent — wall mounting
 * has no rear foot at all) feet would land produced wildly inaccurate
 * results in practice (see 3d/NOTES.md) — a few pixels off on a floating
 * point is a large real-world error. A real, visible edge (the wall-floor
 * junction) can be traced precisely, and giving its own measured length
 * (rather than always assuming it equals the pergola's width) corrects for
 * whatever the seller actually traced. Camera orientation (the other 2
 * rotational DOF, plus real focal length) comes from GeoCalib instead, via
 * pergolando-geocalib-service — see PerspectiveService.
 */
export class CalcolaProspettivaDto {
  /** The site photo itself (data URL or raw base64) — GeoCalib needs the
   * actual image, not just its pixel size. */
  @IsString()
  fotoBase64!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PuntoRiferimentoDto)
  punti!: PuntoRiferimentoDto[];

  /** Real length of the traced line (`punti`), in cm — usually the
   * pergola's own width, but editable when the seller traced a different,
   * more precisely measurable reference instead. */
  @IsNumber()
  @Min(1)
  lineaLunghezzaCm!: number;

  @IsNumber()
  @Min(1)
  lRichiestaCm!: number;

  @IsNumber()
  @Min(1)
  pRichiestaCm!: number;

  @IsNumber()
  @Min(1)
  altezzaCm!: number;

  /**
   * Optional 3rd point, paired with `punti[0]` (the corner) as its own
   * start — a second, ideally perpendicular, control line (e.g. the
   * terrace's own side edge, perpendicular to the wall it's built against).
   * A single line gives exactly as many equations as unknowns, so any tap
   * imprecision lands entirely in the solved camera yaw — reads to a
   * seller as "the perspective looks subtly wrong on one side," not an
   * obvious error. This over-determines the system instead, letting the
   * resection average the error down rather than absorb it whole (~4.5x
   * lower mean yaw error under simulated tap noise, verified before wiring
   * this in — see pergolando-geocalib-service/resection.py). Both this and
   * `lineaControlloLunghezzaCm` are optional together — either both are
   * present or neither is used.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PuntoRiferimentoDto)
  puntoControllo?: PuntoRiferimentoDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lineaControlloLunghezzaCm?: number;
}
