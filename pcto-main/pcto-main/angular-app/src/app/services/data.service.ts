import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { MotoreRicerca, normalizeText as normalizeTextAvanzata } from './ricerca-avanzata';

export interface Categoria {
  id: string;
  nome: string;
  descrizione: string;
  link: string;
  categoria: string;
  slug: string;
}

export interface Keyword {
  preoccupazione: string;
  categorie: string[];
}

export interface Regola {
  nome: string;
  descrizione: string;
  icona: string;
  categorie: string[];
  raccomandazione: string;
  linkRaccomandazione: string;
  attivita: unknown[];
}

export interface Attivita {
  nome: string;
  descrizione: string;
  eta: string;
  durata: string;
  frequenza: string;
  approccio: string;
  regola: string;
}

export interface Raccomandazione {
  nome: string;
  descrizione: string;
  link: string;
}

export interface DomandaTest {
  domanda: string;
  categoria: string;
  se_si: string;
  se_no: string;
}

export interface HomeTexts {
  heroEyebrow: string;
  heroBetaBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroSub1: string;
  heroSub2: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;

  searchEyebrow: string;
  searchTitle: string;
  searchSubtitle: string;
  searchPlaceholder: string;

  testBannerEyebrow: string;
  testBannerTitle: string;
  testBannerDescription: string;
  testBannerButton: string;

  howItWorksLabel: string;
  howItWorksTitle: string;
  howItWorksSub: string;

  scienceLabel: string;
  scienceTitle: string;
  scienceSub: string;

  topicsLabel: string;
  topicsTitle: string;
  topicsSub: string;

  aboutTitle: string;
  aboutDescription: string;

  privacyLabel: string;
  privacyTitle: string;
  privacySub: string;
}

export const DEFAULT_HOME_TEXTS: HomeTexts = {
  heroEyebrow: 'Guida interattiva per genitori',
  heroBetaBadge: '⚠️ Versione Beta ⚠️',
  heroTitle: 'Educazione digitale familiare',
  heroSubtitle: 'Dalle preoccupazioni a un patto digitale di famiglia',
  heroSub1:
    'Uno strumento pratico basato su evidenze scientifiche, che trasforma la ricerca pedagogica in regole semplici da applicare ogni giorno in famiglia, aiutando i genitori ad accompagnare i propri figli verso un uso consapevole della tecnologia.',
  heroSub2:
    "Non si tratta di un'app individuale, ma di uno strumento della comunità educante nato da un lavoro collettivo. I contenuti si ispirano ai contributi di Serge Tisseron, Pier Cesare Rivoltella e del progetto Custodi Digitali, integrando anche le Raccomandazioni di Milano per l'educazione digitale.",
  heroCtaPrimary: 'Inizia dalla tua preoccupazione',
  heroCtaSecondary: 'Come funziona →',

  searchEyebrow: 'Inizia da qui',
  searchTitle: 'Qual è la tua preoccupazione?',
  searchSubtitle: 'Descrivi la situazione con parole tue: ti mostreremo le aree più rilevanti con percorsi pratici.',
  searchPlaceholder: 'es. mio figlio passa troppo tempo sullo smartphone...',

  testBannerEyebrow: 'Un approccio guidato',
  testBannerTitle: 'Non sai da dove iniziare?',
  testBannerDescription: 'Rispondi a poche domande e scopri le tue aree di attenzione.',
  testBannerButton: 'Fai il test →',

  howItWorksLabel: 'Il percorso',
  howItWorksTitle: 'Dalla preoccupazione alla soluzione',
  howItWorksSub: 'Ogni problema viene affrontato con un metodo strutturato in quattro passi.',

  scienceLabel: 'Fondamenti pedagogici',
  scienceTitle: 'Non consigli casuali.\nScienza applicata.',
  scienceSub:
    'Ogni indicazione è radicata in ricerche riconosciute. Ci affidiamo a metodologie consolidate per offrire strumenti realmente efficaci.',

  topicsLabel: 'Aree di intervento',
  topicsTitle: 'Seleziona la categoria che ti preoccupa di più per approfondirla',
  topicsSub: "Seleziona l'area che ti preoccupa di più per accedere al percorso guidato dedicato.",

  aboutTitle: 'Chi siamo',
  aboutDescription:
    "Il progetto nasce per discutere, condividere e diffondere strategie utili a promuovere un'educazione digitale efficace e responsabile, in linea con le dieci raccomandazioni del Comune di Milano.",

  privacyLabel: 'Tutela dei dati',
  privacyTitle: 'La tua privacy è una priorità',
  privacySub:
    'Questo strumento è progettato nel rispetto della riservatezza degli utenti e dei principi di protezione dei dati personali.'
};

