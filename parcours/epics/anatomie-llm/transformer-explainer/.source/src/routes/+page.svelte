<script lang="ts">
	import {
		tokens,
		expandedBlock,
		vectorHeight,
		inputText,
		rootRem,
		sampling,
		maxVectorHeight,
		minVectorHeight,
		maxVectorScale,
		headContentHeight,
		temperature,
		modelData,
		modelSession,
		isFetchingModel,
		selectedExampleIdx,
		isMobile,
		isOnBlockTransition,
		blockIdx,
		isTextbookOpen,
		userId
	} from '~/store';
	import type { PreTrainedTokenizer } from '@xenova/transformers';
	import Sankey from '~/components/Sankey.svelte';
	import Attention from '~/components/Attention.svelte';
	import SubsequentBlocks from '~/components/SubsequentBlocks.svelte';
	import LinearSoftmax from '~/components/LinearSoftmax.svelte';
	import Embedding from '~/components/Embedding.svelte';
	import Mlp from '~/components/Mlp.svelte';

	import { onMount, tick } from 'svelte';
	import classNames from 'classnames';
	import { base } from '$app/paths';
	import * as ort from 'onnxruntime-web/wasm';

	import { adjustTemperature, runModel } from '~/utils/data';
	import { fetchVerifiedChunks, resolveModelManifest } from '~/utils/model-loader.js';
	import WeightPopovers from '~/components/WeightPopovers.svelte';
	import { fade } from 'svelte/transition';
	import Topbar from '~/components/Topbar.svelte';
	import BlockTransition from '~/components/BlockTransition.svelte';
	import QKV from '~/components/QKV.svelte';
	import Textbook from '~/components/textbook/Textbook.svelte';

	ort.env.wasm.wasmPaths = `${base}/runtime/`;
	ort.env.wasm.numThreads = 1;
	ort.env.logLevel = 'error';

	let active = false;
	let introHidden = false;
	let fullscreen = false;
	let fullscreenAvailable = false;
	let fullscreenMessage = '';
	let labRoot: HTMLDivElement;
	let showInfoButton: HTMLButtonElement;
	let hideInfoButton: HTMLButtonElement;

	async function toggleInformation() {
		introHidden = !introHidden;
		await tick();
		(introHidden ? showInfoButton : hideInfoButton)?.focus();
		window.scrollTo(0, 0);
	}

	async function toggleFullscreen() {
		fullscreenMessage = '';
		try {
			if (document.fullscreenElement === labRoot) {
				await document.exitFullscreen();
			} else {
				await labRoot.requestFullscreen();
				introHidden = true;
			}
		} catch {
			fullscreenMessage = 'Le navigateur a refusé le plein écran. Vous pouvez toujours masquer les informations.';
		}
	}
	let loading = false;
	let error = '';
	let progress = '';
	let controller: AbortController;
	let unsubscribe: (() => void) | undefined;
	let tokenizer: PreTrainedTokenizer;
	let pendingInput: Promise<void> = Promise.resolve();
	let manifest: {
		revision: string;
		source: string;
		bytes: number;
		chunks: { file: string; bytes: number; sha256: string }[];
	} | undefined;
	let readingManifest = true;
	let sourceDescription = 'Lecture du manifeste servi par ce site…';
	const metadataController = new AbortController();

	onMount(() => {
		fullscreenAvailable = Boolean(document.fullscreenEnabled && labRoot.requestFullscreen);
		const updateFullscreen = () => { fullscreen = document.fullscreenElement === labRoot; };
		document.addEventListener('fullscreenchange', updateFullscreen);
		void readManifest().catch(cause => {
			error = cause instanceof Error ? cause.message : String(cause);
			sourceDescription = 'Manifeste indisponible ; aucun téléchargement de poids n’a commencé.';
		});
		return () => {
			document.removeEventListener('fullscreenchange', updateFullscreen);
			metadataController.abort();
			controller?.abort();
			unsubscribe?.();
			void $modelSession?.release();
		};
	});

	async function readManifest() {
		readingManifest = true;
		try {
			const localURL = new URL(`${base}/model-local-manifest.json`, window.location.href);
			const signal = AbortSignal.any([metadataController.signal, AbortSignal.timeout(15_000)]);
			let response = await fetch(localURL, { signal, cache: 'no-store' });
			let manifestURL = localURL;
			if (response.status === 404) {
				manifestURL = new URL(`${base}/model-manifest.json`, window.location.href);
				response = await fetch(manifestURL, { signal, cache: 'no-store' });
			}
			if (!response.ok) throw new Error(`Manifeste des poids : HTTP ${response.status}`);
			manifest = resolveModelManifest(await response.json(), manifestURL);
			sourceDescription = new URL(manifest.source).origin === window.location.origin
				? 'Copie statique locale, hébergée sur ce site ; aucun serveur de génération ni relais requis.'
				: 'Fichiers publics de poloclub/transformer-explainer sur raw.githubusercontent.com, à la révision épinglée.';
		} finally {
			readingManifest = false;
		}
	}

	async function startModel() {
		if (loading) return;
		controller?.abort();
		controller = new AbortController();
		loading = true;
		error = '';
		progress = 'Chargement du tokenizer local…';
		let stage = 'Préparation du modèle';
		try {
			if (!globalThis.crypto?.subtle) {
				throw new Error('HTTPS ou localhost est nécessaire pour vérifier les poids. Ouvrez le laboratoire depuis une origine sécurisée.');
			}
			if (!manifest) await readManifest();
			if (!manifest) throw new Error('Manifeste des poids indisponible.');
			stage = 'Chargement du tokenizer local';
			const { AutoTokenizer } = await import('@xenova/transformers/src/tokenizers.js');
			const { env } = await import('@xenova/transformers/src/env.js');
			env.allowRemoteModels = false;
			env.localModelPath = `${base}/`;
			env.useBrowserCache = false;
			env.backends.onnx.wasm.wasmPaths = `${base}/runtime/`;
			if (!tokenizer) tokenizer = await AutoTokenizer.from_pretrained('tokenizer', { local_files_only: true });
			stage = 'Téléchargement des poids';
			let weights: Uint8Array | undefined = await fetchVerifiedChunks(manifest, {
				signal: controller.signal,
				onProgress: ({ bytes, total, completed }) => {
					progress = `Poids GPT-2 : ${completed}/63 fichiers · ${(bytes / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} Mo`;
				}
			});
			stage = 'Initialisation du moteur ONNX';
			progress = 'Initialisation de GPT-2 dans votre navigateur (peut prendre une minute)…';
			const session = await ort.InferenceSession.create(weights, {
				executionProviders: ['wasm'], graphOptimizationLevel: 'disabled',
				enableCpuMemArena: false, enableMemPattern: false
			});
			weights = undefined;
			if (controller.signal.aborted) {
				await session.release();
				controller.signal.throwIfAborted();
			}
			modelSession.set(session);
			isFetchingModel.set(false);
			unsubscribe?.();
			stage = 'Premier calcul GPT-2';
			unsubscribe = subscribeInputs(tokenizer);
			await pendingInput;
			if (!active) {
				unsubscribe?.();
				unsubscribe = undefined;
				await session.release();
				modelSession.set(undefined);
				throw new Error(error || 'Le premier calcul GPT-2 n’a pas abouti.');
			}
			progress = 'GPT-2 prêt · calcul local, aucun prompt envoyé.';
		} catch (cause) {
			controller.abort();
			error = `${stage} : ${cause instanceof Error ? cause.message : String(cause)}`;
			progress = '';
		} finally {
			loading = false;
		}
	}

	// Subscribe inputs
	const subscribeInputs = (tokenizer: PreTrainedTokenizer) => {
		const runModelOrCache = () => {
			if (!$modelSession) return;
			error = '';
			pendingInput = pendingInput.then(async () => {
				await runModel({
					tokenizer, input: $inputText.trim(), temperature: $temperature, sampling: $sampling,
					onReady: () => { controller.signal.throwIfAborted(); active = true; }
				});
			}).catch(cause => {
				error = `Calcul interrompu : ${cause instanceof Error ? cause.message : String(cause)}. Réessayez « Générer ».`;
			});
		};

		const unsubscribeInputText = inputText.subscribe((value) => {
			runModelOrCache();
		});

		let initialTemperature = true; // prevent initial redundant rendering
		const unsubscribeTemperature = temperature.subscribe((value) => {
			if (initialTemperature) {
				initialTemperature = false;
				return;
			}
			adjustTemperature({
				tokenizer,
				logits: $modelData.logits,
				temperature: value,
				sampling: $sampling
			});
		});

		let initialSampling = true; // prevent initial redundant rendering
		const unsubscribeSmapling = sampling.subscribe((value) => {
			if (initialSampling) {
				initialSampling = false;
				return;
			}
			adjustTemperature({
				tokenizer,
				logits: $modelData.logits,
				temperature: $temperature,
				sampling: value
			});
		});

		return () => {
			unsubscribeInputText();
			unsubscribeTemperature();
			unsubscribeSmapling();
		};
	};

	// visual elements
	let vizHeight = 0;
	let titleHeight = rootRem * 5;

	const calculateVectorHeight = () => {
		const gaps = rootRem * 0.5 * ($tokens.length - 1);
		const vectorHeightVal = Math.min(
			Math.max((vizHeight - titleHeight - gaps) / $tokens.length / maxVectorScale, minVectorHeight),
			maxVectorHeight
		);
		vectorHeight.set(vectorHeightVal);
		headContentHeight.set(Math.max($tokens.length * vectorHeightVal * 3 + gaps, rootRem * 20));
	};

	$: if (vizHeight || $tokens.length) {
		calculateVectorHeight();
	}
