import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../common/domain-exception.js';
import { CalcolaProspettivaDto } from './dto/calcola-prospettiva.dto.js';

export interface PuntoNormalizzato {
  xNorm: number;
  yNorm: number;
}

/**
 * Step 3 of the "compose on a real photo" pipeline: given the 2-point line
 * the seller traced on the site photo (the wall-floor junction, exactly
 * where the pergola will sit) plus that line's real length and the
 * pergola's real L/P/altezza, calls the isolated pergolando-geocalib-service
 * — GeoCalib (single-image camera calibration: focal length + gravity
 * direction, no manual reference lines) plus a 2-point resection for the
 * remaining position/yaw — and returns the resulting camera pose and the
 * roof plane's 4 corners reprojected onto the photo, for the frontend's
 * wireframe overlay.
 *
 * Kept as its own HTTP client (same pattern as Scene3dService) rather than
 * doing this math in Node: GeoCalib is a PyTorch model, has no business
 * inside this backend's own image. See pergolando-geocalib-service and
 * 3d/NOTES.md.
 */
@Injectable()
export class PerspectiveService {
  private readonly logger = new Logger(PerspectiveService.name);

  async analizzaFoto(fotoBase64: string): Promise<{
    lineeProspettiva?: (PuntoNormalizzato[] | null)[];
    punti: PuntoNormalizzato[];
    puntiProfondita: PuntoNormalizzato[];
    affidabilita: 'incerta' | 'da_confermare';
    messaggio: string;
  }> {
    const serviceUrl = process.env.GEOCALIB_SERVICE_URL;
    if (!serviceUrl) throw new DomainException('PROSPETTIVA_NON_CONFIGURATA', 'Analisi foto non disponibile.', HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const response = await fetch(new URL('/detect-references', serviceUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoBase64 }), signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error('analysis-failed');
      return await response.json() as Awaited<ReturnType<PerspectiveService['analizzaFoto']>>;
    } catch {
      throw new DomainException('ANALISI_FOTO_FALLITA', 'Analisi automatica non riuscita. Puoi segnare i riferimenti con il dito.', HttpStatus.BAD_GATEWAY);
    }
  }

  async calcolaProspettiva(dto: CalcolaProspettivaDto): Promise<{
    avviso?: string | null;
    tettoNormalizzato: PuntoNormalizzato[];
    posaCamera: {
      rvec: number[];
      tvec: number[];
      fovDeg: number;
      fxPx?: number; fyPx?: number; cxPx?: number; cyPx?: number;
      fotoLarghezzaPx: number;
      fotoAltezzaPx: number;
    };
  }> {
    const serviceUrl = process.env.GEOCALIB_SERVICE_URL;
    if (!serviceUrl) {
      throw new DomainException(
        'PROSPETTIVA_NON_CONFIGURATA',
        'Il calcolo della prospettiva non è configurato su questo deployment (GEOCALIB_SERVICE_URL mancante).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let response: Response;
    try {
      response = await fetch(new URL('/calibrate-placement', serviceUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fotoBase64: dto.fotoBase64,
          puntiFuga: dto.puntiFuga,
          altezzaRiferimentoCm: dto.altezzaRiferimentoCm,
          focaleEquivalente35Mm: dto.focaleEquivalente35Mm,
          puntiVerticali: dto.puntiVerticali,
          puntiProfondita: dto.puntiProfondita,
          altezzaVerticaleCm: dto.altezzaVerticaleCm,
          punti: dto.punti,
          lineaLunghezzaCm: dto.lineaLunghezzaCm,
          puntoControllo: dto.puntoControllo,
          lineaControlloLunghezzaCm: dto.lineaControlloLunghezzaCm,
          lRichiestaCm: dto.lRichiestaCm,
          pRichiestaCm: dto.pRichiestaCm,
          altezzaCm: dto.altezzaCm,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      this.logger.error({ err }, 'pergolando-geocalib-service unreachable');
      throw new DomainException(
        'PROSPETTIVA_FALLITA',
        'Il servizio di calcolo prospettiva non è raggiungibile. Riprova.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (response.status === 422 || response.status === 400) {
      const detail = await response.json() as { message?: string };
      this.logger.warn({ reason: detail.message }, 'Perspective calibration rejected');
      throw new DomainException(
        'PROSPETTIVA_NON_CALCOLABILE',
        detail.message ? `Calcolo prospettiva: ${detail.message}.` : 'Il calcolo della prospettiva non è riuscito: controlla i riferimenti.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!response.ok) {
      this.logger.error(
        { status: response.status },
        'pergolando-geocalib-service calibration failed',
      );
      throw new DomainException(
        'PROSPETTIVA_FALLITA',
        'Il calcolo della prospettiva non è riuscito. Riprova.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = (await response.json()) as {
      rvec: number[];
      tvec: number[];
      fovDeg: number;
      fxPx?: number; fyPx?: number; cxPx?: number; cyPx?: number;
      imageWidthPx: number;
      imageHeightPx: number;
    avviso?: string | null;
    tettoNormalizzato: PuntoNormalizzato[];
    };

    return {
      avviso: body.avviso ?? null,
      tettoNormalizzato: body.tettoNormalizzato,
      posaCamera: {
        rvec: body.rvec,
        tvec: body.tvec,
        fovDeg: body.fovDeg,
        fxPx: body.fxPx, fyPx: body.fyPx, cxPx: body.cxPx, cyPx: body.cyPx,
        fotoLarghezzaPx: body.imageWidthPx,
        fotoAltezzaPx: body.imageHeightPx,
      },
    };
  }
}


