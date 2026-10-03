import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';
import { verifySite } from './verify-site.js';

/**
 * Exerce la reprise d'une vraie archive locale, sans modifier le site original.
 * @param {string} site - Site vérifiable
 * @param {string|null} commit - Commit attendu
 * @returns {object} Résultat de la restauration
 */
export function exerciseArtifactRecovery(site, commit = null) {
  verifySite(site, commit);
  const temporary = mkdtempSync(join(tmpdir(), 'playlab-recovery-'));
  try {
    const archive = join(temporary, 'site.tar');
    const restored = join(temporary, 'restored');
    mkdirSync(restored);
    execFileSync('tar', ['-cf', archive, '-C', site, '.']);
    execFileSync('tar', ['-xf', archive, '-C', restored]);
    verifySite(restored, commit);
    writeFileSync(join(restored, 'index.html'), 'corruption volontaire du seul exercice local');
    let detected = false;
    try {
      verifySite(restored, commit);
    } catch (error) {
      if (!error.message.startsWith('Intégrité')) {throw error;}
      detected = true;
    }
    if (!detected) {throw new Error('La corruption locale n’a pas été détectée.');}
    execFileSync('tar', ['-xf', archive, '-C', restored]);
    const result = verifySite(restored, commit);
    return result;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = exerciseArtifactRecovery(join(getRootDir(import.meta.url), 'site'), process.env.GITHUB_SHA || null);
    console.log(`Reprise locale exercée : corruption refusée, archive restaurée, ${result.checked} fichiers vérifiés.`);
  } catch (error) {
    console.error(`Exercice de reprise échoué : ${error.message}`);
    process.exitCode = 1;
  }
}