export interface AppData {
  categories: Record<string, Categoria>;
  keywords: Keyword[];
  testQuestions: DomandaTest[];
  rules: Record<string, Regola>;
  activities: Record<string, Attivita>;
  recommendations: Record<string, Raccomandazione>;
  homeTexts: HomeTexts;
}

export interface RisultatoRicerca {
  id: string;
  nome: string;
  descrizione: string;
}

const GOOGLE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzm25VHhONFiJejy76iWiK5DjqlURt1JEWP3dPylKcrNmkUzn1mYY_zMsQ4UUIrPzM/exec';
const FALLBACK_SNAPSHOT_URL =
  'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTUfZgfHyuJS46VG6WcEUZgQd_JbcTfP_y3pj_WaCGI7S6mplaIB8qRT_b0yRixTBUmmuWMeNzas8pt-G7YRUJUujPcriJepeguQ-8PdmGbRC5jbsH8GnXMD5HRIZ3SL8uFI7s5EffejU_uugUc-26Hi-8TmnAJgzg2dQPi9pvgl9fbxpJ_0yJf7S23Q0mU8z7wHKxbVz6BYiDDUiY9A3PktrZUNjOAkLyyHvUBmSgNtuApVO59G6jEtOxksTO9izjJinHh4TZC-tCDJcpq8T_ywi9pmw&lib=MlRCYSh2pVGq_cqM2lnE5VKR_QGq8bm1S';
const ADMIN_OVERRIDE_KEY = 'appData_admin_override';
const ADMIN_AUTH_KEY = 'pcto_admin_auth';

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

function getObjectEntries(value: unknown): [string, unknown][] {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Object.entries(value);
  return [];
}

function getArrayRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'object' && item !== null);
  return [];
}

