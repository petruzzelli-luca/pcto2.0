import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { DataService, DomandaTest } from '../../services/data.service';

@Component({
  selector: 'app-test',
  imports: [RouterLink],
  templateUrl: './test.html',
  styleUrl: './test.css'
})
export class Test implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  loading = signal(true);
  errore = signal<string | null>(null);
  nessunaDomanda = signal(false);
  domande = signal<DomandaTest[]>([]);
  current = signal(0);

  private risposteRegole: string[] = [];

  ngOnInit(): void {
    this.carica();
  }

  indietro(): void {
    this.location.back();
  }

  get progress(): number {
    const tot = this.domande().length;
    return tot > 0 ? (this.current() / tot) * 100 : 0;
  }

  get domandaCorrente(): DomandaTest | null {
    return this.domande()[this.current()] ?? null;
  }

  private async carica(): Promise<void> {
    try {
      const categorieParam = this.route.snapshot.queryParamMap.get('categorie');
      const categoriaParam = this.route.snapshot.queryParamMap.get('categoria');

      const data = await this.data.getTestIniziale();
      const tutte = data.test || [];

      let domande: DomandaTest[];
      if (categorieParam) {
        const categorie: string[] = JSON.parse(categorieParam);
        domande = tutte.filter(d => d.categoria && categorie.some(c => c.toLowerCase() === d.categoria.toLowerCase()));
      } else if (categoriaParam) {
        domande = tutte.filter(d => d.categoria && d.categoria.toLowerCase() === categoriaParam.toLowerCase());
      } else {
        domande = tutte;
      }

      if (domande.length === 0) {
        this.nessunaDomanda.set(true);
        this.loading.set(false);
        return;
      }
      this.domande.set(domande);
      this.loading.set(false);
    } catch (e: any) {
      this.errore.set(e?.message || 'errore sconosciuto');
      this.loading.set(false);
    }
  }

  rispondi(regola: string): void {
    if (regola) this.risposteRegole.push(regola);
    this.current.update(c => c + 1);
    if (this.current() >= this.domande().length) {
      this.mostraRisultati();
    }
  }

  private mostraRisultati(): void {
    const queryParams: Record<string, string> = { regole: JSON.stringify(this.risposteRegole) };
    const categorieParam = this.route.snapshot.queryParamMap.get('categorie');
    if (categorieParam) queryParams['categorie'] = categorieParam;
    this.router.navigate(['/test-risultati'], { queryParams });
  }
}
