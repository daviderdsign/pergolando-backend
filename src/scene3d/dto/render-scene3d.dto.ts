import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * The camera pose solved in step 3 (POST catalog/perspective) — reused
 * as-is here rather than re-running solvePnP, since it was already computed
 * from the exact same tapped points.
 */
export class PosaCameraDto {
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
 * pergola's real dimensions, in the camera pose solved in step 3 — an
 * isolated, transparent-background PNG the frontend can overlay directly on
 * the site photo.
 */
export class RenderScene3dDto {
  @IsNumber()
  @Min(1)
  lRichiestaCm!: number;

  @IsNumber()
  @Min(1)
  pRichiestaCm!: number;

  @IsNumber()
  @Min(1)
  altezzaCm!: number;

  @IsNumber()
  @Min(1)
  deltaHCm!: number;

  @IsIn(['autoportante', 'parete'])
  fissaggio!: 'autoportante' | 'parete';

  @IsOptional()
  @ValidateNested()
  @Type(() => PosaCameraDto)
  camera?: PosaCameraDto;

  /** Only meaningful without `camera` (the isolated debug-orbit render,
   * not the photo-matched one) — which fixed angle to use. See
   * 3d/generate_flag.py's `offsets` dict for the actual presets. */
  @IsOptional()
  @IsIn(['isometrico', 'laterale', 'dall_alto'])
  viewPreset?: 'isometrico' | 'laterale' | 'dall_alto';
}