export function mapRemoteData(payload: Record<string, unknown>): AppData {
  // Deduplicazione keywords: ogni frase esiste una volta sola con tutte le categorie collegate
  const keywordsMap = new Map<string, Keyword>();
  const addKeyword = (phrase: string, cats: string[]) => {
    const cleanPhrase = phrase.trim();
    if (!cleanPhrase) return;
    const key = cleanPhrase.toLowerCase();
    const existing = keywordsMap.get(key);
    if (existing) {
      for (const cat of cats) {
        const cleanCat = cat.trim();
        if (cleanCat && !existing.categorie.includes(cleanCat)) {
          existing.categorie.push(cleanCat);
        }
      }
    } else {
      const uniqueCats = Array.from(new Set(cats.map(c => c.trim()).filter(Boolean)));
      keywordsMap.set(key, { preoccupazione: cleanPhrase, categorie: uniqueCats });
    }
  };

  // Se il payload è già formattato come AppData interno (es. salvato da localStorage)
  if (payload['categories'] && payload['rules'] && payload['activities']) {
    const rawKws = (payload['keywords'] as Keyword[]) || [];
    for (const kw of rawKws) {
      addKeyword(kw.preoccupazione, kw.categorie || []);
    }
    return {
      categories: (payload['categories'] as Record<string, Categoria>) || {},
      keywords: Array.from(keywordsMap.values()),
      testQuestions: (payload['testQuestions'] as DomandaTest[]) || [],
      rules: (payload['rules'] as Record<string, Regola>) || {},
      activities: (payload['activities'] as Record<string, Attivita>) || {},
      recommendations: (payload['recommendations'] as Record<string, Raccomandazione>) || {},
      homeTexts: {
        ...DEFAULT_HOME_TEXTS,
        ...((payload['homeTexts'] as HomeTexts) || {})
      }
    };
  }

  const categoriesRaw = payload['categorie'] || payload['CATEGORIE di rischio'] || {};
  const keywordRaw = payload['keywords'] || payload['KEYWORDS'] || {};
  const testRaw = payload['test_iniziale'] || [];
  const rulesRaw = payload['regole'] || {};
  const activitiesRaw = payload['attivita'] || payload['ATTIVITA'] || {};
  const recommendationsRaw = payload['raccomandazioni'] || payload['RACCOMANDAZIONI'] || {};

  const categories: Record<string, Categoria> = {};
  const categoryLookup = new Map<string, string>();

  getObjectEntries(categoriesRaw).forEach(([key, value]) => {
    const row: any = typeof value === 'object' && value !== null ? value : {};
    const categoryName = row.categoria || row.titolo || key;
    const categoryId = String(row.id ?? slugify(key));
    const entry: Categoria = {
      id: categoryId,
      nome: row.titolo || row.categoria || row.nome || categoryName,
      descrizione: row['info in breve'] || row['info breve'] || row.descrizione || '',
      link: row['link del doc'] || row.link || '',
      categoria: row.categoria || categoryName,
      slug: slugify(categoryName)
    };
    categories[categoryId] = entry;
    categoryLookup.set(normalizeText(categoryName), categoryId);
    categoryLookup.set(normalizeText(entry.nome), categoryId);
    categoryLookup.set(normalizeText(entry.slug), categoryId);
  });

  if (Array.isArray(keywordRaw)) {
    keywordRaw.forEach((row: any) => {
      const preoccupazione = String(row.preoccupazione || '');
      const rawCategorie = String(row.categorie || '');
      const categorie = rawCategorie.includes(',')
        ? rawCategorie.split(',').map(e => e.trim()).filter(Boolean)
        : rawCategorie.split(/\s{2,}/).map(e => e.trim()).filter(Boolean);
      addKeyword(preoccupazione, categorie.length > 0 ? categorie : [rawCategorie.trim()]);
    });
  } else {
    getObjectEntries(keywordRaw).forEach(([categoryKey, value]) => {
      if (Array.isArray(value)) {
        value.forEach(phrase => {
          if (phrase) addKeyword(String(phrase), [String(categoryKey)]);
        });
      } else if (typeof value === 'string' && value.trim()) {
        addKeyword(value, [String(categoryKey)]);
      }
    });
  }

  const keywords: Keyword[] = Array.from(keywordsMap.values());

  const recommendations: Record<string, Raccomandazione> = {};
  const recommendationRowsByName = new Map<string, any>();
  getObjectEntries(recommendationsRaw).forEach(([key, value]) => {
    const row: any = typeof value === 'object' && value !== null ? value : {};
    const name = row.Raccomandazioni || row.nome || key;
    if (name) {
      recommendationRowsByName.set(normalizeText(name), row);
      recommendations[name] = {
        nome: name,
        descrizione: row.descrizione || '',
        link: row['link raccomandazione'] || row.link || ''
      };
    }
  });

  const rules: Record<string, Regola> = {};
  getObjectEntries(rulesRaw).forEach(([ruleName, value]) => {
    const row: any = typeof value === 'object' && value !== null ? value : {};
    const matchedCategories = [
      row.categoria1,
      row.categoria2,
      row.categoria3,
      ...(Array.isArray(row.categorie) ? row.categorie : []),
      ...(Array.isArray(row.categorie_di_rischio) ? row.categorie_di_rischio : [])
    ]
      .filter(Boolean)
      .flatMap((v: unknown) => (Array.isArray(v) ? v.map(String) : [String(v)]))
      .map((v: string) => {
        const norm = normalizeText(v);
        return (
          categoryLookup.get(norm) ||
          Object.values(categories).find(
            c => normalizeText(c.categoria) === norm || normalizeText(c.nome) === norm || normalizeText(c.slug) === norm
          )?.id ||
          ''
        );
      })
      .filter(Boolean);
    const raccomandazione =
      row.raccomandazione ||
      row['raccomandazione del comune di Milano'] ||
      row['Raccomandazione del Comune di Milano'] ||
      '';
    const matchingRec = recommendationRowsByName.get(normalizeText(raccomandazione));
    rules[ruleName] = {
      nome: ruleName,
      descrizione: row.descrizione || '',
      icona: row.immagine || row.icona || '📌',
      categorie: matchedCategories,
      raccomandazione,
      linkRaccomandazione: row.link || matchingRec?.link || matchingRec?.['link raccomandazione'] || '',
      attivita: Array.isArray(row.attivita) ? row.attivita : []
    };
  });

  const activities: Record<string, Attivita> = {};
  getObjectEntries(activitiesRaw).forEach(([activityName, value]) => {
    const row: any = typeof value === 'object' && value !== null ? value : {};
    const ruleName = row.regola || '';
    const key = `${ruleName}-${activityName}`;
    activities[key] = {
      nome: activityName,
      descrizione: row.descrizione || '',
      eta: String(row.eta || row['età di riferimento'] || ''),
      durata: String(row.durata || ''),
      frequenza: String(row.frequenza || ''),
      approccio: String(row.approccio || row['approccio teorico'] || ''),
      regola: ruleName
    };
  });

  const testQuestions: DomandaTest[] = getArrayRows(testRaw).map((row: any) => {
    const categoryName = row.categotia || row.categoria || row['categoria di rischio'] || '';
    const categoryId =
      Object.values(categories).find(
        c =>
          normalizeText(c.categoria) === normalizeText(categoryName) ||
          normalizeText(c.nome) === normalizeText(categoryName) ||
          normalizeText(c.slug) === normalizeText(categoryName)
      )?.id || slugify(categoryName);
    return {
      domanda: row.domande || row.domanda || '',
      categoria: categoryId,
      se_si: row['se SI'] || row['se SI '] || row.se_si || '',
      se_no: row['se NO'] || row['se NO '] || row.se_no || ''
    };
  });

  const homeTexts: HomeTexts = {
    ...DEFAULT_HOME_TEXTS,
    ...((payload['homeTexts'] as HomeTexts) || {})
  };

  return { categories, keywords, testQuestions, rules, activities, recommendations, homeTexts };
}

