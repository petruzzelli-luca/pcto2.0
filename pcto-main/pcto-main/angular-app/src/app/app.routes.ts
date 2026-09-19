import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Risultati } from './pages/risultati/risultati';
import { Test } from './pages/test/test';
import { TestRisultati } from './pages/test-risultati/test-risultati';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'risultati', component: Risultati },
  { path: 'test', component: Test },
  { path: 'test-risultati', component: TestRisultati },
  { path: '**', redirectTo: '' }
];
