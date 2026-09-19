import { Component, HostListener, OnInit, OnDestroy, inject, signal, computed, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DataService, Categoria, HomeTexts, DEFAULT_HOME_TEXTS } from '../../services/data.service';
import { AdminPanel } from '../../components/admin-panel/admin-panel';

const MAX_CAMPI = 3;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, AdminPanel],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  readonly data = inject(DataService);
  private router = inject(Router);
  private sub = new Subscription();

  @ViewChild(AdminPanel) adminPanel?: AdminPanel;

  // Categorie dinamiche
  categories = signal<Categoria[]>([]);

  // Testi modificabili della Home
  homeTexts = signal<HomeTexts>({ ...DEFAULT_HOME_TEXTS });

  // Stato Amministratore
  readonly isAdmin = computed(() => this.data.isAdmin());
  readonly showLoginModal = signal<boolean>(false);
  readonly loginUser = signal<string>('');
  readonly loginPass = signal<string>('');
  readonly loginError = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  // Campi di ricerca
  campi = signal<string[]>(['']);
  navbarHidden = signal(false);
  mobileMenuOpen = signal(false);

  activeInput = signal(-1);
  activeSuggestion = signal(-1);
  filtered = signal<string[]>([]);

  private lastY = 0;

  ngOnInit(): void {
    this.caricaDatiHome();

    // Ricarica i dati della Home ogni volta che l'amministratore effettua una modifica o salva
    this.sub.add(
      this.data.dataChanged$.subscribe(appData => {
        this.categories.set(Object.values(appData.categories));
        if (appData.homeTexts) {
          this.homeTexts.set({ ...appData.homeTexts });
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  async caricaDatiHome(): Promise<void> {
    try {
      const res = await this.data.getAppData();
      this.categories.set(Object.values(res.data.categories));
      if (res.data.homeTexts) {
        this.homeTexts.set({ ...res.data.homeTexts });
      }
    } catch {
      this.categories.set([]);
    }
  }

  // GESTIONE ACCESSO AMMINISTRATORE
  openAdminLogin(): void {
    this.loginUser.set('');
    this.loginPass.set('');
    this.loginError.set(null);
    this.showPassword.set(false);
    this.showLoginModal.set(true);
  }

  closeAdminLogin(): void {
    this.showLoginModal.set(false);
  }

  submitAdminLogin(): void {
    const user = this.loginUser().trim();
    const pass = this.loginPass().trim();

    const success = this.data.login(user, pass);
    if (success) {
      this.closeAdminLogin();
      // Scroll in cima per mostrare la barra amministratore
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.loginError.set('Credenziali non corrette. Riprova con username e password corretti.');
    }
  }

  // Scorciatoia per aprire la sezione di modifica testi nella sidebar
  editHomeSection(tab: 'categorie' | 'regole' | 'attivita' | 'test' | 'raccomandazioni' | 'keywords' | 'homeTexts' = 'homeTexts'): void {
    if (this.adminPanel) {
      this.adminPanel.openTab(tab);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const currentY = window.scrollY;
    this.navbarHidden.set(currentY > this.lastY && currentY > 60);
    this.lastY = currentY;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 768) {
      this.mobileMenuOpen.set(false);
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  get canAddCampo(): boolean {
    return this.campi().length < MAX_CAMPI;
  }

  aggiungiCampo(): void {
    if (!this.canAddCampo) return;
    this.campi.update(c => [...c, '']);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.search-big');
      inputs[inputs.length - 1]?.focus();
    });
  }

  updateCampo(index: number, value: string): void {
    this.campi.update(c => c.map((v, i) => (i === index ? value : v)));
    this.activeInput.set(index);
    this.updateFiltered(value);
  }

  onFocusCampo(index: number): void {
    this.activeInput.set(index);
    this.updateFiltered(this.campi()[index] || '');
  }

  onBlurCampo(): void {
    setTimeout(() => {
      this.activeInput.set(-1);
      this.filtered.set([]);
      this.activeSuggestion.set(-1);
    }, 150);
  }

  private updateFiltered(query: string): void {
    const q = query.trim();
    if (!q) {
      this.filtered.set([]);
      this.activeSuggestion.set(-1);
      return;
    }
    this.data.suggerisciKeywords(q).then(s => this.filtered.set(s));
    this.activeSuggestion.set(-1);
  }

  selectSuggestion(text: string): void {
    const idx = this.activeInput();
    if (idx < 0) return;
    this.campi.update(c => c.map((v, i) => (i === idx ? text : v)));
    this.filtered.set([]);
    this.activeSuggestion.set(-1);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.filtered();
    if (items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestion.update(i => Math.min(i + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestion.update(i => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      const i = this.activeSuggestion();
      if (i >= 0 && items[i]) {
        event.preventDefault();
        this.selectSuggestion(items[i]);
      }
    } else if (event.key === 'Escape') {
      this.filtered.set([]);
      this.activeSuggestion.set(-1);
    }
  }

  async doSearch(): Promise<void> {
    const queries = this.campi().map(v => v.trim()).filter(Boolean);
    if (queries.length === 0) return;
    const data = await this.data.searchCategories(queries);
    if (data.success && data.risultati.length > 0) {
      this.router.navigate(['/risultati'], { queryParams: { data: JSON.stringify(data.risultati) } });
    } else {
      alert('Nessuna categoria trovata. Prova con parole diverse.');
    }
  }
}