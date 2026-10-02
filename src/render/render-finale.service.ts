import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { BundleService } from '../bundle/bundle.service.js';
import { DomainException } from '../common/domain-exception.js';
import { Scene3dService } from '../scene3d/scene3d.service.js';
import { RenderFinaleDto } from './dto/render-finale.dto.js';
import { buildCompositePrompt } from './prompt.js';
import type { RenderResult } from './render.service.js';

const MODEL = 'gemini-2.5-flash-image';

function inlineImagePart(dataUrlOrBase64: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrlOrBase64);
  if (match) {
    return { inlineData: { mimeType: match[1]!, data: match[2]! } };
  }
  return { inlineData: { mimeType: 'image/png', data: dataUrlOrBase64 } };
}

/**
 * Step 6 of the "compose on a real photo" pipeline: the final, lifestyle-
 * ready image — real site photo + the already-correctly-positioned grey
 * silhouette (steps 1-4) go in, a photorealistic composite comes out. See
 * buildCompositePrompt for the actual instructions given to Gemini; this
 * service is just the HTTP/Gemini plumbing, same pattern as RenderService.
 */
@Injectable()
export class RenderFinaleService {
  private readonly logger = new Logger(RenderFinaleService.name);

  constructor(
    private readonly bundleService: BundleService,
    private readonly scene3dService: Scene3dService,
  ) {}

  async renderFinale(input: RenderFinaleDto): Promise<RenderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new DomainException(
        'RENDER_NON_CONFIGURATO',
        'Il rendering fotorealistico non è configurato su questo deployment (GEMINI_API_KEY mancante).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const configurazione = this.bundleService.configura(input);
    const sottoModello =
      this.bundleService.getCatalog().sotto_modelli[input.sottoModello]!;
    const variante = sottoModello.varianti_montaggio[input.varianteMontaggio]!;

    const prompt = buildCompositePrompt(
      configurazione,
      input,
      sottoModello,
      variante,
    );
    const contents: Array<
      { text: string } | ReturnType<typeof inlineImagePart>
    > = [
      { text: prompt },
      inlineImagePart(input.fotoAmbienteBase64),
      inlineImagePart(input.fotoConSagomaBase64),
    ];

    // Clean isolated renders (no photo, no perspective distortion) of the
    // EXACT same model, from 3 different angles — gives Gemini unambiguous
    // visual ground truth for structural details. One angle alone wasn't
    // enough in practice: Gemini was inventing rear posts, wrong floor
    // brackets, and — the big one — a slatted "bioclimatic" roof instead of
    // the real flat telo, because that single angle didn't make "flat
    // continuous panel, no gaps" visually obvious. `laterale` (end-on
    // profile) and `dall_alto` (steep top-down) both make that unmistakable
    // in a way the default 3/4 angle doesn't. Best-effort per angle: if the
    // Blender service is unavailable, proceed with whatever succeeded
    // rather than failing the whole request over a nice-to-have.
    for (const viewPreset of ['isometrico', 'laterale', 'dall_alto'] as const) {
      try {
        const isolato = await this.scene3dService.render({
          lRichiestaCm: input.lRichiestaCm,
          pRichiestaCm: input.pRichiestaCm,
          altezzaCm: input.altezzaMontantiCm,
          deltaHCm: input.deltaHCm,
          fissaggio: 'parete',
          viewPreset,
        });
        contents.push(
          inlineImagePart(
            `data:${isolato.mimeType};base64,${isolato.imageBase64}`,
          ),
        );
      } catch (err) {
        this.logger.warn(
          { err, viewPreset },
          'isolated reference render unavailable, skipping it',
        );
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      // Low temperature: default sampling was letting the model drift
      // toward its own stylistic prior (bioclimatic slats, roller tubes,
      // string lights) instead of sticking to the reference geometry —
      // worth testing whether less "creative" sampling keeps it closer to
      // what's actually shown. Not yet confirmed to help, see 3d/NOTES.md.
      config: { temperature: 0.2, topP: 0.8 },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    );
    if (!imagePart?.inlineData?.data) {
      throw new DomainException(
        'RENDER_FALLITO',
        'Il motore di rendering non ha restituito nessuna immagine.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    };
  }
}