/**
 * Trasforma l'oggetto AppData nel payload compatibile con data-snapshot.json
 * per un'esportazione pulita e permanente.
 */
export function exportRawPayload(data: AppData): Record<string, unknown> {
  const categorie: Record<string, unknown> = {};
  for (const c of Object.values(data.categories)) {
    categorie[c.categoria || c.id] = {
      id: c.id,
      categoria: c.categoria,
      titolo: c.nome,
      'info in breve': c.descrizione,
      'link del doc': c.link
    };
  }

  const raccomandazioni: Record<string, unknown> = {};
  for (const r of Object.values(data.recommendations)) {
    raccomandazioni[r.nome] = {
      Raccomandazioni: r.nome,
      descrizione: r.descrizione,
      'link raccomandazione': r.link
    };
  }

  const regole: Record<string, unknown> = {};
  for (const r of Object.values(data.rules)) {
    regole[r.nome] = {
      regole: r.nome,
      descrizione: r.descrizione,
      immagine: r.icona,
      categoria1: r.categorie?.[0] || '',
      categoria2: r.categorie?.[1] || '',
      categoria3: r.categorie?.[2] || '',
      'raccomandazione del comune di Milano': r.raccomandazione || '',
      link: r.linkRaccomandazione || ''
    };
  }

  const attivita: Record<string, unknown> = {};
  for (const a of Object.values(data.activities)) {
    attivita[a.nome] = {
      regola: a.regola,
      'nome attività': a.nome,
      descrizione: a.descrizione,
      'età di riferimento': a.eta,
      durata: a.durata,
      frequenza: a.frequenza,
      'approccio teorico': a.approccio
    };
  }

  const test_iniziale = data.testQuestions.map((q, index) => ({
    x: index + 1,
    categotia: q.categoria,
    domande: q.domanda,
    'se SI': q.se_si,
    'se NO': q.se_no
  }));

  const keywordsByCat: Record<string, string[]> = {};
  for (const kw of data.keywords) {
    for (const cat of kw.categorie) {
      if (!keywordsByCat[cat]) keywordsByCat[cat] = [];
      if (!keywordsByCat[cat].includes(kw.preoccupazione)) {
        keywordsByCat[cat].push(kw.preoccupazione);
      }
    }
  }

  return {
    categorie,
    keywords: keywordsByCat,
    test_iniziale,
    regole,
    attivita,
    raccomandazioni,
    homeTexts: data.homeTexts
  };
}

