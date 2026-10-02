import type { ConfigurazionePergola } from '@pergolando/shared/pricing-engine';
import type {
  SottoModello,
  VarianteMontaggio,
} from '@pergolando/shared/schema';
import { ConfiguraDto } from '../bundle/dto/configura.dto.js';

/**
 * Builds the text prompt sent to Gemini alongside the reference images.
 * Pure function (no I/O) so it's cheap to unit test against a known
 * configuration — see prompt.spec.ts.
 *
 * `input.accessoriSelezionati` / `opzioniPrezzoFisso` carry the raw keys the
 * seller picked; ConfigurazionePergola doesn't include them (only their
 * priced voci_costo, as free text), so they're resolved back to display
 * names here via the sottoModello's own accessori/opzioni_prezzo_fisso maps
 * — the same lookup the wizard frontend already does to render the labels.
 *
 * The structural checklist below exists because relying on the reference
 * photos alone wasn't producing a structurally accurate product — Gemini
 * needs the construction spelled out in words too. Refined over several
 * rounds against Davide's own description of how a Flag pergola is built
 * and close study of the reference photos (not guessed):
 *  - sliding bars sit ON TOP of the fabric (an earlier version of this
 *    prompt said "underneath" — wrong, corrected after Davide sent a
 *    reference photo showing them clearly on top, with the fabric+bars
 *    bunching together at the retracted edge)
 *  - guides are visible raised rails along the two sporgenza-direction
 *    edges, not just an implicit frame border
 *  - posts have small drainage openings near the base
 *  - a soft grey background with natural cast shadows is fine — it does
 *    NOT need to be pure shadowless white
 */
/**
 * The construction checklist shared by both the isolated product shot
 * (buildRenderPrompt) and the real-photo composite (buildCompositePrompt)
 * — the exact same product, so the exact same facts about how it's built.
 * See the module docstring above for why this is spelled out in words
 * rather than left to the reference photos alone.
 */
