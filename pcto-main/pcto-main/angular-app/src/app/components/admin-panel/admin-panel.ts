import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  DataService,
  AppData,
  Categoria,
  Regola,
  Attivita,
  DomandaTest,
  Raccomandazione,
  Keyword,
  HomeTexts,
  DEFAULT_HOME_TEXTS
} from '../../services/data.service';

type TabType = 'categorie' | 'regole' | 'attivita' | 'test' | 'raccomandazioni' | 'keywords' | 'homeTexts';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css'
})
export class AdminPanel implements OnInit, OnDestroy {
  readonly dataService = inject(DataService);
  private sub = new Subscription();

  // Stato visibilità
  readonly sidebarOpen = signal<boolean>(false);
  readonly activeTab = signal<TabType>('categorie');
  readonly filterQuery = signal<string>('');

  // Dati di lavoro locali (copia modificabile in tempo reale)
  data = signal<AppData>({
    categories: {},
    keywords: [],
    testQuestions: [],
    rules: {},
    activities: {},
    recommendations: {},
    homeTexts: { ...DEFAULT_HOME_TEXTS }
  });

  // Modal editor generico
  readonly editModalOpen = signal<boolean>(false);
  readonly currentEntity = signal<TabType | null>(null);
  readonly isNewItem = signal<boolean>(false);
  readonly originalKey = signal<string>('');

  // Conferma eliminazione
  readonly confirmDeleteModal = signal<{ type: TabType; key: string; title: string } | null>(null);

  // Toast e feedback
  readonly toast = signal<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  private toastTimeout: any = null;

  // Paginazione per le parole chiave (~1400 righe)
  readonly keywordsPage = signal<number>(1);
  readonly keywordsPerPage = 30;

  // Modelli per i form di modifica
  categoryForm = { id: '', categoria: '', nome: '', descrizione: '', link: '' };
  ruleForm = { nome: '', descrizione: '', icona: '📵', categorie: [] as string[], raccomandazione: '', linkRaccomandazione: '' };
  activityForm = { nome: '', regola: '', descrizione: '', eta: '', durata: '', frequenza: '', approccio: '' };
  questionForm = { domanda: '', categoria: '', se_si: '', se_no: '' };
  recForm = { nome: '', descrizione: '', link: '' };
  keywordForm = { preoccupazione: '', categorie: [] as string[] };
  homeTextsForm: HomeTexts = { ...DEFAULT_HOME_TEXTS };

  // Emoji veloci per le regole
  readonly commonEmojis = ['📵', '⏰', '🌙', '🛡️', '🤝', '👨‍👩‍👧', '📚', '🧘', '💬', '🚫', '🔐', '🎯', '💡', '⚖️', '📌'];

  // Liste computate per i dropdown relazionali
  readonly categoryList = computed(() => Object.values(this.data().categories));
  readonly ruleList = computed(() => Object.values(this.data().rules));
  readonly recommendationList = computed(() => Object.values(this.data().recommendations));
  readonly activityCount = computed(() => Object.keys(this.data().activities).length);

