import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Attivita, Categoria, DataService, Raccomandazione, Regola, normalizeText } from '../../services/data.service';

interface RegolaPatto {
  nome: string;
  dati: Regola;
  attivita: Attivita[];
}

interface CategoriaPatto {
  id: string;
  info: Categoria | { id: string; nome: string; descrizione: string };
  regole: RegolaPatto[];
}

type RGB = [number, number, number];

@Component({
  selector: 'app-test-risultati',
  imports: [RouterLink],
  templateUrl: './test-risultati.html',
  styleUrl: './test-risultati.css'
})
export class TestRisultati implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  errore = signal(false);
  patto = signal<CategoriaPatto[]>([]);
  pdfAbilitato = signal(false);

  rifaiQueryParams: Record<string, string> = {};

  private pattoOriginale: CategoriaPatto[] = [];
  private tutteLeRegoleDB: Record<string, Regola> = {};
  private tutteLeRaccomandazioniDB: Record<string, Raccomandazione> = {};

  ngOnInit(): void {
    const cat = this.route.snapshot.queryParamMap.get('categorie');
    if (cat) this.rifaiQueryParams = { categorie: cat };
    this.carica();
  }

  conteggioAttivita(categoria: CategoriaPatto): number {
    return categoria.regole.reduce((tot, r) => tot + (r.attivita?.length || 0), 0);
  }

  private async carica(): Promise<void> {
    try {
      const raw = this.route.snapshot.queryParamMap.get('regole');
      if (!raw) throw new Error('Parametro regole mancante');
      const nomiRegole: string[] = JSON.parse(raw);
      const rawCategorie = this.route.snapshot.queryParamMap.get('categorie');
      const categorieSelezionate: string[] = rawCategorie ? JSON.parse(rawCategorie) : [];

      const data = await this.data.getTestIniziale();
      const regoleDb = data.regole || {};
      this.tutteLeRegoleDB = regoleDb;
      const appDataCompleto = await this.data.getAppData();
      this.tutteLeRaccomandazioniDB = appDataCompleto.data.recommendations || {};
      const attivitaDb = await this.data.getAttivita();
      const attivitaArray = Object.values(attivitaDb || {});
      const categorieDb = await this.data.getCategorie();

      const categoriePerRegola: Record<string, string[]> = {};
      const unici = [...new Set(nomiRegole.filter(Boolean))];
      unici.forEach(nome => {
        const regola = regoleDb[nome] || ({} as Regola);
        const categorieIds = Array.isArray(regola.categorie) ? regola.categorie : [];
        categorieIds.forEach(id => {
          if (!categoriePerRegola[id]) categoriePerRegola[id] = [];
          categoriePerRegola[id].push(nome);
        });
      });

      const categorieIdsOrdine: string[] = [];
      categorieSelezionate.forEach(id => {
        if (id && !categorieIdsOrdine.includes(id)) categorieIdsOrdine.push(id);
      });
      Object.keys(categoriePerRegola).forEach(id => {
        if (!categorieIdsOrdine.includes(id)) categorieIdsOrdine.push(id);
      });

      const regoleGiaAssegnate = new Set<string>();
      const struttura: CategoriaPatto[] = categorieIdsOrdine.map(id => {
        const info = categorieDb[id] || Object.values(categorieDb).find(item =>
          normalizeText(item.id) === normalizeText(id) || normalizeText(item.categoria) === normalizeText(id)
        ) || { id, nome: id, descrizione: '' };
        const regolePerCategoria: RegolaPatto[] = [];
        const regoleNellaCategoria = categoriePerRegola[id] || [];
        regoleNellaCategoria.forEach(nomeRegola => {
          // Una regola può appartenere a più ambiti di rischio nel database:
          // va mostrata una sola volta, nel primo ambito in cui compare.
          if (regoleGiaAssegnate.has(nomeRegola)) return;
          regoleGiaAssegnate.add(nomeRegola);
          const regola = regoleDb[nomeRegola] || ({} as Regola);
          const attivitaRegola = attivitaArray.filter(att => normalizeText(att.regola) === normalizeText(nomeRegola));
          regolePerCategoria.push({ nome: nomeRegola, dati: regola, attivita: attivitaRegola });
        });
        return { id, info, regole: regolePerCategoria };
      }).filter(categoria => categoria.regole.length > 0);

      this.pattoOriginale = JSON.parse(JSON.stringify(struttura));
      this.patto.set(struttura);
      this.pdfAbilitato.set(struttura.length > 0);
      this.loading.set(false);
    } catch (e) {
      this.errore.set(true);
      this.loading.set(false);
    }
  }

  eliminaRegola(categoriaIndex: number, regolaIndex: number): void {
    this.patto.update(patto => {
      const copia = [...patto];
      if (!copia[categoriaIndex]) return patto;
      const categoria = { ...copia[categoriaIndex], regole: [...copia[categoriaIndex].regole] };
      categoria.regole.splice(regolaIndex, 1);
      if (categoria.regole.length === 0) copia.splice(categoriaIndex, 1);
      else copia[categoriaIndex] = categoria;
      return copia;
    });
    this.pdfAbilitato.set(this.patto().length > 0);
  }

  eliminaAttivita(categoriaIndex: number, regolaIndex: number, attivitaIndex: number): void {
    this.patto.update(patto => {
      const copia = [...patto];
      const categoria = copia[categoriaIndex];
      if (!categoria || !categoria.regole[regolaIndex]) return patto;
      const regole = [...categoria.regole];
      const regola = { ...regole[regolaIndex], attivita: [...regole[regolaIndex].attivita] };
      regola.attivita.splice(attivitaIndex, 1);
      regole[regolaIndex] = regola;
      copia[categoriaIndex] = { ...categoria, regole };
      return copia;
    });
  }

  downloadPDF(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pattoStruttura = this.patto();
  const pattoOriginale = this.pattoOriginale;

  // ---- Design tokens -------------------------------------------------
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 16;                 // margine uniforme, niente testo a ridosso dei bordi
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const HEADER_H = 26;
  const FOOTER_H = 16;
  const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 6; // stop utile prima del footer

  const BIANCO: RGB = [255, 255, 255];
  const SFONDO: RGB = [248, 249, 250];     // sfondo pagina, quasi bianco
  const NERO: RGB = [33, 37, 41];
  const GRIGIO: RGB = [108, 117, 125];
  const GRIGIO_CHIARO: RGB = [225, 228, 231];

  // Colore primario del brand (coerente in tutto il documento)
  const PRIMARIO: RGB = [22, 120, 80];      // verde
  const PRIMARIO_CHIARO: RGB = [225, 243, 235];

  // Colori di accento per sezione (usati solo su strisce/etichette, non su sfondi pieni)
  const ACCENTO = {
    regole: PRIMARIO,
    consigliate: [200, 140, 0] as RGB,      // giallo/ambra
    attivita: [30, 90, 160] as RGB,         // blu
    raccomandazioni: [200, 90, 130] as RGB, // rosa
    dbRegole: [190, 70, 40] as RGB          // rosso mattone
  };

  // Palette allegra e colorata: una tinta diversa per ogni categoria, pensata
  // per il poster delle regole (pagina 1), adatto a un pubblico di bambini
  const PALETTE_DIVERTENTE: RGB[] = [
    [239, 71, 111],   // rosa acceso
    [255, 140, 66],   // arancione
    [255, 190, 11],   // giallo
    [6, 173, 148],    // verde acqua
    [17, 138, 178],   // blu
    [131, 96, 195],   // viola
    [7, 137, 92]      // verde
  ];

  const pageNum = () => doc.getNumberOfPages();

  // ---- Helper: mescola un colore con il bianco per una tinta chiara (stampabile) ----
  function tintaChiara(c: RGB, quantitaBianco = 0.85): RGB {
    return [
      Math.round(c[0] + (255 - c[0]) * quantitaBianco),
      Math.round(c[1] + (255 - c[1]) * quantitaBianco),
      Math.round(c[2] + (255 - c[2]) * quantitaBianco)
    ];
  }

  // ---- Helper: sfondo pagina -----------------------------------------
  function sfondoPagina(): void {
    doc.setFillColor(...SFONDO);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  // ---- Helper: header minimale, coerente su tutte le pagine ----------
 function header(titolo: string, sottotitolo: string, accento: RGB): number {
  // Bordo colorato in alto
  doc.setFillColor(...accento);
  doc.rect(0, 0, PAGE_W, 3, 'F');

  // --- 1. TITOLO ---
  doc.setTextColor(...NERO);
  doc.setFont('helvetica', 'bold');

  // Divide il titolo in righe se supera la larghezza della pagina
  const righeTitolo: string[] = doc.splitTextToSize(titolo, CONTENT_W);
  const fontSizeTitolo = righeTitolo.length > 1 ? 12 : 15;
  doc.setFontSize(fontSizeTitolo);

  const yTitolo = 10; // Inizio del titolo dall'alto
  doc.text(righeTitolo, MARGIN, yTitolo);

  // Calcola l'altezza effettiva occupata dal titolo in mm
  const altezzaTitolo = righeTitolo.length * (fontSizeTitolo * 0.45);

  // --- 2. SOTTOTITOLO (Calcolato dinamicamente SOTTO il titolo) ---
  const ySottotitolo = yTitolo + altezzaTitolo + 3; // +3mm di spazio dal titolo

  doc.setTextColor(...GRIGIO);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const righeSottotitolo: string[] = doc.splitTextToSize(sottotitolo, CONTENT_W);
  doc.text(righeSottotitolo, MARGIN, ySottotitolo);

  // Calcola l'altezza occupata dal sottotitolo
  const altezzaSottotitolo = righeSottotitolo.length * (9 * 0.45);

  // Restituisce il punto Y esatto dove può iniziare la tabella (+6mm di stacco)
  return ySottotitolo + altezzaSottotitolo + 6;
}

  // ---- Helper: footer coerente, staccato dal bordo ---------------------
  function footer(): void {
    doc.setDrawColor(...GRIGIO_CHIARO);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - FOOTER_H, PAGE_W - MARGIN, PAGE_H - FOOTER_H);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIGIO);
    doc.text('Educazione Digitale Familiare', MARGIN, PAGE_H - FOOTER_H + 7);
    doc.text('Pag. ' + pageNum(), PAGE_W - MARGIN, PAGE_H - FOOTER_H + 7, { align: 'right' });
  }

  function nuovaPagina(titolo: string, sottotitolo: string, accento: RGB): number {
  doc.addPage();
  return header(titolo, sottotitolo, accento);
}

  // ---- Helper: card con bordo arrotondato + striscia di accento ------
  function card(x: number, y: number, w: number, h: number, accento: RGB): void {
    doc.setFillColor(...BIANCO);
    doc.setDrawColor(...GRIGIO_CHIARO);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

    // striscia colorata laterale (indica la categoria/sezione)
    doc.setFillColor(...accento);
    doc.roundedRect(x, y, 2.2, h, 1.1, 1.1, 'F');
  }

  // Riquadro informativo finale richiesto
  function riquadroFinale(yStart: number): number {
    const testo =
      'Le regole e le attività proposte rappresentano suggerimenti basati sulle evidenze ' +
      'scientifiche. Ogni famiglia può modificare, eliminare o adattare le regole e le ' +
      'attività in base alle proprie esigenze, possibilità e contesto familiare. ' +
      "L'obiettivo è costruire un patto digitale realmente sostenibile.";

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const lines = doc.splitTextToSize(testo, CONTENT_W - 16);
    const boxH = lines.length * 4.6 + 14;

    let y = yStart;
    if (y + boxH > CONTENT_BOTTOM) {
      footer();
      nuovaPagina('NOTA', 'Informazioni utili sul patto digitale', PRIMARIO_CHIARO as RGB);
      y = HEADER_H + 10;
    }

    doc.setFillColor(...PRIMARIO_CHIARO);
    doc.setDrawColor(...PRIMARIO);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARIO);
    doc.text('Nota', MARGIN + 8, y + 8);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...NERO);
    doc.text(lines, MARGIN + 8, y + 14);

    return y + boxH;
  }

  // =====================================================================
  // PAGINA 1 — Poster delle regole scelte: colorato, a misura di bambino,
  // e vincolato a stare TUTTO su una sola pagina (nessun overflow).
  // =====================================================================
  sfondoPagina();
  header('LE TUE REGOLE PERSONALIZZATE', 'Il patto che abbiamo scelto insieme per usare bene la tecnologia', PRIMARIO);

  interface RegolaPoster { cat: string; nome: string; desc: string; colore: RGB; }

  const tutteLeRegole: RegolaPoster[] = [];
  const regoleGiaViste = new Set<string>();
  const coloreCategoria = new Map<string, RGB>();
  let coloreIndex = 0;

  pattoStruttura.forEach(categoria => {
    const catName = categoria.info.nome || categoria.id;
    if (!coloreCategoria.has(categoria.id)) {
      coloreCategoria.set(categoria.id, PALETTE_DIVERTENTE[coloreIndex % PALETTE_DIVERTENTE.length]);
      coloreIndex++;
    }
    const colore = coloreCategoria.get(categoria.id)!;

    categoria.regole.forEach(regola => {
      const chiave = categoria.id + '::' + regola.nome;
      if (regoleGiaViste.has(chiave)) return;
      regoleGiaViste.add(chiave);

      // Descrizione presa dal database delle regole (fallback sui dati già caricati)
      const descrizioneDb = this.tutteLeRegoleDB[regola.nome]?.descrizione || regola.dati.descrizione || '';
      tutteLeRegole.push({ cat: catName, nome: regola.nome || '', desc: descrizioneDb, colore });
    });
  });

  const AREA_DISPONIBILE = CONTENT_BOTTOM - (HEADER_H + 6);
  const N = tutteLeRegole.length;
  const STRISCIA_W = 4;               // fascia laterale colorata, ben visibile
  const PAD_SX = STRISCIA_W + 5;
  const PAD_DX = 8;                   // spazio per il pallino decorativo in alto a destra
  const COL_GAP = 6;                  // spazio tra le due colonne, quando servono
  const TESTO_SCURO: RGB = [55, 58, 64];

  // Dimensioni "a piena scala" (scale = 1) e dimensioni minime leggibili
  // (scale = 0): tutti i valori vengono interpolati fra questi due estremi.
  // Il minimo non è mai troppo piccolo: le regole devono restare leggibili
  // anche da lontano, per questo esiste anche la seconda colonna qui sotto.
  const BASE = { pill: 8, titolo: 13, desc: 9.5, gap: 5, padTop: 5, padBottom: 4, gapPillTitolo: 2.6, gapTitoloDesc: 2.2 };
  const MIN = { pill: 5, titolo: 8, desc: 6, gap: 1.2, padTop: 2.6, padBottom: 2, gapPillTitolo: 1.2, gapTitoloDesc: 1 };
  const SOGLIA_LEGGIBILITA = 0.55; // sotto questa scala il testo è considerato troppo piccolo

  type Taglia = typeof BASE;
  function taglia(scale: number): Taglia {
    const s = Math.max(0, Math.min(1, scale));
    const mix = (base: number, min: number) => min + (base - min) * s;
    return {
      pill: mix(BASE.pill, MIN.pill),
      titolo: mix(BASE.titolo, MIN.titolo),
      desc: mix(BASE.desc, MIN.desc),
      gap: mix(BASE.gap, MIN.gap),
      padTop: mix(BASE.padTop, MIN.padTop),
      padBottom: mix(BASE.padBottom, MIN.padBottom),
      gapPillTitolo: mix(BASE.gapPillTitolo, MIN.gapPillTitolo),
      gapTitoloDesc: mix(BASE.gapTitoloDesc, MIN.gapTitoloDesc)
    };
  }

  // Tronca il testo a un numero massimo di righe aggiungendo i puntini di
  // sospensione, per gli scenari estremi in cui il font minimo non basta.
  function testoTroncato(testo: string, larghezza: number, maxRighe: number): string[] {
    const righe: string[] = doc.splitTextToSize(testo, larghezza);
    if (maxRighe <= 0 || righe.length === 0) return [];
    if (righe.length <= maxRighe) return righe;
    const troncate = righe.slice(0, maxRighe);
    let ultima = troncate[maxRighe - 1];
    while (ultima.length > 1 && doc.getTextWidth(ultima + '…') > larghezza) {
      ultima = ultima.slice(0, -1);
    }
    troncate[maxRighe - 1] = ultima.trimEnd() + '…';
    return troncate;
  }

  // Calcola il layout completo (misure + posizioni) di una card.
  function layoutCard(t: Taglia, r: RegolaPoster, larghezzaTesto: number, maxRigheDesc: number) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(t.titolo);
    const nomeLines = doc.splitTextToSize(r.nome, larghezzaTesto);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(t.desc);
    const descLines = r.desc ? testoTroncato(r.desc, larghezzaTesto, maxRigheDesc) : [];

    const pillH = t.pill + 2.6;
    const rigaTitolo = t.titolo * 0.42 + 1.1;
    const rigaDesc = t.desc * 0.42 + 1;

    const yPill = t.padTop;
    const yTitolo = yPill + pillH + t.gapPillTitolo;
    const yDesc = yTitolo + nomeLines.length * rigaTitolo + t.gapTitoloDesc;

    const fineContenuto = descLines.length
      ? yDesc + descLines.length * rigaDesc
      : yTitolo + nomeLines.length * rigaTitolo;

    return { nomeLines, descLines, pillH, yPill, yTitolo, yDesc, h: fineContenuto + t.padBottom };
  }

  // Divide le regole su una o più colonne: la prima colonna si riempie
  // dall'alto in basso, poi la seconda, come un poster/giornale.
  function dividiInColonne(colonne: number): RegolaPoster[][] {
    const righePerColonna = Math.ceil(N / colonne);
    const gruppi: RegolaPoster[][] = [];
    for (let i = 0; i < colonne; i++) {
      gruppi.push(tutteLeRegole.slice(i * righePerColonna, (i + 1) * righePerColonna));
    }
    return gruppi.filter(g => g.length > 0);
  }

  function altezzaMassimaColonne(t: Taglia, larghezzaTesto: number, maxRigheDesc: number, gruppi: RegolaPoster[][]): number {
    return gruppi.reduce((max, gruppo) => {
      const somma = gruppo.reduce((tot, r) => tot + layoutCard(t, r, larghezzaTesto, maxRigheDesc).h, 0);
      return Math.max(max, somma + t.gap * Math.max(0, gruppo.length - 1));
    }, 0);
  }

  // Ricerca binaria della scala di testo più grande possibile che permette a
  // tutte le colonne di entrare nell'area disponibile.
  function scalaMassima(larghezzaTesto: number, maxRigheDesc: number, gruppi: RegolaPoster[][]): number | null {
    if (altezzaMassimaColonne(taglia(1), larghezzaTesto, maxRigheDesc, gruppi) <= AREA_DISPONIBILE) return 1;
    if (altezzaMassimaColonne(taglia(0), larghezzaTesto, maxRigheDesc, gruppi) > AREA_DISPONIBILE) return null;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 25; i++) {
      const mid = (lo + hi) / 2;
      if (altezzaMassimaColonne(taglia(mid), larghezzaTesto, maxRigheDesc, gruppi) <= AREA_DISPONIBILE) lo = mid; else hi = mid;
    }
    return lo;
  }

  // Per un dato numero di colonne, cerca il miglior compromesso: la
  // descrizione più completa possibile SENZA scendere sotto la soglia di
  // leggibilità; se proprio non basta, il compromesso più leggibile trovato.
  const LIVELLI_RIGHE_DESC = [999, 4, 3, 2, 1, 0];
  function valutaLayout(colonne: number) {
    const cardW = (CONTENT_W - (colonne - 1) * COL_GAP) / colonne;
    const larghezzaTesto = cardW - PAD_SX - PAD_DX;
    const gruppi = dividiInColonne(colonne);

    let migliore = { righeDesc: 0, scala: 0 };
    for (const livello of LIVELLI_RIGHE_DESC) {
      const s = scalaMassima(larghezzaTesto, livello, gruppi);
      if (s === null) continue;
      if (s > migliore.scala) migliore = { righeDesc: livello, scala: s };
      if (s >= SOGLIA_LEGGIBILITA) break;
    }
    return { colonne, cardW, larghezzaTesto, gruppi, scala: migliore.scala, righeDesc: migliore.righeDesc };
  }

  // Valuta 1 e 2 colonne e sceglie quella più leggibile: poche regole restano
  // su una sola colonna, tante regole passano automaticamente a due colonne
  // invece di rimpicciolire troppo il testo.
  const opzioni = [valutaLayout(1), valutaLayout(2)];
  const scelta = opzioni.reduce((migliore, opz) => (opz.scala > migliore.scala + 0.02 ? opz : migliore), opzioni[0]);
  const tagliaScelta = taglia(scelta.scala);

  scelta.gruppi.forEach((gruppo, colIndex) => {
    const colX = MARGIN + colIndex * (scelta.cardW + COL_GAP);
    let y = HEADER_H + 6;

    gruppo.forEach(r => {
      const layout = layoutCard(tagliaScelta, r, scelta.larghezzaTesto, scelta.righeDesc);

      // Card con tinta pastello del colore della categoria: colorata ma stampabile
      const tinta = tintaChiara(r.colore, 0.88);
      doc.setFillColor(...tinta);
      doc.setDrawColor(...r.colore);
      doc.setLineWidth(0.5);
      doc.roundedRect(colX, y, scelta.cardW, layout.h, 3.5, 3.5, 'FD');

      // Fascia laterale piena e ben visibile
      doc.setFillColor(...r.colore);
      doc.roundedRect(colX, y, STRISCIA_W, layout.h, STRISCIA_W / 2, STRISCIA_W / 2, 'F');

      // Pallino decorativo in alto a destra (tocco allegro, nessun numero)
      doc.setFillColor(...r.colore);
      doc.circle(colX + scelta.cardW - 6, y + 6, 2.2, 'F');

      const textX = colX + PAD_SX;

      // Pillola colorata con il nome della categoria
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(tagliaScelta.pill);
      const pillTesto = r.cat.toUpperCase();
      const pillW = doc.getTextWidth(pillTesto) + 6;
      doc.setFillColor(...r.colore);
      doc.roundedRect(textX, y + layout.yPill, pillW, layout.pillH, layout.pillH / 2, layout.pillH / 2, 'F');
      doc.setTextColor(...BIANCO);
      doc.text(pillTesto, textX + pillW / 2, y + layout.yPill + layout.pillH / 2 + tagliaScelta.pill * 0.32, { align: 'center' });

      // Nome della regola: grande, in grassetto, ben in vista
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(tagliaScelta.titolo);
      doc.setTextColor(...NERO);
      doc.text(layout.nomeLines, textX, y + layout.yTitolo + tagliaScelta.titolo * 0.32);

      // Descrizione della regola, presa dal database
      if (layout.descLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(tagliaScelta.desc);
        doc.setTextColor(...TESTO_SCURO);
        doc.text(layout.descLines, textX, y + layout.yDesc + tagliaScelta.desc * 0.32);
      }

      y += layout.h + tagliaScelta.gap;
    });
  });

  footer();

  // =====================================================================
  // PAGINA 2 — Tutte le regole consigliate (tabella)
  // =====================================================================
  nuovaPagina('TUTTE LE REGOLE CHE TI ABBIAMO CONSIGLIATO', 'Qui trovi tutte le regole che potresti applicare, anche quelle che non hai selezionato, in caso volessi ripescarle ', ACCENTO.consigliate);
  const righeConsigliate: string[][] = [];
  const consigliateViste = new Set<string>();
  pattoOriginale.forEach(categoria => {
    const catName = categoria.info.nome || categoria.id;
    categoria.regole.forEach(regola => {
      const chiave = categoria.id + '::' + regola.nome;
      if (consigliateViste.has(chiave)) return;
      consigliateViste.add(chiave);
      righeConsigliate.push([
        catName,
        regola.nome || '',
        regola.dati.descrizione || '',
        regola.dati.raccomandazione || ''
      ]);
    });
  });

  autoTable(doc, {
    startY: HEADER_H + 6,
    head: [['Categoria', 'Regola', 'Descrizione', 'Raccomandazione']],
    body: righeConsigliate,
    theme: 'grid',
    headStyles: { fillColor: ACCENTO.consigliate, textColor: BIANCO, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 8.5, textColor: NERO, valign: 'top', lineColor: GRIGIO_CHIARO, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: SFONDO },
    columnStyles: {
      0: { cellWidth: 33, fontStyle: 'bold' },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 65 },
      3: { cellWidth: CONTENT_W - 33 - 40 - 65 }
    },
    margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_H + 4, top: HEADER_H },
    didDrawPage: () => footer()
  });

  // =====================================================================
  // PAGINA 3 — Attività
  // =====================================================================
  nuovaPagina('LE ATTIVITÀ CHE HAI SCELTO', 'Esercizi pratici da fare insieme in famiglia. Queste attività fanno riferimento alle regole che hai scelto', ACCENTO.attivita);
  const GAP = 3;

  interface AttivitaPoster { catName: string; regolaNome: string; att: Attivita; colore: RGB; }
  const tutteLeAttivita: AttivitaPoster[] = [];
  pattoStruttura.forEach(categoria => {
    if (categoria.regole.length === 0) return;
    const catName = categoria.info.nome || categoria.id;
    const colore = coloreCategoria.get(categoria.id) || ACCENTO.attivita;
    categoria.regole.forEach(regola => {
      if (!regola.attivita || regola.attivita.length === 0) return;
      regola.attivita.forEach(att => {
        tutteLeAttivita.push({ catName, regolaNome: regola.nome, att, colore });
      });
    });
  });

  // Layout a 2 colonne fisse: ogni card va nella colonna più corta al
  // momento (impaginazione "a mattoncini"), per non sprecare spazio.
  const COL_GAP2 = 6;
  const CARD_W2 = (CONTENT_W - COL_GAP2) / 2;
  const colX2 = [MARGIN, MARGIN + CARD_W2 + COL_GAP2];
  let colY2 = [HEADER_H + 6, HEADER_H + 6];

  tutteLeAttivita.forEach(({ catName, regolaNome, att, colore }) => {
    const descLines = doc.splitTextToSize(att.descrizione || '', CARD_W2 - 12);
    const info = [
      att.eta ? 'Età: ' + att.eta : '',
      att.durata ? 'Durata: ' + att.durata : '',
      att.frequenza ? 'Frequenza: ' + att.frequenza : ''
    ].filter(Boolean).join('   ');
    const cardH2 = (info ? 21 : 17) + descLines.length * 4;

    let col = colY2[0] <= colY2[1] ? 0 : 1;
    if (colY2[col] + cardH2 > CONTENT_BOTTOM) {
      const altra = col === 0 ? 1 : 0;
      if (colY2[altra] + cardH2 <= CONTENT_BOTTOM) {
        col = altra;
      } else {
        footer();
        nuovaPagina('LE NOSTRE ATTIVITÀ (continua)', 'Esercizi pratici da fare insieme in famiglia', ACCENTO.attivita);
        colY2 = [HEADER_H + 6, HEADER_H + 6];
        col = 0;
      }
    }

    const x = colX2[col];
    const y2 = colY2[col];

    card(x, y2, CARD_W2, cardH2, colore);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colore);
    doc.text((catName + ' · ' + regolaNome).toUpperCase(), x + 6, y2 + 6);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NERO);
    doc.text(att.nome || '', x + 6, y2 + 13);

    if (info) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRIGIO);
      doc.text(info, x + 6, y2 + 18);
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIGIO);
    doc.text(descLines, x + 6, y2 + (info ? 23 : 18));

    colY2[col] += cardH2 + GAP;
  });

  footer();

  // =====================================================================
  // PAGINA 4 — Tutte le raccomandazioni
  // =====================================================================
  const tutteRaccomandazioni: string[][] = [];
  Object.entries(this.tutteLeRaccomandazioniDB || {}).forEach(([nome, racc]) => {
    tutteRaccomandazioni.push([nome, racc.descrizione || '']);
  });

  if (tutteRaccomandazioni.length > 0) {
    // Salviamo la Y esatta restituita da nuovaPagina
    const yTabella = nuovaPagina(
      'Le Raccomandazioni di Milano sul benessere e la sicurezza online',
      'Tutte le regole che proponiamo in questo progetto fanno riferimento a queste raccomandazioni',
      ACCENTO.raccomandazioni
    );

    autoTable(doc, {
      startY: yTabella, // La tabella parte esattamente sotto il sottotitolo!
      head: [['Raccomandazione', 'Descrizione']],
      body: tutteRaccomandazioni,
      theme: 'grid',
      pageBreak: 'auto',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: NERO,
        valign: 'top',
        lineColor: GRIGIO_CHIARO,
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: ACCENTO.raccomandazioni,
        textColor: BIANCO,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center'
      },
      alternateRowStyles: { fillColor: SFONDO },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: 'bold' },
        1: { cellWidth: CONTENT_W - 48 }
      },
      margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_H + 4, top: HEADER_H },
      didDrawPage: () => footer()
    });
  }

  // =====================================================================
  // PAGINA 5 — Tutte le regole del database
  // =====================================================================
  const tutteRegole: string[][] = [];
  Object.entries(this.tutteLeRegoleDB || {}).forEach(([nome, regola]) => {
    tutteRegole.push([nome, regola.descrizione || '']);
  });

  if (tutteRegole.length > 0) {
    nuovaPagina('TUTTE LE REGOLE DISPONIBILI',
    'Questa sezione raccoglie tutte le regole presenti nel database che il sistema può suggerire. Ogni famiglia riceverà solo le regole più adatte alla propria situazione.', ACCENTO.dbRegole);

    autoTable(doc, {
      startY: HEADER_H + 6,
      head: [['Regola', 'Descrizione']],
      body: tutteRegole,
      theme: 'grid',
      headStyles: { fillColor: ACCENTO.dbRegole, textColor: BIANCO, fontStyle: 'bold', fontSize: 10, halign: 'center' },
      bodyStyles: { fontSize: 8.5, textColor: NERO, valign: 'top', lineColor: GRIGIO_CHIARO, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: SFONDO },
      columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: CONTENT_W - 48 } },
      margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_H + 4, top: HEADER_H },
      didDrawPage: () => footer()
    });
  }

  doc.save('patto_familiare.pdf');}}