import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';

interface RisultatoCard {
  id: string;
  nome: string;
  descrizione: string;
  link: string;
  expanded: boolean;
}

@Component({
  selector: 'app-risultati',
  imports: [RouterLink],
  templateUrl: './risultati.html',
  styleUrl: './risultati.css'
})
export class Risultati implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  errore = signal(false);
  risultati = signal<RisultatoCard[]>([]);
  categorieIds = signal<string[]>([]);

  ngOnInit(): void {
    this.carica();
  }

  private async carica(): Promise<void> {
    try {
      const raw = this.route.snapshot.queryParamMap.get('data');
      if (!raw) throw new Error('Parametro data mancante');
      const parsed: { id: string; nome: string; descrizione: string }[] = JSON.parse(raw);
      const categorie = await this.data.getCategorie();

      const ids: string[] = [];
      const cards: RisultatoCard[] = parsed.map(r => {
        ids.push(r.id);
        const info = categorie[r.id] || ({} as any);
        return {
          id: r.id,
          nome: info.nome || r.nome,
          descrizione: info.descrizione || r.descrizione,
          link: info.link || '',
          expanded: false
        };
      });
      this.categorieIds.set(ids);
      this.risultati.set(cards);
      this.loading.set(false);
    } catch (e) {
      this.errore.set(true);
      this.loading.set(false);
    }
  }

  toggle(card: RisultatoCard): void {
    this.risultati.update(list => list.map(c => (c === card ? { ...c, expanded: !c.expanded } : c)));
  }

  get pattoQueryParams(): Record<string, string> {
    return { categorie: JSON.stringify(this.categorieIds()) };
  }
}