function risolviCategoriaId(nomeCategoria: string, data: AppData): string {
  const norm = normalizeTextAvanzata(nomeCategoria);
  return (
    Object.values(data.categories).find(
      c =>
        normalizeTextAvanzata(c.id) === norm ||
        normalizeTextAvanzata(c.categoria) === norm ||
        normalizeTextAvanzata(c.nome) === norm ||
        normalizeTextAvanzata(c.slug) === norm
    )?.id || ''
  );
}

function findMatchingCategoriesForQuery(
  query: string,
  data: AppData,
  motore: MotoreRicerca
): { id: string; punteggio: number }[] {
  const risultati = motore.cerca(query);
  const out: { id: string; punteggio: number }[] = [];
  const visti = new Set<string>();
  for (const r of risultati) {
    const id = risolviCategoriaId(r.categoria, data);
    if (id && !visti.has(id)) {
      visti.add(id);
      out.push({ id, punteggio: r.punteggio });
    }
  }
  return out;
}

const EMPTY_DATA: AppData = {
  categories: {},
  keywords: [],
  testQuestions: [],
  rules: {},
  activities: {},
  recommendations: {},
  homeTexts: { ...DEFAULT_HOME_TEXTS }
};

@Injectable({ providedIn: 'root' })
export class DataService {
  private currentData: AppData | null = null;
  private motore: MotoreRicerca | null = null;
  private motoreKeywords: Keyword[] | null = null;

  // Segnali di stato Admin
  readonly isAdmin = signal<boolean>(false);
  readonly hasUnsavedChanges = signal<boolean>(false);
  readonly dataChanged$ = new Subject<AppData>();

  constructor() {
    // Ripristina la sessione amministratore se già loggato
    if (typeof sessionStorage !== 'undefined') {
      const savedAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (savedAuth === '1') {
        this.isAdmin.set(true);
      }
    }
  }

