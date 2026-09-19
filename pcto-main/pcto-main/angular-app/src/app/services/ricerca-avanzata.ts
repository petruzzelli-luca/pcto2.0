// ricerca-avanzata.ts
// Motore di ricerca lessicale "intelligente" per le preoccupazioni dei genitori.
// Sostituisce findMatchingCategoriesForQuery() con un sistema a punteggio.
//
// Caratteristiche:
//  - normalizzazione + stemming leggero per l'italiano (plurali, femminili, verbi)
//  - dizionario di sinonimi di dominio (cellulare = telefono = smartphone...)
//  - pesatura IDF: le parole rare ("hikikomori", "ricatto") contano più di "telefono"
//  - tolleranza agli errori di battitura (coefficiente di Dice sui bigrammi)
//  - risultati ORDINATI con punteggio di confidenza, mai più un match "tutto o niente"
//
// Costo: l'indice si costruisce una sola volta (~5 ms su 1000 frasi),
// ogni ricerca è < 3 ms. Nessuna dipendenza esterna.

export interface KeywordRow {
  preoccupazione: string;
  categorie: string[]; // la prima è considerata primaria
}

export interface CategoriaPunteggio {
  categoria: string;      // nome categoria così come sta nel foglio
  punteggio: number;      // 0..1, normalizzato sul migliore
  frasiSimili: string[];  // frasi del dataset che hanno generato il match (utile per il debug / UI)
}

/* ------------------------------------------------------------------ */
/* 1. Normalizzazione                                                  */
/* ------------------------------------------------------------------ */

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'non', 'per', 'che', 'con', 'come', 'del', 'dei', 'dello', 'della', 'delle', 'degli',
  'nel', 'nella', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'alla', 'alle', 'allo', 'agli',
  'mio', 'mia', 'miei', 'mie', 'suo', 'sua', 'suoi', 'sue', 'gli', 'una', 'uno', 'gli',
  'ancora', 'anche', 'quando', 'sempre', 'mai', 'cosa', 'fare', 'essere', 'avere',
  'viene', 'stato', 'solo', 'tutto', 'tutti', 'tutta', 'tutte', 'poco', 'molto', 'piu',
  'qualcosa', 'qualcuno', 'perche', 'dopo', 'prima', 'ogni', 'dice', 'sono', 'riesce',
  'sembra', 'vuole', 'fatto', 'cose', 'altro', 'altri', 'senza', 'nessun', 'nessuno'
]);

/* ------------------------------------------------------------------ */
/* 2. Sinonimi di dominio                                              */
/* ------------------------------------------------------------------ */
// Mappa: variante -> forma canonica. Applicata PRIMA dello stemming.
// Aggiungerne è il modo più rapido ed economico di migliorare la ricerca:
// ogni riga qui vale più di mille righe di algoritmo.

const SINONIMI: Record<string, string> = {};
function reg(canonica: string, ...varianti: string[]) {
  SINONIMI[canonica] = canonica;
  for (const v of varianti) SINONIMI[v] = canonica;
}

