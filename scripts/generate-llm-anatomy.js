/**
 * Génération éditoriale explicite du HTML statique, sans changer le build global.
 * Sources : chapters.js, glossary.json. Exécuter dans Docker.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chapters, references, chapterTerms } from '../parcours/epics/anatomie-llm/_shared/chapters.js';
import { readingDiagrams, codeReadings } from '../parcours/epics/anatomie-llm/_shared/reading-aids.js';

const root = new URL('../parcours/epics/anatomie-llm/', import.meta.url);
const glossary = JSON.parse(await readFile(new URL('glossary.json', root), 'utf8'));
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const link = (id, text) => `<a href="../${id}/index.html" data-chapter="${id}">${text}</a>`;
const sourceFiles = {
  model: { path: 'parcours/epics/anatomie-llm/_shared/model.js', description: 'Commencer ici : tokenizer, chargement des poids et passage avant des deux blocs.' },
  tensor: { path: 'parcours/epics/anatomie-llm/_shared/tensor.js', description: 'Les opérations numériques et leurs gradients : matrices, attention causale et perte.' },
  math: { path: 'parcours/epics/anatomie-llm/_shared/math.js', description: 'Softmax, filtres de décodage et tirage ; contient aussi les estimateurs pédagogiques.' },
  training: { path: 'scripts/train-llm-anatomy.js', description: 'Le script exécuté avant publication : corpus, prédictions décalées, gradients, Adam et mesures.' },
};
for (const source of Object.values(sourceFiles)) {
  source.text = await readFile(new URL(`../${source.path}`, import.meta.url), 'utf8');
}

function codeReading(key) {
  const reading = codeReadings[key];
  if (!reading) { return ''; }
  const source = sourceFiles[reading.file];
  const start = source.text.indexOf(reading.start);
  const end = source.text.indexOf(reading.end, start);
  if (start < 0 || end < 0) { throw new Error(`Extrait de code introuvable : ${key}`); }
  const excerpt = source.text.slice(start, end + (reading.end === '\n}\n' ? 2 : 0));
  return `<details class="code-reading"><summary>Dans le code de Luciole · ${escape(reading.title)}</summary><p>${escape(reading.explanation)}</p><pre tabindex="0" aria-label="Extrait JavaScript : ${escape(reading.title)}"><code>${escape(excerpt)}</code></pre><p><a href="../17-sources/code.html#${reading.file}" target="_blank" rel="noopener noreferrer">Lire le fichier complet dans Playlab42 ↗</a><br><span class="source-path">${escape(source.path)}</span></p></details>`;
}

function layout(id, title, content, index) {
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  return `<!DOCTYPE html>
<!-- Produit par scripts/generate-llm-anatomy.js ; source éditoriale : _shared/chapters.js. -->
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Anatomie d’un LLM : ${escape(title.replaceAll('\n', ' '))} Un parcours interactif Playlab42.">
  <title>${escape(title.replaceAll('\n', ' '))} — Anatomie d’un LLM</title>
  <link rel="stylesheet" href="../../../../../lib/theme.css">
  <link rel="stylesheet" href="../../../../_shared/slide-base.css">
  <link rel="stylesheet" href="../../_shared/course.css">
  <link rel="stylesheet" href="../../_shared/novice-experiments.css">
  <link rel="stylesheet" href="../../_shared/experience-selection.css">
  <script type="module" src="../../_shared/course.js"></script>
</head>
<body data-chapter="${id}">
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <header class="masthead">
    ${link('01-un-token', '<span class="brand-mark" aria-hidden="true">◎</span> ANATOMIE <span class="brand-light">D’UN LLM</span>')}
    <div class="masthead-actions"><span class="edition">PLAYLAB42 · CARNET 01</span><button type="button" id="theme-toggle" aria-label="Changer de thème">◐ <span>Thème</span></button></div>
  </header>
  <nav class="chapter-rail" aria-label="Étapes du parcours">
    ${chapters.map((c, i) => `<a href="../${c.id}/index.html" data-chapter="${c.id}" aria-label="${i + 1}. ${escape(c.short)}"${c.id === id ? ' aria-current="page"' : ''}><span>${String(i + 1).padStart(2, '0')}</span></a>`).join('')}
  </nav>
  <main id="contenu" class="course-page">${content}</main>
  <nav class="page-navigation" aria-label="Navigation entre les pages">
    ${previous ? link(previous.id, `← ${escape(previous.short)}`) : link('17-sources', 'Sources & méthode')}
    ${next ? link(next.id, `<span>CONTINUER</span> ${escape(next.short)} →`) : link('18-glossaire', 'Ouvrir le glossaire →')}
  </nav>
  <footer class="course-footer"><span>Suivez ce token. Gardez votre esprit critique.</span>${link('17-sources', 'Sources')}${link('18-glossaire', 'Glossaire')}<span>Playlab42 · 2026</span></footer>
</body>
</html>
`;
}

function chapterContent(c, index) {
  const terms = chapterTerms[c.experiment];
  const badge = c.experiment === 'training' ? 'HISTORIQUE MESURÉ'
    : c.experiment === 'modelCard' ? 'MODÈLE PRÉENTRAÎNÉ' : 'EXPLORATION GUIDÉE';
  if (!terms?.length || terms.some(term => !glossary.terms[term])) {
    throw new Error(`Vocabulaire incomplet pour ${c.id}`);
  }
  return `<article class="slide">
    <header class="hero">
      <p class="eyebrow"><span>${String(index + 1).padStart(2, '0')} / ${chapters.length}</span> ${escape(c.section)}</p>
      <div class="hero-heading"><h1>${escape(c.title).replace('\n', '<br>')}</h1><div class="hero-seal" aria-hidden="true"><span>${String(index + 1).padStart(2, '0')}</span><i></i><i></i><i></i></div></div>
      <p class="lead">${escape(c.lead)}</p>
    </header>
    <nav class="lesson-navigation" aria-label="Parcours de cette page"><a href="#comprendre">1 · Comprendre</a><a href="#experience-title">2 · Expérimenter</a><a href="#defi">3 · Vérifier</a></nav>
    <div class="editorial-grid">
      <section class="explanation" aria-labelledby="comprendre"><p class="eyebrow">1 · AVANT DE MANIPULER</p><h2 id="comprendre" tabindex="-1">Comprendre le mécanisme.</h2>${c.body}${readingDiagrams[c.experiment] || ''}${codeReading(c.experiment)}<div class="formula" aria-label="Relation à retenir">${escape(c.formula)}</div><a class="explanation-link" href="#experience-title">Passer à l’expérience ↓</a></section>
      <aside class="margin-notes"><section class="takeaway"><p class="eyebrow">À RETENIR</p><p>${escape(c.takeaway)}</p></section><section class="caution"><p class="eyebrow">LES LIMITES</p><p>${escape(c.caveat)}</p></section><details class="plain-definitions"><summary>Le vocabulaire de cette étape</summary><dl>${terms.map(term => `<div><dt>${escape(term)}</dt><dd>${escape(glossary.terms[term].short)}</dd></div>`).join('')}</dl></details></aside>
    </div>
    <section class="experiment" aria-labelledby="experience-title">
      <div class="experiment-heading"><div><p class="eyebrow">2 · EXPÉRIMENTER · ${escape(c.label)}</p><h2 id="experience-title" tabindex="-1">À vous de manipuler.</h2></div><div class="experiment-options"><span class="live-badge">${badge}</span><a class="explanation-link" href="#comprendre">Relire l’explication ↑</a></div></div>
      <p class="instruction">${escape(c.instruction)}</p>
      <div class="vocabulary-hints" aria-label="Vocabulaire de cette étape"><span>Un mot vous bloque ?</span> ${terms.map(term => `<dfn data-term="${escape(term)}">${escape(term)}</dfn>`).join(' · ')}</div>
      <div id="experiment-root" data-experiment="${c.experiment}"><p class="loading-note">Chargement de l’expérience locale…</p></div>
      <noscript><p>JavaScript est nécessaire pour manipuler cette expérience. Les explications, schémas, extraits de code et corrections restent lisibles sans JavaScript.</p></noscript>
    </section>
    <section class="challenge" aria-labelledby="defi"><p class="eyebrow">3 · VÉRIFIER SA COMPRÉHENSION</p><h2 id="defi" tabindex="-1">${escape(c.question)}</h2><div id="challenge-choices"></div><p id="challenge-feedback" role="status"></p><details><summary>Lire la correction</summary><p>${escape(c.choices[c.answer])}. ${escape(c.explanation)}</p></details></section>
    <section class="chapter-sources"><h2>Pour aller à la source</h2>${c.refs.map(key => `<a href="${references[key].url}" target="_blank" rel="noopener noreferrer">${escape(references[key].title)} ↗</a>`).join('')}</section>
    <details class="presenter-notes"><summary>Notes pour une présentation animée</summary><p>${escape(c.notes)}</p></details>
  </article>`;
}

async function writeSlide(id, title, html, index) {
  const dir = new URL(`slides/${id}/`, root);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('slide.json', dir), `${JSON.stringify({ id, title: title.replaceAll('\n', ' '), duration: '5 min' }, null, 2)}\n`);
  await writeFile(new URL('index.html', dir), layout(id, title, html, index));
}

for (const [index, chapter] of chapters.entries()) {
  await writeSlide(chapter.id, chapter.title, chapterContent(chapter, index), index);
}
await writeSlide('17-sources', 'Sources & méthode', `<article class="slide"><header class="hero"><p class="eyebrow">ANNEXE · TRANSPARENCE</p><h1>Des sources.<br>Pas des certitudes.</h1><p class="lead">Ce qui est calculé, ce qui est illustré, ce qui est volontairement laissé de côté.</p></header>
<section class="explanation"><h2>Trois statuts, toujours distincts</h2><p><strong>Calcul réel :</strong> Luciole, ses activations et ses probabilités ; GPT-2 dans son laboratoire dédié après chargement volontaire. Les courbes de Luciole sont des observations enregistrées lors du préentraînement, pas un entraînement en cours dans la page. Les poids et le corpus de Luciole sont fournis ; le code d’inférence est aussi celui de l’entraînement.</p><p><strong>Illustration pédagogique :</strong> petits calculs guidés, rotations RoPE, routage MoE, template de conversation et recherche avec vérificateur. Ces expériences ne sont pas des capacités attribuées à Luciole ou GPT-2. Tous deux sont denses et utilisent des positions apprises, pas RoPE.</p><p><strong>Estimation :</strong> calcul du KV cache, budget mémoire et modèle roofline, avec hypothèses affichées. La frise du cache illustre une réutilisation des K/V ; Luciole recalcule réellement son contexte. Aucun chiffre récent non recoupé ni benchmark de fournisseur n’est repris.</p>
<h2>Le modèle pédagogique du projet</h2><p>Luciole utilise un tokenizer lexical fermé (NFC, minuscules, lettres/chiffres et ponctuation), 32 dimensions, 2 blocs, 4 têtes, des positions apprises et un MLP ReLU de largeur 64. Il apprend sur 1 512 phrases et garde deux lots synthétiques de 264 phrases pour la validation et le test. Ce n’est ni GPT-2 ni un modèle conversationnel généraliste.</p><p>Le corpus associe 32 phrases originales, des patrons combinatoires et 40 phrases naturelles des exports officiels <a href="https://tatoeba.org/en/downloads" target="_blank" rel="noopener noreferrer">Tatoeba CC0</a> : français, anglais et espagnol. Les textes Tatoeba restent sous <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0 1.0</a> ; les créations du projet suivent CC-BY-NC-SA-4.0. Les identifiants, liens, empreintes des exports et transformations sont documentés. Ce petit échantillon n’est pas un benchmark multilingue.</p><p><a href="../../assets/corpus.json">Corpus et lots</a> · <a href="../../assets/tatoeba.json">Sources et licence CC0</a> · <a href="../../assets/model.json">Poids et historique</a> · <a href="../../assets/evaluation.json">Évaluation complète</a></p>
<h2>Lire le code de Luciole dans Playlab42</h2><p><a href="code.html" target="_blank" rel="noopener noreferrer">Ouvrir la lecture du code complet ↗</a>. Commencez par <code>model.js</code> pour suivre les données, puis <code>tensor.js</code> pour ouvrir les calculs. <code>math.js</code> contient le décodage ; <code>scripts/train-llm-anatomy.js</code> montre comment les poids ont été appris. Les extraits des slides et cette page sont générés depuis les mêmes fichiers source que l’application.</p>
<h2>Portée de cette anatomie</h2><p>Le fil principal décrit un Transformer causal dense. Les variantes RoPE, GQA, MoE, FlashAttention et les techniques de service sont reliées à leurs sources, sans les attribuer à Luciole. Des modèles hybrides ou à états récurrents suivent d’autres organisations : tous les LLM ne possèdent pas exactement ce schéma ni ce cache. Les mécanismes documentés ne constituent pas un classement des meilleurs modèles du moment.</p>
<h2>Bibliographie</h2>${Object.values(references).map(ref => `<p><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${escape(ref.title)} ↗</a><br>${escape(ref.note)}</p>`).join('')}
<h2>Quatre tokenizers, deux modèles</h2><p>Le tokenizer lexical de Luciole et les tokenizers GPT-2 (BPE), BERT uncased (WordPiece) et T5 small (Unigram) permettent de comparer les découpages. BERT et T5 ne sont pas des modèles de génération intégrés ici. GPT-2, BERT et T5 utilisent leurs définitions publiques originales avec Tokenizers.js 0.2.0 (Apache-2.0), sans charger leurs poids pour la seule tokenisation. Les vocabulaires conservent leurs licences MIT ou Apache-2.0. <a href="../../assets/tokenizers/provenance.json">Révisions, empreintes, sources et licences</a>. Les limites de normalisation et les tokens inconnus restent visibles. Pour générer, chaque modèle utilise son propre tokenizer : leurs identifiants ne sont pas interchangeables.</p>
<h2>Inspirations et crédits</h2><p>Le fil rouge « Suivez ce token » a été proposé pour ce parcours. Le laboratoire GPT-2 est une adaptation française du véritable Transformer Explainer (Polo Club), avec sa licence MIT et sa provenance conservées. <a href="../../transformer-explainer/README.md">Sources, fabrication et limites du fork</a>. AnimatedLLM et LLM Visualization (Brendan Bycroft) restent des références bibliographiques, sans code intégré. Les schémas natifs et le moteur Luciole sont propres à Playlab42.</p><p>Le contenu, le corpus original et les poids de Luciole suivent la licence CC-BY-NC-SA-4.0 du dépôt. Les composants tiers et les publications liées restent sous leurs licences respectives. Traduire l’interface de GPT-2 ne modifie ni son entraînement ni ses capacités en français.</p>
<h2>Ce que « hors ligne » signifie</h2><p>Luciole, les comparaisons de tokenizers et les illustrations fonctionnent avec le paquet complet servi localement, sans API d’inférence ni CDN. GPT-2 est facultatif : ses poids, environ 657 Mo, sont téléchargés seulement après consentement explicite. Ce laboratoire nécessite davantage de mémoire et des conditions de chargement indiquées avant le lancement. Les liens bibliographiques nécessitent également Internet ; une visite du site ne garantit pas un cache hors connexion. Les prompts restent dans le navigateur.</p></section></article>`, chapters.length);
await writeSlide('18-glossaire', 'Glossaire', `<article class="slide"><header class="hero"><p class="eyebrow">ANNEXE · LES MOTS DU MODÈLE</p><h1>Le petit atlas<br>des grands mots.</h1><p class="lead">Un vocabulaire précis pour des mécanismes souvent mal nommés.</p></header><dl class="glossary-list">${Object.entries(glossary.terms).map(([term, entry]) => `<div id="${escape(term)}"><dt>${escape(term)}</dt><dd>${escape(entry.short)}${entry.long ? `<p>${escape(entry.long)}</p>` : ''}</dd></div>`).join('')}</dl></article>`, chapters.length + 1);

await writeFile(new URL('slides/17-sources/code.html', root), layout('17-sources', 'Lire le code de Luciole', `<article class="slide"><header class="hero"><p class="eyebrow">LECTURE FACULTATIVE · JAVASCRIPT</p><h1>Luciole, du texte au code.</h1><p class="lead">Les fichiers complets ci-dessous sont ceux du projet au moment de la génération du cours. Aucun entraînement n’est lancé en ouvrant cette page.</p></header><nav class="lesson-navigation" aria-label="Fichiers source">${Object.entries(sourceFiles).map(([key, source]) => `<a href="#${key}">${escape(source.path.split('/').at(-1))}</a>`).join('')}</nav><p>Dans le dépôt <a href="https://github.com/z4ppy/playlab42" target="_blank" rel="noopener noreferrer">Playlab42 ↗</a>, retrouvez ces fichiers aux chemins indiqués. Cette lecture locale accompagne la version du cours que vous consultez.</p>${Object.entries(sourceFiles).map(([key, source]) => `<section class="source-file" aria-labelledby="${key}"><h2 id="${key}" tabindex="-1">${escape(source.path.split('/').at(-1))}</h2><p>${escape(source.description)}</p><p class="source-path">${escape(source.path)}</p><pre tabindex="0" aria-label="Code complet de ${escape(source.path.split('/').at(-1))}"><code>${escape(source.text)}</code></pre></section>`).join('')}</article>`, chapters.length));

const sections = [...new Set(chapters.map(c => c.section))].map((title, i) => ({
  id: `section-${i + 1}`, title, content: chapters.filter(c => c.section === title).map(c => ({ id: c.id })),
}));
await writeFile(new URL('epic.json', root), `${JSON.stringify({
  id: 'anatomie-llm', title: 'Anatomie d’un LLM — Suivez ce token',
  description: `Ouvrez la machine : ${chapters.length} étapes progressives, de vrais tokeniseurs et un mini-Transformer inspectable. Des premiers nombres aux comparaisons 3D.`,
  hierarchy: ['autres'], tags: ['ia', 'llm', 'transformer', 'deep-learning', 'interactif'],
  metadata: { author: 'cyrille', created: '2026-10-12', duration: `${chapters.length * 5} min`, difficulty: 'intermediate', language: 'fr' },
  icon: '◎', thumbnail: 'thumbnail.svg',
  content: [...sections, { id: '17-sources', optional: true }, { id: '18-glossaire', optional: true }],
}, null, 2)}\n`);
console.log(`Anatomie LLM : ${chapters.length} étapes, sources, glossaire et manifest générés.`);
