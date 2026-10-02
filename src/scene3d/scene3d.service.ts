import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../common/domain-exception.js';
import { RenderScene3dDto } from './dto/render-scene3d.dto.js';

const BLENDER_TIMEOUT_MS = 90_000;

export interface Scene3dResult {
  imageBase64: string;
  mimeType: string;
}

/**
 * Step 4 of the "compose on a real photo" pipeline: calls the isolated
 * `pergolando-blender-service` (its own container — see that repo's README
 * and 3d/NOTES.md), which runs `3d/generate_flag.py` against `3d/flag.blend`
 * in Blender's `--background` mode and returns the render.
 *
 * Blender itself never touches this container — it's kept in its own
 * ~300MB image on purpose so the main backend image stays lean (see
 * CHANGELOG.md, Fase G). This service is just an HTTP client of it.
 *
 * Optional feature: like RenderService's GEMINI_API_KEY, this only works
 * when BLENDER_SERVICE_URL is configured — responds 503 otherwise rather
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
        'Il rendering 3D non è configurato su questo deployment (BLENDER_SERVICE_URL mancante).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const config = {
      L_cm: dto.lRichiestaCm,
      P_cm: dto.pRichiestaCm,
      H_cm: dto.altezzaCm,
      deltaH_cm: dto.deltaHCm,
      fissaggio: dto.fissaggio,
      ...(dto.viewPreset && { viewPreset: dto.viewPreset }),
      ...(dto.camera && {
        camera: {
          rvec: dto.camera.rvec,
          tvec: dto.camera.tvec,
          fovDeg: dto.camera.fovDeg,
          imageWidthPx: dto.camera.fotoLarghezzaPx,
          imageHeightPx: dto.camera.fotoAltezzaPx,
        },
      }),
    };

    let response: Response;
    try {
      response = await fetch(new URL('/render3d', serviceUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(BLENDER_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error({ err }, 'pergolando-blender-service unreachable');
      throw new DomainException(
        'RENDER_3D_FALLITO',
        'Il servizio di rendering 3D non è raggiungibile. Riprova.',
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
        'Il rendering 3D non è riuscito. Riprova.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = (await response.json()) as Scene3dResult;
    return body;
  }
}
