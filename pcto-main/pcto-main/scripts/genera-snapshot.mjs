#!/usr/bin/env node
// Scarica i dati dal Google Apps Script e li salva in
// angular-app/public/data-snapshot.json, che viene incluso nel bundle e
// servito come contenuto statico dello stesso dominio.
//
// Uso:
//   node scripts/genera-snapshot.mjs
//
// Eseguito automaticamente a ogni deploy dalla GitHub Action (deploy.yml),
// così lo snapshot resta sempre allineato con l'ultimo contenuto del foglio
// al momento del deploy, senza bisogno di aggiornarlo a mano.
//
// Se l'Apps Script non risponde: lo script NON fallisce la build, si limita
// ad avvisare e a lasciare lo snapshot esistente (se c'è) intatto. Meglio un
// deploy con dati leggermente vecchi che un sito che non si builda più solo
// perché lo Sheet è irraggiungibile in quel momento.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzm25VHhONFiJejy76iWiK5DjqlURt1JEWP3dPylKcrNmkUzn1mYY_zMsQ4UUIrPzM/exec';
const OUTPUT_PATH = path.join(__dirname, '..', 'angular-app', 'public', 'data-snapshot.json');
const TIMEOUT_MS = 15000;

async function fetchConTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  console.log('[genera-snapshot] scarico i dati da Apps Script...');
  let payload;
  try {
    payload = await fetchConTimeout(GOOGLE_APPS_SCRIPT_URL, TIMEOUT_MS);
  } catch (e) {
    console.warn(`[genera-snapshot] fetch fallito (${e.message}). Lascio lo snapshot esistente, se presente.`);
    if (!existsSync(OUTPUT_PATH)) {
      console.warn('[genera-snapshot] nessuno snapshot precedente trovato: il bundle partirà senza snapshot locale (solo fetch a runtime).');
    }
    process.exit(0); // non far fallire la build per un problema temporaneo dello Sheet
  }

  if (!payload || typeof payload !== 'object') {
    console.warn('[genera-snapshot] risposta vuota o non valida. Lascio lo snapshot esistente.');
    process.exit(0);
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload), 'utf-8');
  console.log(`[genera-snapshot] salvato in ${OUTPUT_PATH} (${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)`);
}

main();