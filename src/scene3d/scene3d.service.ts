import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../common/domain-exception.js';
import { RenderScene3dDto } from './dto/render-scene3d.dto.js';

const BLENDER_TIMEOUT_MS = 90_000;

export interface Scene3dResult {
  imageBase64: string;
  shadowBase64?: string;
  mimeType: string;
}

type Rgb = [number, number, number];

/**
 * RAL code -> approximate sRGB (0-1), just the colors that actually appear
 * in this bundle's own catalog (apps/studio/storage/bundles/Flag, any
 * version, catalog/database.json, prodotto.colori) â€” not a full RAL chart.
 * "Antracite" has no RAL code in the catalog string itself, matched by name
 * instead (RAL 7016, the conventional "anthracite grey"). Anything
 * unmatched (e.g. "Altri colori RAL a richiesta") falls back to a neutral
 * mid-grey rather than guessing (2026-10-03).
 */
const RAL_COLORS: Record<string, Rgb> = {
  '9016': [0.95, 0.95, 0.93], // Bianco traffico
  '8017': [0.271, 0.196, 0.173], // Marrone cioccolato
  '7016': [0.216, 0.247, 0.263], // Antracite
  '9006': [0.65, 0.65, 0.64],
  '9010': [0.94, 0.93, 0.88],
  '1013': [0.918, 0.902, 0.792], // Avorio
};
const FALLBACK_RGB: Rgb = [0.6, 0.6, 0.6];

function colorStringToRgb(label: string | undefined): Rgb | null {
  if (!label) return null;
  const ralMatch = label.match(/\b(\d{4})\b/);
  if (ralMatch && RAL_COLORS[ralMatch[1]!]) {
    return RAL_COLORS[ralMatch[1]!]!;
  }
  if (/antracite|anthracite/i.test(label)) {
    return RAL_COLORS['7016']!;
  }
  if (/ferro/i.test(label)) return [0.28, 0.29, 0.29];
  if (/corten/i.test(label)) return [0.43, 0.24, 0.16];
  return FALLBACK_RGB;
}

/**
 * "2guide"/"3guide"/"4guide" -> 2/3/4, straight from the catalog's own
 * varianti_montaggio keys (apps/studio/storage/bundles/Flag/*\/catalog/
 * database.json) â€” no separate lookup table needed, the key already IS the
 * guide count. Returns undefined (not a default) when missing/unrecognized
 * so the caller can tell "not provided" apart from "explicitly 2", and let
 * generate_flag.py fall back to deriving it from L_cm itself instead
 * (2026-10-03: see derive_n_guide_from_l in that script).
 */
function varianteMontaggioToNGuide(
  variante: string | undefined,
): number | null {
  if (!variante) return null;
  const match = variante.match(/^(\d+)guide$/i);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Step 4 of the "compose on a real photo" pipeline: calls the isolated
 * `pergolando-blender-service` (its own container â€” see that repo's README
 * and 3d/NOTES.md), which runs `3d/generate_flag.py` against `3d/flag.blend`
 * in Blender's `--background` mode and returns the render.
 *
 * Blender itself never touches this container â€” it's kept in its own
 * ~300MB image on purpose so the main backend image stays lean (see
 * CHANGELOG.md, Fase G). This service is just an HTTP client of it.
 *
 * Optional feature: like RenderService's GEMINI_API_KEY, this only works
 * when BLENDER_SERVICE_URL is configured â€” responds 503 otherwise rather
 * than blocking backend startup on it.
 */
@Injectable()
export class Scene3dService {
  private readonly logger = new Logger(Scene3dService.name);

  async render(dto: RenderScene3dDto): Promise<Scene3dResult> {
    const serviceUrl = process.env.BLENDER_SERVICE_URL;
    if (!serviceUrl) {
      throw new DomainException(
        'RENDER_3D_NON_CONFIGURATO',
        'Il rendering 3D non Ã¨ configurato su questo deployment (BLENDER_SERVICE_URL mancante).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Real colors instead of the flat grey debug material, when the caller
    // gives us catalog color strings (the wizard's own photo-overlay preview
    // does; render-finale's isolated reference views for Gemini don't â€” see
    // the DTO doc). `includeBackdrop: false` always here: this render gets
    // composited onto the seller's own real photo, so a synthetic
    // floor/wall would only get in the way (that backdrop exists for the
    // standalone documentation shot instead, see 3d/NOTES.md).
    const colorRgb = colorStringToRgb(dto.coloreStruttura);
    const frangitrattaRgb = colorStringToRgb(dto.colorePlastica);
    const nGuide = varianteMontaggioToNGuide(dto.varianteMontaggio);

    const config = {
      includeShadows: !!dto.camera && !dto.technicalViews,
      technicalViews: dto.technicalViews ?? false,
      catalogo: dto.catalogo ?? "arquati",
      statoLamelle: dto.statoLamelle ?? "chiuse",
      nModuli: dto.nModuli ?? 1,
      opzioneTecnica: dto.opzioneTecnica ?? "H20",
      L_cm: dto.lRichiestaCm,
      P_cm: dto.pRichiestaCm,
      // dto.altezzaCm is the vendor's "H" (wall height, see the DTO's own
      // doc) â€” generate_flag.py's H_cm means the FRONT height instead
      // (vendor's "P" = H - H1). Caught live 2026-10-04: without this
      // subtraction the front rendered at the full wall height (300cm)
      // instead of the real 220cm for H=300/H1=80.
      H_cm: dto.catalogo === 'pratic' ? dto.altezzaCm : dto.altezzaCm - dto.deltaHCm,
      deltaH_cm: dto.deltaHCm,
      fissaggio: dto.fissaggio,
      ...(nGuide !== null && { nGuide }),
      ...(dto.viewPreset && { viewPreset: dto.viewPreset }),
      ...(dto.offsetXCm !== undefined && { offsetXCm: dto.offsetXCm }),
      ...(dto.offsetZCm !== undefined && { offsetZCm: dto.offsetZCm }),
      ...(dto.camera && {
        camera: {
          rvec: dto.camera.rvec,
          tvec: dto.camera.tvec,
          fovDeg: dto.camera.fovDeg,
          fxPx: dto.camera.fxPx, fyPx: dto.camera.fyPx, cxPx: dto.camera.cxPx, cyPx: dto.camera.cyPx,
          imageWidthPx: dto.camera.fotoLarghezzaPx,
          imageHeightPx: dto.camera.fotoAltezzaPx,
        },
      }),
      ...(colorRgb && {
        outputMode: 'colored',
        colorRgb,
        includeBackdrop: false,
        ...(frangitrattaRgb && { frangitrattaRgb }),
      }),
    };

    let response: Response;
    try {
      response = await fetch(new URL('/render3d', serviceUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(dto.technicalViews ? 180_000 : BLENDER_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error({ err }, 'pergolando-blender-service unreachable');
      throw new DomainException(
        'RENDER_3D_FALLITO',
        'Il servizio di rendering 3D non Ã¨ raggiungibile. Riprova.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      this.logger.error(
        { status: response.status },
        'pergolando-blender-service render failed',
      );
      throw new DomainException(
        'RENDER_3D_FALLITO',
        'Il rendering 3D non Ã¨ riuscito. Riprova.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = (await response.json()) as Scene3dResult;
    return body;
  }
}