  // Liste filtrate dalla ricerca
  readonly filteredCategories = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = Object.values(this.data().categories);
    if (!q) return list;
    return list.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.categoria.toLowerCase().includes(q) ||
      c.descrizione.toLowerCase().includes(q)
    );
  });

  readonly filteredRules = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = Object.values(this.data().rules);
    if (!q) return list;
    return list.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      r.descrizione.toLowerCase().includes(q) ||
      r.raccomandazione.toLowerCase().includes(q) ||
      r.categorie.some(cat => cat.toLowerCase().includes(q))
    );
  });

  readonly filteredActivities = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = Object.values(this.data().activities);
    if (!q) return list;
    return list.filter(a =>
      a.nome.toLowerCase().includes(q) ||
      a.regola.toLowerCase().includes(q) ||
      a.descrizione.toLowerCase().includes(q) ||
      a.eta.toLowerCase().includes(q)
    );
  });

  readonly filteredQuestions = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = this.data().testQuestions;
    if (!q) return list;
    return list.filter(t =>
      t.domanda.toLowerCase().includes(q) ||
      t.categoria.toLowerCase().includes(q) ||
      t.se_no.toLowerCase().includes(q)
    );
  });

  readonly filteredRecommendations = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = Object.values(this.data().recommendations);
    if (!q) return list;
    return list.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      r.descrizione.toLowerCase().includes(q)
    );
  });

  readonly allFilteredKeywords = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    const list = this.data().keywords;
    if (!q) return list;
    return list.filter(k =>
      k.preoccupazione.toLowerCase().includes(q) ||
      k.categorie.some(c => c.toLowerCase().includes(q))
    );
  });

  readonly paginatedKeywords = computed(() => {
    const all = this.allFilteredKeywords();
    const page = this.keywordsPage();
    const start = (page - 1) * this.keywordsPerPage;
    return all.slice(start, start + this.keywordsPerPage);
  });

  readonly totalKeywordsPages = computed(() => {
    const count = this.allFilteredKeywords().length;
    return Math.max(1, Math.ceil(count / this.keywordsPerPage));
  });

  async ngOnInit(): Promise<void> {
    await this.caricaDati();
    this.sub.add(
      this.dataService.dataChanged$.subscribe(d => {
        this.data.set(JSON.parse(JSON.stringify(d)));
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  async caricaDati(): Promise<void> {
    const res = await this.dataService.getAppData();
    this.data.set(JSON.parse(JSON.stringify(res.data)));
    this.homeTextsForm = { ...this.data().homeTexts };
  }

  showToast(message: string, type: 'success' | 'info' | 'warning' = 'success'): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toast.set({ message, type });
    this.toastTimeout = setTimeout(() => this.toast.set(null), 4000);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  openTab(tab: TabType): void {
    this.activeTab.set(tab);
    this.filterQuery.set('');
    this.keywordsPage.set(1);
    if (!this.sidebarOpen()) {
      this.sidebarOpen.set(true);
    }
  }

  // BOTTONE 1: SALVA TUTTE LE MODIFICHE
  saveAllChanges(): void {
    this.dataService.saveAdminData(this.data());
    this.showToast('✅ Tutte le modifiche sono state salvate con successo!', 'success');
  }

  async resetToLastSaved(): Promise<void> {
    const restored = await this.dataService.resetToLastSaved();
    this.data.set(JSON.parse(JSON.stringify(restored)));
    this.homeTextsForm = { ...restored.homeTexts };
    this.showToast('↺ Modifiche non salvate annullate.', 'info');
  }

  // BOTTONE 2: TORNA ALL'APPLICAZIONE NORMALE
  exitAdminMode(): void {
    if (this.dataService.hasUnsavedChanges()) {
      const confirmExit = confirm('Ci sono modifiche non salvate. Sei sicuro di voler uscire?');
      if (!confirmExit) return;
    }
    this.dataService.logout();
  }

  // UTILITÀ: SCARICA SNAPSHOT PER GITHUB
  downloadSnapshotForGitHub(): void {
    this.dataService.exportSnapshotJson();
    this.showToast('📥 File data-snapshot.json scaricato! Sostituiscilo in public/ e fai git push.', 'info');
  }

  // UTILITÀ: RIPRISTINA DATABASE ORIGINALE
  async resetToOriginal(): Promise<void> {
    const proceed = confirm('Sei sicuro di voler ripristinare il database allo stato iniziale? Tutte le modifiche salvate in memoria verranno eliminate.');
    if (!proceed) return;
    const restored = await this.dataService.resetToOriginalSnapshot();
    this.data.set(JSON.parse(JSON.stringify(restored)));
    this.homeTextsForm = { ...restored.homeTexts };
    this.showToast('↺ Database ripristinato allo stato iniziale.', 'info');
  }

  // GESTIONE FORM DI MODIFICA
  openAddModal(tab: TabType): void {
    this.currentEntity.set(tab);
    this.isNewItem.set(true);
    this.originalKey.set('');

    if (tab === 'categorie') {
      this.categoryForm = { id: '', categoria: '', nome: '', descrizione: '', link: '' };
    } else if (tab === 'regole') {
      this.ruleForm = {
        nome: '',
        descrizione: '',
        icona: '📵',
        categorie: this.categoryList()[0] ? [this.categoryList()[0].id] : [],
        raccomandazione: this.recommendationList()[0]?.nome || '',
        linkRaccomandazione: ''
      };
    } else if (tab === 'attivita') {
      this.activityForm = {
        nome: '',
        regola: this.ruleList()[0]?.nome || '',
        descrizione: '',
        eta: '10-16',
        durata: '1 mese',
        frequenza: 'settimanale',
        approccio: ''
      };
    } else if (tab === 'test') {
      this.questionForm = {
        domanda: '',
        categoria: this.categoryList()[0]?.id || '',
        se_si: '',
        se_no: this.ruleList()[0]?.nome || ''
      };
    } else if (tab === 'raccomandazioni') {
      this.recForm = { nome: '', descrizione: '', link: '' };
    } else if (tab === 'keywords') {
      this.keywordForm = {
        preoccupazione: '',
        categorie: this.categoryList()[0] ? [this.categoryList()[0].id] : []
      };
    }

    this.editModalOpen.set(true);
  }

  editCategory(cat: Categoria): void {
    this.currentEntity.set('categorie');
    this.isNewItem.set(false);
    this.originalKey.set(cat.id);
    this.categoryForm = { ...cat };
    this.editModalOpen.set(true);
  }

  editRule(rule: Regola): void {
    this.currentEntity.set('regole');
    this.isNewItem.set(false);
    this.originalKey.set(rule.nome);
    this.ruleForm = {
      nome: rule.nome,
      descrizione: rule.descrizione,
      icona: rule.icona || '📌',
      categorie: [...(rule.categorie || [])],
      raccomandazione: rule.raccomandazione || '',
      linkRaccomandazione: rule.linkRaccomandazione || ''
    };
    this.editModalOpen.set(true);
  }

  duplicateRule(rule: Regola): void {
    this.currentEntity.set('regole');
    this.isNewItem.set(true);
    this.originalKey.set('');
    this.ruleForm = {
      nome: `${rule.nome} (Copia)`,
      descrizione: rule.descrizione,
      icona: rule.icona || '📌',
      categorie: [...(rule.categorie || [])],
      raccomandazione: rule.raccomandazione || '',
      linkRaccomandazione: rule.linkRaccomandazione || ''
    };
    this.editModalOpen.set(true);
  }

  editActivity(act: Attivita): void {
    this.currentEntity.set('attivita');
    this.isNewItem.set(false);
    this.originalKey.set(act.nome);
    this.activityForm = { ...act };
    this.editModalOpen.set(true);
  }

  duplicateActivity(act: Attivita): void {
    this.currentEntity.set('attivita');
    this.isNewItem.set(true);
    this.originalKey.set('');
    this.activityForm = {
      ...act,
      nome: `${act.nome} (Copia)`
    };
    this.editModalOpen.set(true);
  }

  editQuestion(q: DomandaTest): void {
    this.currentEntity.set('test');
    this.isNewItem.set(false);
    this.originalKey.set(q.domanda);
    this.questionForm = { ...q };
    this.editModalOpen.set(true);
  }

  editRecommendation(rec: Raccomandazione): void {
    this.currentEntity.set('raccomandazioni');
    this.isNewItem.set(false);
    this.originalKey.set(rec.nome);
    this.recForm = { ...rec };
    this.editModalOpen.set(true);
  }

  editKeyword(kw: Keyword): void {
    this.currentEntity.set('keywords');
    this.isNewItem.set(false);
    this.originalKey.set(kw.preoccupazione);
    this.keywordForm = {
      preoccupazione: kw.preoccupazione,
      categorie: [...kw.categorie]
    };
    this.editModalOpen.set(true);
  }

  // Toggle categoria selezionata per regole o keywords
  toggleCategorySelection(list: string[], catId: string): void {
    const idx = list.indexOf(catId);
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.push(catId);
    }
  }

  saveEntity(): void {
    const tab = this.currentEntity();
    const currentData = { ...this.data() };

    if (tab === 'categorie') {
      const id = this.categoryForm.id.trim() || this.categoryForm.categoria.trim().toLowerCase().replace(/\s+/g, '-');
      if (!id || !this.categoryForm.nome.trim()) {
        alert('Compila almeno il nome e la categoria.');
        return;
      }
      const updatedCat: Categoria = {
        id,
        nome: this.categoryForm.nome.trim(),
        categoria: this.categoryForm.categoria.trim(),
        descrizione: this.categoryForm.descrizione.trim(),
        link: this.categoryForm.link.trim(),
        slug: id
      };
      if (!this.isNewItem() && this.originalKey() && this.originalKey() !== id) {
        delete currentData.categories[this.originalKey()];
      }
      currentData.categories[id] = updatedCat;
    } else if (tab === 'regole') {
      const nome = this.ruleForm.nome.trim();
      if (!nome) {
        alert('Il nome della regola è obbligatorio.');
        return;
      }
      const updatedRule: Regola = {
        nome,
        descrizione: this.ruleForm.descrizione.trim(),
        icona: this.ruleForm.icona.trim() || '📌',
        categorie: this.ruleForm.categorie,
        raccomandazione: this.ruleForm.raccomandazione,
        linkRaccomandazione: this.ruleForm.linkRaccomandazione.trim(),
        attivita: []
      };
      if (!this.isNewItem() && this.originalKey() && this.originalKey() !== nome) {
        delete currentData.rules[this.originalKey()];
      }
      currentData.rules[nome] = updatedRule;
    } else if (tab === 'attivita') {
      const nome = this.activityForm.nome.trim();
      if (!nome || !this.activityForm.regola) {
        alert('Il nome dell\'attività e la regola associata sono obbligatori.');
        return;
      }
      const updatedAct: Attivita = {
        nome,
        regola: this.activityForm.regola,
        descrizione: this.activityForm.descrizione.trim(),
        eta: this.activityForm.eta.trim(),
        durata: this.activityForm.durata.trim(),
        frequenza: this.activityForm.frequenza.trim(),
        approccio: this.activityForm.approccio.trim()
      };
      const key = `${updatedAct.regola}-${nome}`;
      if (!this.isNewItem() && this.originalKey() && this.originalKey() !== nome) {
        // Rimuovi la vecchia chiave se il nome è cambiato
        for (const k of Object.keys(currentData.activities)) {
          if (currentData.activities[k].nome === this.originalKey()) {
            delete currentData.activities[k];
          }
        }
      }
      currentData.activities[key] = updatedAct;
    } else if (tab === 'test') {
      const domanda = this.questionForm.domanda.trim();
      if (!domanda || !this.questionForm.categoria) {
        alert('La domanda e la categoria sono obbligatorie.');
        return;
      }
      const updatedQuestion: DomandaTest = {
        domanda,
        categoria: this.questionForm.categoria,
        se_si: this.questionForm.se_si,
        se_no: this.questionForm.se_no
      };
      if (this.isNewItem()) {
        currentData.testQuestions.push(updatedQuestion);
      } else {
        const idx = currentData.testQuestions.findIndex(q => q.domanda === this.originalKey());
        if (idx > -1) {
          currentData.testQuestions[idx] = updatedQuestion;
        } else {
          currentData.testQuestions.push(updatedQuestion);
        }
      }
    } else if (tab === 'raccomandazioni') {
      const nome = this.recForm.nome.trim();
      if (!nome) {
        alert('Il titolo della raccomandazione è obbligatorio.');
        return;
      }
      const updatedRec: Raccomandazione = {
        nome,
        descrizione: this.recForm.descrizione.trim(),
        link: this.recForm.link.trim()
      };
      if (!this.isNewItem() && this.originalKey() && this.originalKey() !== nome) {
        delete currentData.recommendations[this.originalKey()];
      }
      currentData.recommendations[nome] = updatedRec;
    } else if (tab === 'keywords') {
      const preoccupazione = this.keywordForm.preoccupazione.trim();
      if (!preoccupazione || this.keywordForm.categorie.length === 0) {
        alert('Inserisci una frase di ricerca e almeno una categoria collegata.');
        return;
      }
      const updatedKeyword: Keyword = {
        preoccupazione,
        categorie: this.keywordForm.categorie
      };
      if (this.isNewItem()) {
        currentData.keywords.unshift(updatedKeyword);
      } else {
        const idx = currentData.keywords.findIndex(k => k.preoccupazione === this.originalKey());
        if (idx > -1) {
          currentData.keywords[idx] = updatedKeyword;
        } else {
          currentData.keywords.unshift(updatedKeyword);
        }
      }
    }

    this.data.set(currentData);
    this.dataService.setUnsavedChanges(true);
    this.editModalOpen.set(false);
    this.showToast('Elemento aggiornato. Clicca "Salva modifiche" per rendere permanenti i cambiamenti.', 'info');
  }

  // GESTIONE MODIFICA TESTI HOME
  saveHomeTexts(): void {
    const currentData = { ...this.data() };
    currentData.homeTexts = { ...this.homeTextsForm };
    this.data.set(currentData);
    this.dataService.setUnsavedChanges(true);
    this.showToast('Testi della home aggiornati. Clicca "Salva modifiche" per confermare.', 'info');
  }

  // ELIMINAZIONE
  askDelete(type: TabType, key: string, title: string): void {
    this.confirmDeleteModal.set({ type, key, title });
  }

  cancelDelete(): void {
    this.confirmDeleteModal.set(null);
  }

  confirmDelete(): void {
    const toDelete = this.confirmDeleteModal();
    if (!toDelete) return;

    const currentData = { ...this.data() };
    const { type, key } = toDelete;

    if (type === 'categorie') {
      delete currentData.categories[key];
    } else if (type === 'regole') {
      delete currentData.rules[key];
    } else if (type === 'attivita') {
      for (const k of Object.keys(currentData.activities)) {
        if (currentData.activities[k].nome === key || k === key) {
          delete currentData.activities[k];
        }
      }
    } else if (type === 'test') {
      currentData.testQuestions = currentData.testQuestions.filter(q => q.domanda !== key);
    } else if (type === 'raccomandazioni') {
      delete currentData.recommendations[key];
    } else if (type === 'keywords') {
      currentData.keywords = currentData.keywords.filter(k => k.preoccupazione !== key);
    }

    this.data.set(currentData);
    this.dataService.setUnsavedChanges(true);
    this.confirmDeleteModal.set(null);
    this.showToast('Elemento eliminato.', 'warning');
  }

  // Navigazione keywords
  prevKeywordsPage(): void {
    if (this.keywordsPage() > 1) this.keywordsPage.update(p => p - 1);
  }

  nextKeywordsPage(): void {
    if (this.keywordsPage() < this.totalKeywordsPages()) this.keywordsPage.update(p => p + 1);
  }
}