function structuralChecklist(
  configurazione: ConfigurazionePergola,
  input: ConfiguraDto,
  sottoModello: SottoModello,
  variante: VarianteMontaggio,
): string[] {
  const nomiComandi = (input.opzioniPrezzoFisso ?? [])
    .map((key) => sottoModello.opzioni_prezzo_fisso?.[key]?.nome)
    .filter((nome): nome is string => Boolean(nome));

  const nomiAccessori = (input.accessoriSelezionati ?? [])
    .map((key) => sottoModello.accessori?.[key]?.nome)
    .filter((nome): nome is string => Boolean(nome));

  const L = configurazione.L_totale_effettiva_cm;
  const P = configurazione.P_totale_effettiva_cm;

  const righe = [
    `Prodotto: ${sottoModello.nome}${sottoModello.descrizione_it ? ` — ${sottoModello.descrizione_it}` : ''}. NON è una pergola bioclimatica: non ha lamelle orientabili, non si apre, non ha alcun meccanismo di rotazione o avvolgimento motorizzato visibile dall'esterno. È una pergola a telo retrattile con copertura in tessuto tecnico impermeabile, fissa nella forma.`,
    `Dimensioni richieste dal cliente: larghezza ${L} cm, sporgenza ${P} cm (rapporto larghezza:sporgenza = ${L}:${P} — rispetta ESATTAMENTE queste proporzioni, non generare una forma diversa), altezza montanti ${configurazione.altezza_montanti_cm} cm, ${configurazione.n_moduli} modulo/i.`,
    `Colore struttura: ${configurazione.colore_struttura}. Colore parti plastiche: ${configurazione.colore_plastica}.`,
  ];

  if (nomiComandi.length > 0) {
    righe.push(`Comando installato: ${nomiComandi.join(', ')}.`);
  }
  if (nomiAccessori.length > 0) {
    righe.push(`Accessori installati: ${nomiAccessori.join(', ')}.`);
  }

  righe.push(
    'Struttura costruttiva da rispettare fedelmente (leggi con attenzione, non affidarti solo alle immagini di riferimento):',
    '- Le guide laterali corrono in direzione della SPORGENZA (dal lato di fissaggio verso il bordo anteriore), NON in direzione della larghezza. Sono rotaie in rilievo, chiaramente visibili lungo i due bordi laterali — non un semplice bordo piatto del telaio.',
    "- Il telo è UNA SOLA superficie continua e sigillata, senza fessure, senza spazi, senza elementi separati apribili: guardata dall'alto o di lato deve apparire come un unico piano ininterrotto, mai come una serie di listelli/lamelle separate da linee scure. Le sottili nervature visibili nelle immagini di riferimento sono solchi decorativi di pochi millimetri sulla STESSA superficie continua — non generare ombre nette o gap tra una nervatura e l'altra, quello è un errore.",
    '- Il telo è trascinato da barre di scorrimento trasversali, visibili SOPRA il telo (non nascoste sotto), perpendicolari alle guide e parallele al bordo anteriore, distanziate di circa 70 cm quando il telo è completamente esteso. Quando il telo si retrae verso il lato di fissaggio, barre e telo si accumulano insieme in un pacco compatto vicino al bordo di fissaggio.',
    '- Il bordo anteriore è una trave FISSA dal profilo arrotondato ma sottile (pochi cm di diametro apparente), dello stesso colore della struttura — NON un tubo, rullo, tamburo o cassonetto cilindrico che corre lungo tutta la larghezza: non esiste alcun meccanismo di avvolgimento visibile sul bordo anteriore. Lungo la trave, in corrispondenza di ogni barra di scorrimento, è presente un supporto/carrello in plastica dalla forma arrotondata riconoscibile, distinto dal profilo della trave stessa — questi piccoli carrelli non vanno confusi con un rullo continuo.',
    "- I pilastri hanno piccole aperture per lo scarico dell'acqua vicino alla base.",
    `- Fissaggio: ${variante.fissaggio}. Sono accettabili sia una struttura autoportante su quattro pilastri (i due posteriori più alti dei due anteriori, per la pendenza di scolo) sia, se coerente con il fissaggio indicato, un fissaggio diretto a parete/soffitto sul lato posteriore senza pilastri propri: scegli la versione più coerente con le immagini di riferimento.`,
    '- Non aggiungere pannelli verticali, vetrate, tende laterali o altri elementi non elencati sopra: fanno parte solo di eventuali accessori opzionali, mai della struttura base.',
  );

  return righe;
}

export function buildRenderPrompt(
  configurazione: ConfigurazionePergola,
  input: ConfiguraDto,
  sottoModello: SottoModello,
  variante: VarianteMontaggio,
): string {
  const righe = structuralChecklist(
    configurazione,
    input,
    sottoModello,
    variante,
  );

  righe.push(
    "Genera una fotografia fotorealistica del prodotto isolato, vista dall'alto (bird's-eye view). Sfondo neutro chiaro (bianco o grigio molto chiaro) con ombre morbide naturali — non serve che sia uno sfondo bianco assoluto senza ombre. Nessun elemento di contesto (nessuna terrazza, giardino o edificio disegnato). Usa le immagini di riferimento allegate per materiali, colori, forma delle travi/guide e dettagli costruttivi, ma la lista puntata sopra ha SEMPRE la precedenza su ciò che vedi nelle immagini in caso di conflitto — soprattutto per proporzioni, orientamento delle guide e posizione delle barre di scorrimento.",
  );

  return righe.join('\n');
}

/**
 * Step 6 of the "compose on a real photo" pipeline: the seller already has
 * (a) the real site photo and (b) a precisely positioned/scaled/perspective-
 * matched but flat-grey silhouette render of the pergola on top of it
 * (steps 1-4, geometry only — 3d/generate_flag.py, no materials). Gemini's
 * job here is narrower than buildRenderPrompt's: it must NOT re-imagine the
 * structure's shape, size, or position (that geometry is already correct
 * and came from real math, not a guess) — only replace the flat grey with
 * real materials/colors and populate the scene for a lifestyle feel.
 */
