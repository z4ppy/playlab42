<script lang="ts">
	import '~/styles/app.css';
	import '~/styles/global.scss';
	import '~/styles/playlab.css';
	import { isLoaded } from '~/store';
	import { onMount } from 'svelte';
	onMount(() => {
		isLoaded.set(true);
		document.documentElement.dataset.theme = new URL(location.href).searchParams.get('theme') === 'dark' ? 'dark' : 'light';
	});
</script>

<a class="playlab-skip" href="#main">Aller au laboratoire</a>
<main id="main" style="--min-screen-width:1300px;--min-column-width:20px"><slot /></main>
<section class="playlab-guide" aria-labelledby="guide-title">
	<h2 id="guide-title">Explorer, pas seulement générer</h2>
	<ol>
		<li><strong>Vue d’ensemble :</strong> partez d’un prompt court, puis suivez les vecteurs de gauche à droite. Les unités sont des tokens, pas nécessairement des mots.</li>
		<li><strong>Attention :</strong> ouvrez le bloc Attention, changez de tête et inspectez sa matrice. Une ligne montre comment un token pondère les positions déjà accessibles ; le futur est masqué.</li>
		<li><strong>Douze blocs :</strong> passez d’un bloc GPT-2 au suivant. Les activations affichées proviennent du véritable export ONNX amont, pas du petit modèle Luciole.</li>
		<li><strong>Température et tirage :</strong> comparez les probabilités avec des températures basses et hautes. Top-k conserve k candidats ; top-p conserve une masse cumulée de probabilité. « Générer » ajoute un token à la fois.</li>
	</ol>
	<p>La vue conserve l’architecture interactive d’origine : un large schéma horizontal, avec défilement dans son propre espace.
		Le panneau d’aide explique chaque opération. Certains noms mathématiques restent standards (Q, K, V, logits, softmax, MLP).</p>
	<p><strong>Limites :</strong> GPT-2 n’est pas un assistant conversationnel. Ses textes peuvent être inexacts, biaisés ou inappropriés.
		Les rectangles résument des vecteurs : leur taille ne représente pas la quantité de connaissances du modèle.
		Les générations de ce laboratoire sont produites par GPT-2.</p>
	<p><a href="https://github.com/poloclub/transformer-explainer" target="_blank" rel="noreferrer">Projet original de Polo Club</a>
		· <a href="credits.html">Provenance et licences</a> · adaptation française Playlab42.</p>
</section>
