import { HttpStatus, Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import type { AssetManifestEntry } from '@pergolando/shared/schema';
import { BundleService } from '../bundle/bundle.service.js';
import { ConfiguraDto } from '../bundle/dto/configura.dto.js';
import { DomainException } from '../common/domain-exception.js';
import { buildRenderPrompt } from './prompt.js';

export interface RenderResult {
  imageBase64: string;
  mimeType: string;
}

const MODEL = 'gemini-2.5-flash-image';

/**
 * Slice 1 of the rendering engine: an isolated, photorealistic, top-down
 * product shot on a pure white background — see the plan for why (no scene
 * compositing yet, that's a later PRD phase). Reuses BundleService#configura
 * for the resolved dimensions/colors instead of re-deriving them, and reads
 * reference images straight from the already-loaded bundle's assets/.
 */
@Injectable()
export class RenderService {
  constructor(private readonly bundleService: BundleService) {}

  async render(input: ConfiguraDto): Promise<RenderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new DomainException(
        'RENDER_NON_CONFIGURATO',
        'Il rendering fotorealistico non è configurato su questo deployment (GEMINI_API_KEY mancante).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Throws DomainException(CONFIGURAZIONE_NON_VALIDA) for an unknown
    // sottoModello/variante/etc — so by the time we reach the lookup below,
    // input.sottoModello is guaranteed to be a real key.
    const configurazione = this.bundleService.configura(input);
    const sottoModello =
      this.bundleService.getCatalog().sotto_modelli[input.sottoModello]!;
    const variante = sottoModello.varianti_montaggio[input.varianteMontaggio]!;

    const referenceAssets = this.selectReferenceAssets(input.sottoModello);
    if (referenceAssets.length === 0) {
      throw new DomainException(
        'NESSUNA_IMMAGINE_RIFERIMENTO',
        `Nessuna immagine di riferimento caricata in Studio per "${input.sottoModello}" — carica almeno una foto o rendering prima di generare.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const referenceParts = await Promise.all(
      referenceAssets.map(async (asset) => ({
        inlineData: {
          mimeType: mimeTypeFor(asset.path),
          data: (
            await readFile(this.bundleService.getAssetFilePath(asset.path))
          ).toString('base64'),
        },
      })),
    );

    const prompt = buildRenderPrompt(
      configurazione,
      input,
      sottoModello,
      variante,
    );
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ text: prompt }, ...referenceParts],
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

  /**
   * Prefers assets explicitly tagged for this sotto-modello; falls back to
   * every asset in the bundle when none are tagged (today's Studio tagging
   * is free-text/optional, so an untagged catalog would otherwise get zero
   * references even if photos exist — see the plan's "flagged" section).
   */
  private selectReferenceAssets(sottoModelloKey: string): AssetManifestEntry[] {
    const assets = this.bundleService.getAssets();
    const tagged = assets.filter(
      (asset) => asset.sotto_modello === sottoModelloKey,
    );
    return tagged.length > 0 ? tagged : assets;
  }
}

function mimeTypeFor(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