export function buildCompositePrompt(
  configurazione: ConfigurazionePergola,
  input: ConfiguraDto,
  sottoModello: SottoModello,
  variante: VarianteMontaggio,
): string {
  const righe = structuralChecklist(
    configurazione,
    input,
    sottoModello,
    variante,
  );

  righe.push(
    "Riceverai più immagini: (1) una foto reale del luogo dove verrà installata la pergola; (2) la STESSA foto con sopra una sagoma grigia piatta che mostra ESATTAMENTE dove, a che dimensione e con quale prospettiva verrà installata la pergola; (3) e successive, alcune viste isolate pulite, senza sfondo, dello STESSO identico modello 3D da angolazioni diverse (di lato, dall'alto, ecc.), per farti vedere i dettagli costruttivi — inclusa la forma ESATTA del tettuccio (un telo continuo e piatto, NON un tetto a lamelle/doghe orientabili in stile bioclimatico) — senza l'ambiguità della prospettiva della foto.",
    'Le immagini (2) e successive NON sono un abbozzo da reinterpretare: sono il render esatto di un modello 3D costruito su misura reale, pezzo per pezzo (guide, travi, staffe, giunti) — sono già corrette e definitive. Il tuo unico compito è TRATTARLE COME UNA FOTOGRAFIA GIÀ SCATTATA del prodotto reale e RITOCCARLA: applica il materiale (più metallico, con il colore indicato), aggiungi ombre coerenti con la scena, e nient\'altro sulla struttura. Non ridisegnare, non reinterpretare, non "migliorare" o correggere nessun elemento strutturale — ogni palo, trave, staffa, giunto e il tettuccio stesso visibili nelle immagini di riferimento devono comparire IDENTICI nel risultato finale, stessa forma, stessa posizione, nessuna aggiunta e nessuna omissione.',
    'Vincoli espliciti, perché in test precedenti sono stati violati:',
    `- Fissaggio "${variante.fissaggio}": se è a parete/soffitto, il lato posteriore si aggancia DIRETTAMENTE alla parete/soffitto — NON aggiungere pilastri posteriori contro il muro, non sono previsti e non devono comparire, anche se sembrerebbero "logici" per un tuo giudizio estetico.`,
    '- Non aggiungere staffe, zanche o piastre di fissaggio a pavimento di nessun tipo (né per i pilastri, né altrove) a meno che non siano già visibili nelle immagini di riferimento — e se lo sono, riproducile ESATTAMENTE nella forma mostrata, non una forma generica "tipica" che hai visto altrove.',
    '- Non alterare il profilo della trave anteriore né il punto di innesto tra trave e guida: la forma esatta è quella delle immagini di riferimento, non una tua reinterpretazione stilistica.',
    '- Il tettuccio (il telo che copre dall\'alto) è un UNICO pannello continuo e piatto, con nervature parallele visibili solo come sottili linee sulla superficie — NON è un tetto a lamelle/doghe orientabili apribili in stile pergola bioclimatica: non aggiungere spazi/gap tra le "lamelle", non renderlo apribile, non dargli spessore/profondità come fossero listelli separati. Guarda le viste isolate dall\'alto e di lato per la forma esatta.',
    '- Non aggiungere illuminazione di nessun tipo — niente lampadine, niente fili di luci, niente lanterne, niente faretti — a meno che non sia esplicitamente elencata sopra come accessorio installato (es. luci LED integrate nel frangitratta). In questa configurazione, se non è elencata sopra, non va aggiunta.',
    'Tutto il resto della foto (edificio, cielo, pavimentazione, arredi già presenti) deve restare invariato — stessa inquadratura, stessa luce, stesse ombre coerenti con la scena originale.',
    "Sotto la pergola, aggiungi con libertà creativa un'ambientazione accogliente e curata (es. un tavolo con sedie, piante) per dare un effetto \"da rivista\" — qui, a differenza della struttura, la precisione dimensionale non conta: l'obiettivo è un colpo d'occhio invitante, non un arredo misurabile. Questa libertà creativa vale SOLO per l'arredo, mai per la struttura della pergola stessa.",
    'Restituisci una singola immagine fotorealistica, stessa risoluzione/inquadratura della foto originale.',
  );

  return righe.join('\n');
}
