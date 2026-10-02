import { IsNumber, IsString, Min } from 'class-validator';
import { ConfiguraDto } from '../../bundle/dto/configura.dto.js';

/**
 * Step 6 of the "compose on a real photo" pipeline: same configuration
 * shape as POST catalog/configura/render (the exact product being priced),
 * plus the 2 images Gemini needs to composite — the real site photo and
 * the flat-grey, precisely positioned silhouette render from step 4. See
 * buildCompositePrompt for why both are needed.
 */
export class RenderFinaleDto extends ConfiguraDto {
  /** The real site photo, unmodified (data URL or raw base64). */
  @IsString()
  fotoAmbienteBase64!: string;

  /** The SAME photo with the step 4 render (flat grey silhouette) already
   * flattened on top of it, pixel-for-pixel in position (canvas-composited
   * client-side — see wizard/page.tsx) — this is what tells Gemini exactly
   * where/how big/at what angle to draw the real pergola. */
  @IsString()
  fotoConSagomaBase64!: string;

  /** Same field POST catalog/render3d takes — needed here too since
   * RenderFinaleService calls Scene3dService itself for a second, clean
   * isolated reference render (no photo, no perspective) alongside the
   * photo-matched one: real feedback was that the photo-matched silhouette
   * alone wasn't a strong enough visual anchor, and Gemini was inventing
   * structural details (extra rear posts, wrong floor brackets) instead of
   * strictly reproducing the real model. */
  @IsNumber()
  @Min(1)
  deltaHCm!: number;
}