</script>

<div class="playlab-lab" class:focused={introHidden} bind:this={labRoot}>
<section id="lab-information" class="playlab-intro" class:loaded={active} hidden={introHidden} aria-labelledby="fork-title">
	<div class="playlab-heading">
		<div>
			<p class="playlab-eyebrow">PLAYLAB42 · ORIGINAL-GPT2 · 124 MILLIONS DE PARAMÈTRES</p>
			<h1 id="fork-title">À l’intérieur d’un vrai Transformer</h1>
		</div>
		<a href={base + '/credits.html'} target="_blank" rel="noreferrer">Source, licences et crédits ↗</a>
		{#if active}
			<button class="playlab-secondary" bind:this={hideInfoButton} on:click={toggleInformation}
				aria-controls="lab-information" aria-expanded="true">Masquer les informations</button>
		{/if}
	</div>
	<p>Fork local de <strong>Transformer Explainer — Polo Club of Data Science</strong>. GPT-2 a surtout appris l’anglais :
		vous pouvez saisir du français, mais ses continuations ne sont ni un modèle francophone ni des réponses fiables.</p>
	{#if !active}
		<p>Aucun poids n’est chargé avant votre accord. Le téléchargement à la demande représente <strong>656,7 Mo (626,2 Mio)</strong>,
			avec les SHA-256 des fichiers de la révision amont. <strong>{sourceDescription}</strong>
			Le tokenizer et le moteur ONNX sont servis localement. Le calcul et votre prompt restent dans ce navigateur, sans télémétrie.
			<strong>HTTPS ou localhost est nécessaire</strong> pour vérifier l’intégrité.
			Prévoyez plusieurs Go de mémoire et un ordinateur récent. Pas de mode hors ligne garanti ; le cache dépend du navigateur.</p>
		<button class="playlab-primary" on:click={startModel} disabled={loading || readingManifest}>
			{loading ? 'Chargement en cours…' : error ? 'Réessayer le chargement de GPT-2' : 'Charger GPT-2 · 657 Mo'}
		</button>
		{#if loading}<button class="playlab-secondary" on:click={() => controller.abort()}>Annuler</button>{/if}
	{/if}
	<p role="status" aria-live="polite">{progress}</p>
	{#if error}<p class="playlab-error" role="alert">GPT-2 indisponible : {error} Aucun résultat simulé n’est affiché.</p>{/if}
</section>
{#if active}
<div class="playlab-view-controls">
	{#if introHidden}
		<button class="playlab-secondary" bind:this={showInfoButton} on:click={toggleInformation}
			aria-controls="lab-information" aria-expanded="false">Afficher les informations</button>
	{/if}
	{#if fullscreenAvailable}
		<button class="playlab-secondary" on:click={toggleFullscreen} aria-pressed={fullscreen}>
			{fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
		</button>
	{/if}
	{#if fullscreenMessage}<p role="status">{fullscreenMessage}</p>{/if}
	{#if introHidden && error}<p class="playlab-error" role="alert">{error}</p>{/if}
</div>
<div class="playlab-workspace">
<Topbar isActive={true} />
<div class="playlab-viz">
<div
	class:active
	class="main-section h-full w-full"
	style={`--vector-height: ${$vectorHeight}px;--title-height: ${titleHeight}px;--content-height:${vizHeight - titleHeight}px;`}
>
	{#if !!$expandedBlock.id}
		<div
			class={classNames('dim', `${$expandedBlock.id || ''}`)}
			transition:fade={{ duration: 100 }}
		></div>
		<div
			class={classNames('dim-partial left', `${$expandedBlock.id || ''}`)}
			transition:fade={{ duration: 100 }}
		></div>
		<div
			class={classNames('dim-partial right', `${$expandedBlock.id || ''}`)}
			transition:fade={{ duration: 100 }}
		></div>
	{/if}
	<div class="sankey opacity-1" class:attention={$expandedBlock.id === 'attention'}>
		<Sankey />
	</div>
	<div class="nodes resize-watch">
		<div class="steps" class:expanded={!!$expandedBlock.id} bind:offsetHeight={vizHeight}>
			<Embedding className="step" />
			<div class="blocks relative">
				<div class="block-steps main" class:initial={$blockIdx === 0}>
					<QKV className="step" />
					<Attention className="step" />
					<Mlp className="step" />
				</div>
				<div
					class="block-steps next"
					class:hide={!$isOnBlockTransition}
					class:initial={$blockIdx === 0}
				>
					<QKV className="step" />
					<Attention className="step" />
					<Mlp className="step" />
				</div>
				<div class="transition-watch" class:hide={!$isOnBlockTransition}></div>
			</div>
			<SubsequentBlocks className="step" />
			<LinearSoftmax className="step" />
		</div>
		<WeightPopovers />
		<BlockTransition />
		{#if !$isMobile}
			<Textbook showTextCard={$isTextbookOpen} />
		{/if}
	</div>
</div>
</div>
</div>
{/if}
</div>

<style lang="scss">
	.main-section {
		opacity: 0;
		&.active {
			opacity: 1;
		}
	}
	.nodes {
		height: 100%;
		width: 100%;
		padding: 1rem 0 3rem 0;
		position: relative;
	}
	.steps {
		position: relative;
		width: 100%;
		height: 100%;
		position: relative;
		display: grid;
		grid-template-columns: auto 3.5fr 0.5fr 0.5fr;

		&.expanded {
			:global(.step > .title) {
				padding-bottom: 3rem;
			}
		}

		.blocks {
			position: relative;
			width: 100%;
			height: 100%;

			.block-steps {
				height: 100%;
				width: 100%;
				position: absolute;
				display: grid;
				grid-template-columns: 0.5fr 2fr 1fr;
			}
			.block-steps.main {
				transform-origin: 3rem center;
				top: 0;
				left: 0;
			}
			.block-steps.next {
				transform-origin: right center;
				justify-content: end;
				top: 0;
				right: 0;
				pointer-events: none;
			}

			.transition-watch {
				position: absolute;
				top: 0;
				left: 0;
				height: 100%;
				width: 100%;
				pointer-events: none;
			}

			.hide {
				display: none;
			}
			&.animate-forward {
				.block-steps,
				.transition-watch {
					animation-duration: 800ms;
					animation-timing-function: ease-in;
				}
				.block-steps.main {
					animation-name: collapse;
					&.initial {
						transform-origin: left center;
					}
				}
				.block-steps.next {
					animation-name: expand;
				}
				.transition-watch {
					animation-name: width-collapse;
				}
			}

			&.animate-backward {
				.block-steps,
				.transition-watch {
					animation-duration: 800ms;
					animation-timing-function: ease-in;
				}
				.block-steps.main {
					animation-name: expand;
					&.initial {
						transform-origin: left center;
					}
				}
				.block-steps.next {
					animation-name: collapse;
				}
				.transition-watch {
					animation-name: width-collapse;
				}
			}
		}
	}
	@keyframes width-collapse {
		0% {
			width: 100%;
		}
		100% {
			width: 0%;
		}
	}
	@keyframes expand {
		0% {
			transform: scaleX(0);
		}
		100% {
			transform: scaleX(1);
		}
	}
	@keyframes collapse {
		0% {
			transform: scaleX(1);
		}
		100% {
			transform: scaleX(0);
		}
	}

	:global(.step) {
		height: 100%;
		display: grid;
		grid-template-rows: var(--title-height) 1fr;
	}

	:global(.step > .title) {
		z-index: $COLUMN_TITLE_INDEX;
		display: flex;
		flex-direction: column;
		justify-content: end;
		grid-row: 1;
		color: theme('colors.gray.400');
		white-space: nowrap;
		padding-bottom: 2rem;
		overflow: visible;
		min-width: 0;
		transition: all 0.5s;
		cursor: default;

		&:hover {
			color: theme('colors.gray.600');
		}
	}

	:global(.step > .title.expandable) {
		cursor: pointer;
	}

	:global(.step .content) {
		grid-row: 2;
		height: fit-content;
	}

	:global(.column) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		position: relative;

		:global(.cell) {
			height: var(--vector-height);
			display: flex;
			gap: 1rem;
			align-items: center;
			position: relative;
		}

		:global(.subtitle) {
			position: absolute;
			top: 0;
			transform: translateY(calc(-100% - 1rem));
			text-align: center;
			font-size: 0.8rem;
			color: theme('colors.gray.400');
			width: 100%;
			z-index: $COLUMN_TITLE_INDEX;
		}
	}

	:global(.vector),
	:global(.sub-vector) {
		position: relative;
		z-index: $VECTOR_INDEX;
		width: 12px;
		height: var(--vector-height);
		flex-shrink: 0;
		justify-content: start;
	}
	:global(.cell.x1-12),
	:global(.vector.x1-12),
	:global(.sub-vector.x1-12) {
		height: calc(var(--vector-height) / 12);
	}

	:global(.cell.x3),
	:global(.vector.x3),
	:global(.sub-vector.x3) {
		height: calc(var(--vector-height) * 3);
	}
	:global(.cell.x4),
	:global(.vector.x4),
	:global(.sub-vector.x4) {
		height: calc(var(--vector-height) * 3.1);
	}

	:global(.vector.vocab),
	:global(.sub-vector.vocab) {
		height: 100%;
		width: 0;
	}

	:global(.sub-vector.head-rest) {
		flex: 1 0 0;
	}

	:global(.label) {
		font-size: 0.9rem;
		color: theme('colors.gray.700');
		z-index: $VECTOR_INDEX;
		display: inline;
		max-width: 7rem;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: right;
		line-height: var(--vector-height);
		height: var(--vector-height);
		flex-shrink: 0;
	}
	:global(.label.float) {
		position: absolute;
		left: -0.8rem;
		transform: translateX(-100%);
	}
	:global(.label.float-right) {
		position: absolute;
		left: -0.8rem;
	}

	:global(.ellipsis) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.bounding) {
		position: absolute;
		box-sizing: content-box;
		top: -0.5rem;
		padding: 0.5rem 0;
		left: 0;
		height: 100%;
		border: 2px dashed theme('colors.gray.300');
		border-radius: 0.5rem;
		transition: opacity 0.5s;
		opacity: 0;
		pointer-events: none;
	}
	:global(.bounding.active) {
		opacity: 0.8;
	}

	:global(.popover) {
		z-index: $POPOVER_INDEX;
		width: max-content;
	}

	:global(.tooltip) {
		z-index: $TOOLTIP_INDEX;
		background-color: white !important;
		color: theme('colors.gray.600') !important;
		border: 1px solid theme('colors.gray.200') !important;
		padding: 0.2rem 0.5rem !important;
		font-size: 0.8rem !important;
		white-space: nowrap;
		font-weight: 300 !important;
		border-color: theme('colors.gray.200') !important;
	}
	.dim {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: $DIM_INDEX;
		background-color: white;
		opacity: 0.7;
		user-select: none;

		&.attention {
			z-index: 0;
		}
	}
	.dim-partial {
		user-select: none;
		z-index: $PARTIAL_DIM_INDEX;
		position: absolute;
		top: 0;
		height: 100%;

		&.right {
			right: 0;
			background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 80%);
		}
		&.left {
			left: 0;
			background: linear-gradient(-90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 80%);
		}

		&.embedding {
			&.left {
				display: none;
			}
			&.right {
				width: 60%;
			}
		}
		&.attention {
			&.left {
				width: 20%;
			}
			&.right {
				width: 20%;
			}
		}
		&.softmax {
			&.left {
				width: 60%;
			}
			&.right {
				display: none;
			}
		}
	}
	.sankey {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;

		&.attention {
			:global(.sankey-top) {
				z-index: $EXPANDED_ATTENTION_INDEX !important;
				pointer-events: none;
			}
			// :global(.sankey-top > g) {
			// 	opacity: 0.3;
			// }
			// :global(.sankey-top > g.attention) {
			// 	opacity: 1;
			// }
		}
	}

	:global(svg g.path-group) {
		transition: opacity 0.5s;
	}
	:global(div.step > div) {
		transition: opacity 0.5s;
	}
	:global(div.step .column) {
		transition: opacity 0.5s;
	}
</style>
