import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { BundleService } from '../bundle/bundle.service.js';
import { DomainException } from '../common/domain-exception.js';
import { Scene3dService } from '../scene3d/scene3d.service.js';
import { furniturePrompt } from './furniture-prompt.js';
import { RenderMaskDto } from './dto/render-mask.dto.js';
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

  async renderMask(input:RenderMaskDto):Promise<RenderResult>{
    const apiKey=process.env.GEMINI_API_KEY;
    if(!apiKey)throw new DomainException('RENDER_NON_CONFIGURATO','Nano Banana non configurato: inserisci GEMINI_API_KEY nel backend.env del NAS.',HttpStatus.SERVICE_UNAVAILABLE);
    const prompt=`IMMAGINE 1: foto reale con la pergola definitiva renderizzata da Blender. IMMAGINE 2: maschera perfettamente allineata, struttura bianca piena e resto nero. La maschera è solo una guida, non deve comparire nel risultato.
NON TOCCARE ASSOLUTAMENTE LE FORME ESISTENTI!!! Mantieni esattamente posizione, prospettiva, dimensioni, numero e sezione dei montanti, travi, guide, copertura, dettagli e collegamenti della pergola. Non aggiungere né eliminare elementi!!! NON INSERIRE ASSOLUTAMENTE PIASTRE, FLANGE, STAFFE O BASAMENTI CHE COLLEGANO I MONTANTI VERTICALI AL PAVIMENTO!!! Non creare piastre ai piedi dei montanti: mantieni esattamente il collegamento a terra visibile nell’immagine originale!!!
Solo all'interno della superficie bianca della maschera modifica il colore e la resa del materiale della pergola: ${input.color}, alluminio verniciato. Anche se il colore è già corretto, migliora solamente la resa di quel colore, senza cambiare le forme!!!
Migliora luci e ombre di contatto a terra e sul muro coerenti con la foto. Fuori dalla struttura, sotto la pergola: ${furniturePrompt(input.environment,input.widthCm,input.depthCm)} Tutti gli elementi devono avere scala e prospettiva realistiche. Non coprire inutilmente i montanti. Non modificare edificio, insegne, testi, cielo o inquadratura. NON TOCCARE ASSOLUTAMENTE LA FORMA DELLA PERGOLA!!! Restituisci una sola fotografia ambientata.`;
    try{
      const ai=new GoogleGenAI({apiKey});
      const response=await ai.models.generateContent({model:'gemini-3-pro-image-preview',contents:[{text:prompt},inlineImagePart(input.image),inlineImagePart(input.mask)],config:{temperature:0.2,responseModalities:['TEXT','IMAGE'],httpOptions:{timeout:180000}}});
      const part=response.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.mimeType?.startsWith('image/'));
      if(!part?.inlineData?.data)throw new Error('no-image');
      return {imageBase64:part.inlineData.data,mimeType:part.inlineData.mimeType||'image/png'};
    }catch(err){this.logger.warn({error:err instanceof Error?err.name:'unknown',status:(err as {status?:number}).status,code:(err as {code?:string}).code,causeCode:(err as {cause?:{code?:string}}).cause?.code},'Masked image generation failed');throw new DomainException('RENDER_FALLITO','Nano Banana non ha completato l’immagine. Il rendering Blender originale resta disponibile.',HttpStatus.BAD_GATEWAY);}
  }

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
          // Same variant the seller actually picked (2guide/3guide/4guide)
          // — these reference views exist to show Gemini the real model, so
          // they need to show the real guide count too, not silently
          // default to 2 regardless of what was configured.
          varianteMontaggio: input.varianteMontaggio,
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
    const generate = () =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        // Low temperature: default sampling was letting the model drift
        // toward its own stylistic prior (bioclimatic slats, roller tubes,
        // string lights) instead of sticking to the reference geometry —
        // worth testing whether less "creative" sampling keeps it closer to
        // what's actually shown. Not yet confirmed to help, see 3d/NOTES.md.
        config: { temperature: 0.2, topP: 0.8 },
      });

    let response = await generate();
    let imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    );

    // finishReason "IMAGE_OTHER" (confirmed live, 2026-10-04): Gemini's
    // image generation can fail with no safety block and no promptFeedback
    // at all — just an empty result, for no caller-visible reason. One
    // retry with the identical request has cleared it in practice, so it's
    // worth trying before actually failing the whole step.
    if (!imagePart?.inlineData?.data) {
      this.logger.warn(
        { finishReason: response.candidates?.[0]?.finishReason },
        'render-finale: Gemini returned no image, retrying once',
      );
      response = await generate();
      imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData,
      );
    }

    if (!imagePart?.inlineData?.data) {
      this.logger.error(
        { finishReason: response.candidates?.[0]?.finishReason },
        'render-finale: Gemini returned no image on retry either',
      );
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
