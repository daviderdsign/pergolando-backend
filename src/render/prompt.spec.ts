import { describe, expect, it } from 'vitest';
import type { ConfigurazionePergola } from '@pergolando/shared/pricing-engine';
import type {
  SottoModello,
  VarianteMontaggio,
} from '@pergolando/shared/schema';
import { ConfiguraDto } from '../bundle/dto/configura.dto.js';
import { buildRenderPrompt } from './prompt.js';

const variante: VarianteMontaggio = {
  nome: 'Flag 2 guide',
  orientamento_crescita: 'L',
  fissaggio: 'A parete o a soffitto, con staffe in acciaio inox',
  L_max_per_n_moduli: { '1': 550 },
  detrazione_accoppiamento_eur: {},
  matrice_prezzi_ref: { standard: 'flag_2guide' },
};

const baseInput: ConfiguraDto = {
  sottoModello: 'Flag',
  varianteMontaggio: '2guide',
  pRichiestaCm: 300,
  lRichiestaCm: 300,
  coloreStruttura: 'RAL 9016 Bianco',
  colorePlastica: 'Bianco',
  altezzaMontantiCm: 250,
};

const sottoModello: SottoModello = {
  nome: 'Flag',
  descrizione_it: 'Copertura mobile in alluminio',
  vincoli_dimensionali: {
    L_max_modulo_cm: 600,
    P_min_cm: 200,
    P_max_cm: 400,
    H_max_cm: 300,
    passo_lama_cm: 10,
    moduli_max: 3,
  },
  opzioni_tecniche: { H20: { nome: 'H20', L_max_cm: 600 } },
  supplementi: { montante_h_soglia_cm: 250, montante_eur_per_m: 0 },
  varianti_montaggio: {},
  motore_incluso_nel_prezzo: true,
  opzioni_prezzo_fisso: {
    telis1io: { nome: 'Comando Telis 1 io', prezzo_eur: 150 },
  },
  accessori: {
    trave_laterale: {
      nome: 'Trave Laterale',
      indicizzato_per: 'sporgenza',
      prezzi: {},
    },
  },
};

const configurazione: ConfigurazionePergola = {
  prodotto: 'Flag',
  sotto_modello: 'Flag',
  variante_montaggio: '2guide',
  opzione_tecnica: 'H20',
  P_richiesta_cm: 300,
  L_richiesta_cm: 300,
  orientamento_crescita: 'L',
  n_moduli: 1,
  L_modulo_cm: 300,
  P_modulo_cm: 310,
  L_totale_effettiva_cm: 300,
  P_totale_effettiva_cm: 310,
  n_lame: 10,
  colore_struttura: 'RAL 9016 Bianco',
  colore_plastica: 'Bianco',
  altezza_montanti_cm: 250,
  voci_costo: [],
  avvisi: [],
  prezzo_totale_eur: 4986,
};

describe('buildRenderPrompt', () => {
  it('includes product name, resolved dimensions, colors, comando and accessori names', () => {
    const prompt = buildRenderPrompt(
      configurazione,
      {
        ...baseInput,
        opzioniPrezzoFisso: ['telis1io'],
        accessoriSelezionati: ['trave_laterale'],
      },
      sottoModello,
      variante,
    );

    expect(prompt).toContain('Flag');
    expect(prompt).toContain('300 cm');
    expect(prompt).toContain('310 cm');
    expect(prompt).toContain('RAL 9016 Bianco');
    expect(prompt).toContain('Comando Telis 1 io');
    expect(prompt).toContain('Trave Laterale');
    expect(prompt).toContain('sfondo bianco');
    expect(prompt).toContain("dall'alto");
  });

  it('states the exact width:depth ratio so a square input cannot come back rectangular', () => {
    const prompt = buildRenderPrompt(
      configurazione,
      baseInput,
      sottoModello,
      variante,
    );

    expect(prompt).toContain('300:310');
  });

  it('describes the real construction (guides along sporgenza, sliding bars ON TOP of the fabric, fissaggio text, plastic carrello support)', () => {
    const prompt = buildRenderPrompt(
      configurazione,
      baseInput,
      sottoModello,
      variante,
    );

    expect(prompt).toContain('SPORGENZA');
    expect(prompt).toContain('SOPRA il telo');
    expect(prompt).toContain(variante.fissaggio);
    expect(prompt).toContain('supporto/carrello in plastica');
  });

  it('omits comando/accessori lines entirely when none were selected', () => {
    const prompt = buildRenderPrompt(
      configurazione,
      baseInput,
      sottoModello,
      variante,
    );

    expect(prompt).not.toContain('Comando installato');
    expect(prompt).not.toContain('Accessori installati');
  });

  it('drops an opzioniPrezzoFisso/accessoriSelezionati key that no longer exists on the sotto-modello instead of throwing', () => {
    const prompt = buildRenderPrompt(
      configurazione,
      { ...baseInput, opzioniPrezzoFisso: ['chiave_inesistente'] },
      sottoModello,
      variante,
    );

    expect(prompt).not.toContain('Comando installato');
  });
});