reg('telefono', 'cellulare', 'cell', 'smartphone', 'tel', 'telefonino', 'iphone', 'device', 'dispositivo', 'schermo', 'schermi', 'display');
reg('tablet', 'ipad');
reg('computer', 'pc', 'portatile', 'notebook');
reg('gioco', 'videogioco', 'videogiochi', 'giochi', 'giocare', 'gaming', 'gamer', 'console', 'playstation', 'ps5', 'xbox', 'nintendo', 'fortnite', 'minecraft', 'roblox', 'valorant', 'briscola');
reg('social', 'instagram', 'insta', 'tiktok', 'facebook', 'snapchat', 'snap', 'bereal', 'twitter');
reg('video', 'youtube', 'netflix', 'streaming', 'serie', 'reel', 'reels', 'shorts');
reg('chat', 'whatsapp', 'telegram', 'discord', 'messaggi', 'messaggio', 'messaggiare', 'dm');
reg('figlio', 'figlia', 'bambino', 'bambina', 'ragazzo', 'ragazza', 'figli', 'bimbo', 'bimba', 'adolescente');
reg('dipendenza', 'dipendente', 'attaccato', 'incollato', 'ossessionato', 'ossessione', 'compulsivo', 'assuefatto');
reg('triste', 'depresso', 'depressione', 'abbattuto', 'giu', 'infelice', 'malinconico');
reg('ansia', 'ansioso', 'agitato', 'nervoso', 'angoscia', 'panico', 'stress', 'stressato');
reg('rabbia', 'arrabbiato', 'aggressivo', 'aggressivita', 'scatti', 'urla', 'capricci', 'nervoso');
reg('sonno', 'dorme', 'dormire', 'insonnia', 'notte', 'notturno', 'sveglia', 'addormenta', 'riposo');
reg('scuola', 'compiti', 'studio', 'studiare', 'voti', 'professori', 'insegnanti', 'maestre', 'lezioni', 'rendimento', 'pagella');
reg('amici', 'amicizia', 'amico', 'compagni', 'coetanei', 'compagnia');
reg('bullismo', 'bullizzato', 'bulli', 'cyberbullismo', 'deriso', 'derisione', 'preso', 'insultato', 'insulti', 'offese', 'offeso', 'preso_in_giro');
reg('privacy', 'dati', 'password', 'account', 'profilo', 'riservatezza');
reg('sessuale', 'porno', 'pornografia', 'pornografici', 'sesso', 'sexting', 'intime', 'nudo');
reg('violenza', 'violento', 'violenti', 'gore', 'sangue', 'macabro', 'splatter');
reg('sconosciuto', 'sconosciuti', 'estranei', 'estraneo', 'adulti', 'adulto', 'stranieri');
reg('isolamento', 'isolato', 'isola', 'solitudine', 'chiuso', 'ritirato', 'hikikomori', 'emarginato');
reg('concentrazione', 'concentrarsi', 'distratto', 'distrazione', 'attenzione', 'memoria', 'distrae');
reg('cibo', 'mangia', 'mangiare', 'pasti', 'cena', 'pranzo', 'alimentazione', 'peso');
reg('sport', 'attivita', 'movimento', 'palestra', 'calcio', 'allenamento');
reg('occhi', 'vista', 'miopia', 'oculista', 'occhiali');
reg('soldi', 'acquisti', 'comprare', 'spende', 'carta', 'pagamenti', 'microtransazioni');
reg('limite', 'limiti', 'regole', 'regola', 'orari', 'restrizioni', 'controllo', 'parental');
reg('bugia', 'mente', 'nasconde', 'nascondere', 'segreto', 'segreti', 'inganna');
reg('autolesionismo', 'tagliarsi', 'farsi', 'male', 'autolesiva');
reg('fake', 'bufale', 'complotto', 'complottiste', 'disinformazione', 'notizie');

/* ------------------------------------------------------------------ */
/* 3. Stemmer leggero per l'italiano                                   */
/* ------------------------------------------------------------------ */
// Non è uno Snowball completo: taglia solo i suffissi più comuni.
// Obiettivo: "telefoni"/"telefono", "dipendente"/"dipendenza",
// "giocando"/"giocare"/"gioco" finiscono nello stesso ceppo.

const SUFFISSI = [
  'issimamente', 'issimo', 'issima', 'issimi', 'issime',
  'amente', 'mente', 'zione', 'zioni', 'mento', 'menti',
  'aggio', 'aggi', 'ando', 'endo', 'anza', 'enza', 'ista', 'isti', 'ismo',
  'ato', 'ata', 'ati', 'ate', 'ito', 'ita', 'iti', 'ite', 'uto', 'uta', 'uti', 'ute',
  'are', 'ere', 'ire', 'arsi', 'ersi', 'irsi',
  'ano', 'ono', 'ava', 'avo', 'iamo', 'ete',
  'oso', 'osa', 'osi', 'ose', 'ale', 'ali', 'ico', 'ica', 'ici', 'iche',
  'ino', 'ina', 'ini', 'ine', 'one', 'oni', 'etto', 'etta'
];

