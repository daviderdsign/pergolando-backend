import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BundleService } from '../bundle/bundle.service.js';
import { ConfiguraDto } from '../bundle/dto/configura.dto.js';
import { RenderService } from './render.service.js';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  }),
}));

const FIXTURE_DIR = join(process.cwd(), 'test', 'fixtures', 'bundle');

// Same known-good input already used by bundle.service.spec.ts (prezzo 9290).
const INPUT: ConfiguraDto = {
  sottoModello: 'P',
  varianteMontaggio: '01L',
  pRichiestaCm: 300,
  lRichiestaCm: 200,
  coloreStruttura: 'RAL 9016 Bianco sablé',
  colorePlastica: 'Bianco',
  altezzaMontantiCm: 200,
  opzioneTecnica: 'H20',
};

async function withOneTaggedReferenceImage(dir: string) {
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(
    join(dir, 'assets', 'p.jpg'),
    Buffer.from('fake-image-bytes'),
  );
  await writeFile(
    join(dir, 'assets', 'manifest.json'),
    JSON.stringify([
      { path: 'assets/p.jpg', tipo: 'foto', sotto_modello: 'P' },
    ]),
  );
}

describe('RenderService', () => {
  let dir: string;
  const originalBundlePath = process.env.BUNDLE_PATH;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pergolando-render-'));
    await cp(FIXTURE_DIR, dir, { recursive: true });
    generateContentMock.mockReset();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    process.env.BUNDLE_PATH = originalBundlePath;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  async function loadRenderService(): Promise<RenderService> {
    process.env.BUNDLE_PATH = dir;
    const bundleService = new BundleService();
    await bundleService.onModuleInit();
    return new RenderService(bundleService);
  }

  it('errors with RENDER_NON_CONFIGURATO when GEMINI_API_KEY is unset', async () => {
    delete process.env.GEMINI_API_KEY;
    const render = await loadRenderService();

    await expect(render.render(INPUT)).rejects.toMatchObject({
      code: 'RENDER_NON_CONFIGURATO',
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('errors with NESSUNA_IMMAGINE_RIFERIMENTO when the bundle has no assets at all', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const render = await loadRenderService();

    await expect(render.render(INPUT)).rejects.toMatchObject({
      code: 'NESSUNA_IMMAGINE_RIFERIMENTO',
    });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('sends the prompt and the tagged reference image to Gemini, returning the generated image', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    await withOneTaggedReferenceImage(dir);
    const render = await loadRenderService();

    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } },
            ],
          },
        },
      ],
    });

    const result = await render.render(INPUT);

    expect(result).toEqual({ imageBase64: 'aW1hZ2U=', mimeType: 'image/png' });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const call = generateContentMock.mock.calls[0]![0];
    expect(call.model).toBe('gemini-2.5-flash-image');
    expect(call.contents[0].text).toContain('sfondo bianco');
    expect(call.contents[1].inlineData.mimeType).toBe('image/jpeg');
  });

  it('errors with RENDER_FALLITO when Gemini returns no image part', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    await withOneTaggedReferenceImage(dir);
    const render = await loadRenderService();

    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'sorry, no image' }] } }],
    });

    await expect(render.render(INPUT)).rejects.toMatchObject({
      code: 'RENDER_FALLITO',
    });
  });
});
