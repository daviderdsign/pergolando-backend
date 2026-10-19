import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * The camera pose solved in step 3 (POST catalog/perspective) â€” reused
 * as-is here rather than re-running solvePnP, since it was already computed
 * from the exact same tapped points.
 */
export class PosaCameraDto {
  @IsOptional() @IsNumber() @Min(1) fxPx?: number;
  @IsOptional() @IsNumber() @Min(1) fyPx?: number;
  @IsOptional() @IsNumber() cxPx?: number;
  @IsOptional() @IsNumber() cyPx?: number;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  rvec!: number[];

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  tvec!: number[];

  @IsNumber()
  fovDeg!: number;

  @IsInt()
  @Min(1)
  fotoLarghezzaPx!: number;

  @IsInt()
  @Min(1)
  fotoAltezzaPx!: number;
}

/**
 * Step 4 of the "compose on a real photo" pipeline: render the real
 * parametric 3D model (3d/flag.blend, via 3d/generate_flag.py) with the
 * pergola's real dimensions, in the camera pose solved in step 3 â€” an
 * isolated, transparent-background PNG the frontend can overlay directly on
 * the site photo.
 */
export class RenderScene3dDto {
  @IsOptional()
  @IsBoolean()
  technicalViews?: boolean;
  @IsOptional()
  @IsIn(['arquati', 'pratic'])
  catalogo?: string;

  @IsOptional()
  @IsIn(["chiuse", "aperte", "impacchettate"])
  statoLamelle?: string;

  @IsOptional()
  @IsIn(["H20", "H30"])
  opzioneTecnica?: string;

  @IsOptional()
  @IsInt()
  @IsIn([1])
  nModuli?: number;

  @IsNumber()
  @Min(1)
  lRichiestaCm!: number;

  @IsNumber()
  @Min(1)
  pRichiestaCm!: number;

  /** The vendor's own "H" (wall/rear height â€” see the wizard field, labeled
   * literally "Altezza a parete H"), NOT the front height despite the name
   * similarity to generate_flag.py's own H_cm param, which means FRONT
   * height there (vendor's "P" â€” see that script's own docstring). Real
   * front height = altezzaCm - deltaHCm (vendor's H1) â€” Scene3dService does
   * that subtraction before calling the Blender service. Mixing these two
   * up is a real bug that shipped once already (2026-10-04, caught live:
   * entering H=300/H1=80 rendered the FRONT at 300cm instead of the
   * correct 220cm, because this value was being forwarded to H_cm as-is). */
  @IsNumber()
  @Min(1)
  altezzaCm!: number;

  @IsNumber()
  @Min(0)
  deltaHCm!: number;

  @IsIn(['autoportante', 'parete'])
  fissaggio!: 'autoportante' | 'parete';

  @IsOptional()
  @ValidateNested()
  @Type(() => PosaCameraDto)
  camera?: PosaCameraDto;

  /** Only meaningful without `camera` (the isolated debug-orbit render,
   * not the photo-matched one) â€” which fixed angle to use. See
   * 3d/generate_flag.py's `offsets` dict for the actual presets. */
  @IsOptional()
  @IsIn(['isometrico', 'laterale', 'dall_alto'])
  viewPreset?: 'isometrico' | 'laterale' | 'dall_alto';

  /** Raw catalog color strings as the wizard already has them (e.g. "RAL
   * 9016 Bianco", "Bianco 9016") â€” resolved to real RGB by Scene3dService
   * (see its RAL_COLORS table) so the preview actually shows the colors the
   * seller picked, instead of the flat grey debug material it used before
   * (2026-10-03). Both optional: omit to keep the plain grey silhouette,
   * e.g. for render-finale's reference views, which intentionally stay
   * neutral (Gemini gets color via the text prompt instead). */
  @IsOptional()
  @IsString()
  coloreStruttura?: string;

  @IsOptional()
  @IsString()
  colorePlastica?: string;

  /** Catalog variant key as the wizard already has it ("2guide", "3guide",
   * "4guide" â€” see apps/studio/storage/bundles/Flag/*\/catalog/database.json,
   * sotto_modelli.flag.varianti_montaggio): resolved to a guide count by
   * Scene3dService so the preview actually matches how many rail tracks
   * the seller picked, instead of always defaulting to 2 (2026-10-03 bug:
   * selecting "Flag 3 guide" rendered the plain 2-guide geometry â€” nothing
   * forwarded the selection to the 3D model at all). Omit to let
   * generate_flag.py derive it from lRichiestaCm instead. */
  @IsOptional()
  @IsString()
  varianteMontaggio?: string;

  /** Pure visual nudge (world-space cm) of the whole rendered pergola in
   * THIS render only â€” never the real quote dimensions. Added 2026-10-04
   * so a seller can fine-tune a render's on-photo fit (small calibration
   * mismatches) without that correction ever reaching the price
   * configurator: the wizard keeps these in separate client-side state,
   * not the form fields that feed POST catalog/configura. offsetXCm:
   * positive = right. offsetZCm: positive = away from the wall (deeper).
   * Height isn't offered this way on purpose â€” "lower it" means sending a
   * smaller altezzaCm instead, so every leg still reaches exactly to the
   * real ground. See generate_flag.py's apply_visual_offset. */
  @IsOptional()
  @IsNumber()
  offsetXCm?: number;

  @IsOptional()
  @IsNumber()
  offsetZCm?: number;
}