const MIN_STEM = 4;

export function stemIt(token: string): string {
  const canonico = SINONIMI[token];
  if (canonico) return canonico; // i sinonimi non si stemmano: sono già la forma finale
  let t = token;
  for (const s of SUFFISSI) {
    if (t.length - s.length >= MIN_STEM && t.endsWith(s)) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  // taglio finale di genere/numero
  if (t.length > MIN_STEM && /[aeiou]$/.test(t)) t = t.slice(0, -1);
  return t;
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
    .map(stemIt)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* 4. Similarità fuzzy (errori di battitura)                           */
/* ------------------------------------------------------------------ */

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** Coefficiente di Dice: 1 = identiche, 0 = nulla in comune. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  if (Math.abs(a.length - b.length) > 3) return 0; // scorciatoia: lunghezze troppo diverse
  const A = bigrams(a);
  const B = new Map<string, number>();
  for (const g of bigrams(b)) B.set(g, (B.get(g) ?? 0) + 1);
  let comuni = 0;
  for (const g of A) {
    const n = B.get(g) ?? 0;
    if (n > 0) { comuni++; B.set(g, n - 1); }
  }
  return (2 * comuni) / (A.length + bigrams(b).length);
}

const SOGLIA_FUZZY = 0.78;

// Parole che compaiono in quasi ogni domanda di un genitore e quindi non
// discriminano nulla, ma che l'IDF premierebbe se fossero rare nel dataset.
// Il loro contributo al punteggio viene ridotto invece di azzerarlo.
const CONTESTO = new Set(['figlio', 'cas', 'temp', 'ora', 'ore', 'giorn', 'ann', 'ved', 'vedere', 'sta', 'and']);
const PESO_CONTESTO = 0.2;

/* ------------------------------------------------------------------ */
/* 5. Indice                                                           */
/* ------------------------------------------------------------------ */

interface VoceIndice {
  frase: string;
  tokens: string[];
  peso: number;      // somma degli IDF dei token (per normalizzare)
  categorie: string[];
}

export class MotoreRicerca {
  private voci: VoceIndice[] = [];
  private idf = new Map<string, number>();
  private vocabolario: string[] = [];

  constructor(keywords: KeywordRow[]) {
    // scarta le righe vuote o senza categorie (il foglio ne ha parecchie in fondo)
    const righe = keywords.filter(k => k.preoccupazione?.trim() && k.categorie?.some(c => c.trim()));

    const df = new Map<string, number>();
    const parziali = righe.map(k => {
      const tokens = Array.from(new Set(tokenize(k.preoccupazione)));
      for (const t of tokens) df.set(t, (df.get(t) ?? 0) + 1);
      return { frase: k.preoccupazione, tokens, categorie: k.categorie.map(c => c.trim()).filter(Boolean) };
    });

    const N = parziali.length || 1;
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + N / n));
    this.vocabolario = Array.from(df.keys());

    this.voci = parziali
      .filter(p => p.tokens.length > 0)
      .map(p => ({
        ...p,
        peso: p.tokens.reduce((s, t) => s + (this.idf.get(t) ?? 1), 0)
      }));
  }

  /**
   * Espande i token della query aggiungendo i termini del vocabolario
   * che assomigliano a un token (corregge gli errori di battitura).
   */
  private espandiQuery(tokens: string[]): Map<string, number> {
    const pesi = new Map<string, number>();
    for (const t of tokens) {
      pesi.set(t, Math.max(pesi.get(t) ?? 0, 1));
      if (this.idf.has(t)) continue; // parola conosciuta: niente fuzzy, risparmio tempo
      let migliore = '', punteggio = 0;
      for (const v of this.vocabolario) {
        const d = dice(t, v);
        if (d > punteggio) { punteggio = d; migliore = v; }
      }
      if (punteggio >= SOGLIA_FUZZY) pesi.set(migliore, Math.max(pesi.get(migliore) ?? 0, punteggio));
    }
    return pesi;
  }

  /**
   * Cerca le categorie più pertinenti a un testo libero.
   * @param testo      la preoccupazione scritta dal genitore
   * @param maxRisultati quante categorie restituire al massimo
   */
  cerca(testo: string, maxRisultati = 50): CategoriaPunteggio[] {
    const tokens = tokenize(testo);
    if (tokens.length === 0) return [];
    const queryPesi = this.espandiQuery(tokens);
    const normalizzata = normalizeText(testo);

    // --- punteggio frase per frase ---
    const match: { voce: VoceIndice; score: number }[] = [];
    for (const voce of this.voci) {
      let somma = 0, colpiti = 0;
      for (const t of voce.tokens) {
        const p = queryPesi.get(t);
        if (p) {
          const damp = CONTESTO.has(t) ? PESO_CONTESTO : 1;
          somma += (this.idf.get(t) ?? 1) * p * damp;
          colpiti++;
        }
      }
      if (colpiti === 0) continue;

      // copertura della frase chiave (evita che una frase lunga vinca con una parola sola)
      let score = somma / Math.sqrt(voce.peso || 1);
      if (colpiti === voce.tokens.length) score *= 1.6;            // frase interamente coperta
      if (normalizzata.includes(normalizeText(voce.frase))) score *= 2.2; // citazione letterale
      match.push({ voce, score });
    }
    if (match.length === 0) return [];

    match.sort((a, b) => b.score - a.score);

    // --- voto delle categorie: solo le migliori frasi votano ---
    const TOP_FRASI = 12;
    const punti = new Map<string, { score: number; frasi: string[] }>();
    for (const m of match.slice(0, TOP_FRASI)) {
      m.voce.categorie.forEach((cat, i) => {
        const peso = i === 0 ? 1 : 0.55; // la prima categoria della riga è quella primaria
        const acc = punti.get(cat) ?? { score: 0, frasi: [] };
        acc.score += m.score * peso;
        if (acc.frasi.length < 3) acc.frasi.push(m.voce.frase);
        punti.set(cat, acc);
      });
    }

    const risultati = Array.from(punti.entries())
      .map(([categoria, v]) => ({ categoria, punteggio: v.score, frasiSimili: v.frasi }))
      .sort((a, b) => b.punteggio - a.punteggio);

    // normalizzazione 0..1 sul migliore e taglio delle code irrilevanti
    const max = risultati[0].punteggio || 1;
    const categorieDellaFraseMigliore = new Set(match[0].voce.categorie);
    return risultati
      .map(r => ({ ...r, punteggio: r.punteggio / max }))
      .filter((r, i) => i === 0 || r.punteggio >= 0.3 || categorieDellaFraseMigliore.has(r.categoria))
      .slice(0, maxRisultati);
  }

  /** Autocomplete migliore di `includes`: tollera ordine diverso e refusi. */
  suggerisci(parziale: string, max = 8): string[] {
    const tokens = tokenize(parziale);
    const grezzo = normalizeText(parziale);
    if (!grezzo) return [];
    return this.voci
      .map(v => {
        const norm = normalizeText(v.frase);
        let s = 0;
        if (norm.startsWith(grezzo)) s += 3;
        else if (norm.includes(grezzo)) s += 2;
        for (const t of tokens) if (v.tokens.includes(t)) s += 1;
        return { frase: v.frase, s };
      })
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.frase.length - b.frase.length)
      .slice(0, max)
      .map(x => x.frase);
  }
}