  /**
   * Autenticazione amministratore con le credenziali fornite dall'utente.
   */
  login(user: string, pass: string): boolean {
    const validUser = 'educazione_digitale__pcto__2026';
    const validPass = 'E_D_P_2026';
    if (user.trim() === validUser && pass.trim() === validPass) {
      this.isAdmin.set(true);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(ADMIN_AUTH_KEY, '1');
      }
      return true;
    }
    return false;
  }

  /**
   * Disconnessione e ritorno alla visualizzazione visitatore.
   */
  logout(): void {
    this.isAdmin.set(false);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    }
  }

  private getMotore(data: AppData): MotoreRicerca {
    if (this.motore && this.motoreKeywords === data.keywords) return this.motore;
    this.motore = new MotoreRicerca(data.keywords);
    this.motoreKeywords = data.keywords;
    return this.motore;
  }

  /**
   * Carica i dati dal file statico locale data-snapshot.json nel bundle.
   * Questo caricamento è ultra-veloce (~10-20ms) e non dipende da Excel né da Google Sheets.
   */
  private async caricaSnapshotLocale(): Promise<Record<string, unknown> | null> {
    try {
      let targetUrl = 'data-snapshot.json';
      if (typeof document !== 'undefined' && document.baseURI) {
        targetUrl = new URL('data-snapshot.json', document.baseURI).href;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('timeout'), 5000);
      const res = await fetch(targetUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch (e) {
      console.warn('[data.service] Snapshot locale non disponibile o fetch fallito:', e);
      return null;
    }
  }

  private async fetchGoogleAppScript(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') throw new Error('Risposta vuota');
      return payload;
    } catch (e) {
      console.warn('[data.service] fetch Google Apps Script fallito per', url, e);
      return null;
    }
  }

  private async caricaGoogleAppScriptData(): Promise<Record<string, unknown> | null> {
    const MAX_TENTATIVI = 2;
    for (let tentativo = 1; tentativo <= MAX_TENTATIVI; tentativo++) {
      const payload = await this.fetchGoogleAppScript(GOOGLE_APPS_SCRIPT_URL, 10000);
      if (!payload) continue;
      if (payload['raccomandazioni'] || payload['RACCOMANDAZIONI']) return payload;
    }
    return await this.fetchGoogleAppScript(FALLBACK_SNAPSHOT_URL, 10000);
  }

  /**
   * Recupera i dati dell'applicazione:
   * 1. Memoria locale / in-memory cache se disponibile
   * 2. Modifiche salvate dall'admin in localStorage
   * 3. Snapshot statico locale JSON (velocissimo, 0 latenza di rete remota)
   * 4. Google Apps Script solo come fallback d'emergenza
   */
  async getAppData(forceRefresh = false): Promise<{ data: AppData; source: 'local' | 'cache' | 'snapshot' | 'google' | 'fallback' }> {
    if (this.currentData && !forceRefresh) {
      return { data: this.currentData, source: 'cache' };
    }

    // 1. Controlla se l'amministratore ha salvato modifiche in localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const savedOverride = localStorage.getItem(ADMIN_OVERRIDE_KEY);
        if (savedOverride) {
          const parsed = JSON.parse(savedOverride);
          const data = mapRemoteData(parsed);
          this.currentData = data;
          this.getMotore(data);
          return { data, source: 'local' };
        }
      } catch (e) {
        console.warn('[data.service] Errore lettura dati personalizzati da localStorage', e);
      }
    }

    // 2. Carica il file statico data-snapshot.json
    const localSnapshot = await this.caricaSnapshotLocale();
    if (localSnapshot) {
      const data = mapRemoteData(localSnapshot);
      this.currentData = data;
      this.getMotore(data);
      return { data, source: 'snapshot' };
    }

    // 3. Fallback Google Apps Script
    const payload = await this.caricaGoogleAppScriptData();
    if (payload) {
      const data = mapRemoteData(payload);
      this.currentData = data;
      this.getMotore(data);
      return { data, source: 'google' };
    }

    this.currentData = { ...EMPTY_DATA };
    return { data: this.currentData, source: 'fallback' };
  }

  /**
   * Salva in modo permanente nel browser (localStorage) tutte le modifiche apportate
   * dall'amministratore a categorie, regole, attività, test, raccomandazioni, keywords e testi home.
   */
  saveAdminData(newData: AppData): void {
    this.currentData = JSON.parse(JSON.stringify(newData));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(ADMIN_OVERRIDE_KEY, JSON.stringify(this.currentData));
      } catch (e) {
        console.error('[data.service] Errore durante il salvataggio in localStorage', e);
      }
    }
    this.getMotore(this.currentData!);
    this.hasUnsavedChanges.set(false);
    this.dataChanged$.next(this.currentData!);
  }

  /**
   * Notifica che ci sono modifiche in corso non ancora salvate.
   */
  setUnsavedChanges(status: boolean): void {
    this.hasUnsavedChanges.set(status);
  }

  /**
   * Annulla le modifiche non salvate e ripristina i dati all'ultimo salvataggio effettuato.
   */
  async resetToLastSaved(): Promise<AppData> {
    this.currentData = null;
    const { data } = await this.getAppData(true);
    this.hasUnsavedChanges.set(false);
    this.dataChanged$.next(data);
    return data;
  }

  /**
   * Ripristina il database allo snapshot originale cancellando i dati modificati in localStorage.
   */
  async resetToOriginalSnapshot(): Promise<AppData> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_OVERRIDE_KEY);
    }
    this.currentData = null;
    const { data } = await this.getAppData(true);
    this.hasUnsavedChanges.set(false);
    this.dataChanged$.next(data);
    return data;
  }

  /**
   * Scarica il file data-snapshot.json aggiornato direttamente dal browser.
   * L'utente può sostituire questo file in angular-app/public/ e committare su GitHub Pages!
   */
  exportSnapshotJson(): void {
    if (!this.currentData) return;
    const rawPayload = exportRawPayload(this.currentData);
    const jsonString = JSON.stringify(rawPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-snapshot.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getCategorie(): Promise<Record<string, Categoria>> {
    const { data } = await this.getAppData();
    return data.categories;
  }

  async getTestIniziale(): Promise<{ regole: Record<string, Regola>; test: DomandaTest[] }> {
    const { data } = await this.getAppData();
    return { regole: data.rules, test: data.testQuestions };
  }

  async getAttivita(): Promise<Record<string, Attivita>> {
    const { data } = await this.getAppData();
    return data.activities;
  }

  async getKeywords(): Promise<string[]> {
    const { data } = await this.getAppData();
    return Array.from(new Set(data.keywords.map(item => item.preoccupazione)));
  }

  async suggerisciKeywords(parziale: string): Promise<string[]> {
    const { data } = await this.getAppData();
    return this.getMotore(data).suggerisci(parziale);
  }

  async searchCategories(queries: string[]): Promise<{ success: boolean; risultati: RisultatoRicerca[] }> {
    if (!queries || !Array.isArray(queries) || queries.length === 0) return { success: false, risultati: [] };
    const { data } = await this.getAppData();
    const motore = this.getMotore(data);
    const punteggi = new Map<string, number>();
    for (const query of queries) {
      for (const m of findMatchingCategoriesForQuery(query, data, motore)) {
        punteggi.set(m.id, (punteggi.get(m.id) ?? 0) + m.punteggio);
      }
    }
    const risultati: RisultatoRicerca[] = Array.from(punteggi.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([categoryId]) => {
        const category = data.categories[categoryId];
        return { id: categoryId, nome: category?.nome || categoryId, descrizione: category?.descrizione || '' };
      });
    return risultati.length > 0 ? { success: true, risultati } : { success: false, risultati: [] };
  }

  async filterRulesByCategories(selectedCategories: string[]): Promise<{ success: boolean; regole: string[] }> {
    if (!selectedCategories || !Array.isArray(selectedCategories)) return { success: false, regole: [] };
    const { data } = await this.getAppData();
    const regoleSelezionate: string[] = [];
    Object.entries(data.rules).forEach(([nome, dati]) => {
      const match = (dati.categorie || []).some(cat => selectedCategories.includes(cat));
      if (match) regoleSelezionate.push(nome);
    });
    return { success: true, regole: regoleSelezionate };
  }
}