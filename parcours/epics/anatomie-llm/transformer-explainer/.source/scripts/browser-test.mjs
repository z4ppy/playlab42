import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = fileURLToPath(new URL('../../../../../..', import.meta.url)).replace(/\/$/, '');
const publicPath = '/parcours/epics/anatomie-llm/transformer-explainer/public';
const endpoint = process.env.BROWSER_CDP || 'http://172.17.0.3:9222';
const origin = process.env.TEST_ORIGIN || 'http://localhost:5243';
const fixture = process.env.MODEL_FIXTURE;
const nativeHttp = process.env.NATIVE_HTTP === '1';
const realDownloads = process.env.REAL_DOWNLOADS === '1';
const localModel = process.env.LOCAL_MODEL === '1';
const shellOnly = process.env.SHELL_ONLY === '1';
if (realDownloads && !nativeHttp) throw new Error('REAL_DOWNLOADS exige NATIVE_HTTP=1.');
if (localModel && (!nativeHttp || realDownloads || fixture)) throw new Error('LOCAL_MODEL exige NATIVE_HTTP=1, sans relais ni fixture.');
const modelPattern = localModel ? `${origin}/**/model-v2/gpt2.onnx.part*` : 'https://raw.githubusercontent.com/**';
const manifest = JSON.parse(readFileSync(new URL('../static/model-manifest.json', import.meta.url), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
	'.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (request, response) => {
	const pathname = decodeURIComponent(new URL(request.url, origin).pathname).replace(/^\/prefix(?=\/)/, '');
	if (realDownloads && /^\/model-fixture\/gpt2\.onnx\.part\d+$/.test(pathname)) {
		const file = pathname.split('/').at(-1);
		if (!manifest.chunks.some(chunk => chunk.file === file)) {
			response.writeHead(404); response.end('Fragment absent du manifeste'); return;
		}
		try {
			const remote = await fetch(`${manifest.source}/${file}`, {
				signal: AbortSignal.timeout(90_000), credentials: 'omit', referrerPolicy: 'no-referrer'
			});
			response.writeHead(remote.status, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
			await pipeline(Readable.fromWeb(remote.body), response);
		} catch (cause) {
			response.destroy(cause);
		}
		return;
	}
	const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
	if (!file.startsWith(`${root}/`) || !existsSync(file) || !statSync(file).isFile()) {
		response.writeHead(404); response.end('Absent'); return;
	}
	response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
	createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(Number(new URL(origin).port), '0.0.0.0', resolve));
const browser = await chromium.connectOverCDP(endpoint);
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
// Le navigateur et les sources vivent dans deux conteneurs sans bindmount :
// servir les fichiers locaux sur localhost via CDP préserve le contexte sécurisé.
if (!nativeHttp) await context.route(`${origin}/**`, async route => {
	const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/prefix(?=\/)/, '');
	const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
	if (!file.startsWith(`${root}/`) || !existsSync(file) || !statSync(file).isFile()) {
		await route.fulfill({ status: 404, body: 'Absent' }); return;
	}
	await route.fulfill({ path: file, contentType: mime[extname(file)] || 'application/octet-stream' });
});
const page = await context.newPage();
const errors = [];
const requests = [];
const requestRecords = [];
const results = { transport: localModel ? 'native same-origin static weights, no relay' : realDownloads ? 'test-only localhost relay of exact upstream bytes' : fixture ? 'upstream byte fixtures' : 'shell only', checks: [] };
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('request', request => {
	requests.push(request.url());
	requestRecords.push({ url: request.url(), method: request.method(), body: request.postData(), referrer: request.headers().referer || null });
});
page.on('console', message => {
	if (message.text().startsWith('GPT2_STATUS ')) console.log(message.text());
});
mkdirSync('browser-results', { recursive: true });
try {
	await page.goto(`${origin}${publicPath}/index.html`);
	await page.getByRole('button', { name: 'Charger GPT-2' }).waitFor();
	await page.waitForTimeout(1000);
	assert.equal(requests.some(url => !url.startsWith(origin)), false, 'Aucune requête externe avant consentement');
	assert.equal(requests.some(url => /\/runtime\/|\/tokenizer\/|\.wasm/.test(url)), false, 'Aucun moteur ni tokenizer avant consentement');
	assert.equal(requests.some(url => /\/model-v2\/gpt2\.onnx\.part/.test(url)), false, 'Aucun poids local avant consentement');
	assert.match(await page.locator('.playlab-intro').innerText(), /HTTPS ou localhost est nécessaire/);
	if (localModel) assert.match(await page.locator('.playlab-intro').innerText(), /Copie statique locale/);
	assert.equal(await page.locator('.main-section').count(), 0, 'Aucune prédiction précalculée affichée');
	await page.screenshot({ path: 'browser-results/consent.png', fullPage: true });
	console.log('PASS consentement, aucun téléchargement de modèle/runtime/CDN et aucune prédiction simulée');

	await page.route(modelPattern, route => route.fulfill({ status: 503, body: 'Indisponible' }));
	await page.getByRole('button', { name: 'Charger GPT-2' }).click();
	await page.getByRole('alert').waitFor({ timeout: 30_000 });
	assert.match(await page.getByRole('alert').innerText(), /HTTP 503/);
	await page.getByRole('button', { name: 'Réessayer le chargement' }).waitFor();
	assert.equal(await page.locator('.main-section').count(), 0);
	await page.screenshot({ path: 'browser-results/error.png', fullPage: true });
	console.log('PASS erreur HTTP visible, reprise disponible, aucune simulation');
	await page.unroute(modelPattern);

	if ((fixture || realDownloads || localModel) && !shellOnly) {
		const modelRequestIndex = requestRecords.length;
		await page.evaluate(() => {
			let last = '';
			const status = document.querySelector('[role="status"]');
			new MutationObserver(() => {
				const text = status.textContent;
				const match = text.match(/(\d+)\/63/);
				if (text !== last && (!match || Number(match[1]) % 10 === 0 || Number(match[1]) === 63)) {
					last = text;
					console.log(`GPT2_STATUS ${text}`);
				}
			}).observe(status, { subtree: true, characterData: true, childList: true });
		});
		// Octets réels, identiques aux fichiers amont (leurs SHA-256 restent vérifiés par le navigateur).
		if (!localModel) await page.route('https://raw.githubusercontent.com/**', async route => {
			const file = new URL(route.request().url()).pathname.split('/').at(-1);
			assert.match(file, /^gpt2\.onnx\.part\d+$/);
			if (nativeHttp) {
				await route.fulfill({ status: 302, headers: { location: `${origin}/model-fixture/${file}`, 'Access-Control-Allow-Origin': '*' } });
			} else {
				await route.fulfill({ path: resolve(fixture, file), contentType: 'application/octet-stream' });
			}
		});
		await page.getByRole('button', { name: 'Réessayer le chargement' }).click();
		const wait = await Promise.race([
			page.locator('.main-section').waitFor({ timeout: 900_000 }).then(() => 'ready'),
			page.getByRole('alert').waitFor({ timeout: 900_000 }).then(() => 'error')
		]);
		if (wait === 'error') throw new Error(await page.getByRole('alert').innerText());
		await page.getByRole('button', { name: 'Générer', exact: true }).waitFor();
		await page.waitForFunction(() => !document.querySelector('[data-click="generate-btn"]').disabled, null, { timeout: 120_000 });
		const before = await page.locator('.predicted').innerText();
		assert.ok(before.trim().length, 'Une vraie continuation GPT-2 est visible');
		assert.equal(await page.locator('.text-card h3').innerText(), 'Qu’est-ce qu’un Transformer ?');
		results.initial = before;
		await page.screenshot({ path: 'browser-results/real-gpt2.png', fullPage: false, timeout: 120_000 });
		await page.getByRole('textbox', { name: 'Votre prompt GPT-2' }).fill('The capital of France is');
		await page.getByRole('button', { name: 'Générer', exact: true }).click();
		await page.waitForFunction(() => document.querySelector('[data-click="generate-btn"]').disabled, null, { timeout: 10_000 });
		await page.waitForFunction(() => !document.querySelector('[data-click="generate-btn"]').disabled, null, { timeout: 120_000 });
		assert.ok((await page.locator('.predicted').innerText()).trim().length, 'Prompt libre calculé');
		results.custom = await page.locator('.predicted').innerText();
		const main = page.locator('.block-steps.main');
		// Le titre ouvre le guide ; c'est la matrice qui ouvre l'inspection.
		await main.locator('[data-click="attention-matrix"]').click();
		await main.locator('.attention.expanded').waitFor();
		await page.waitForTimeout(1800);
		await page.screenshot({ path: 'browser-results/attention.png', fullPage: false, timeout: 120_000 });
		results.checks.push('real inference', 'free prompt', 'attention inspection');
		const headTitle = main.locator('.head-title');
		await headTitle.locator('button').last().click();
		await page.waitForTimeout(1200);
		assert.match(await headTitle.innerText(), /Tête 2 \/ 12/);
		await headTitle.locator('button').first().focus();
		await headTitle.locator('button').first().press('Enter');
		await page.waitForTimeout(1200);
		assert.match(await headTitle.innerText(), /Tête 1 \/ 12/);
		results.checks.push('head selection');
		await page.locator('.main-section').click({ position: { x: 5, y: 5 } });
		await page.waitForFunction(() => !document.querySelector('.block-steps.main .attention').classList.contains('expanded'));
		await page.getByRole('button', { name: 'Bloc Transformer suivant', exact: true }).click();
		await page.waitForTimeout(1200);
		assert.match(await page.locator('.transformer-bounding-title').innerText(), /2/);
		results.checks.push('block selection');
		const temperature = page.locator('.temperature-slider input[type="range"]');
		await temperature.focus();
		await temperature.press('ArrowRight');
		assert.match(await page.locator('.temperature-slider .value').innerText(), /0\.9/);
		const topP = page.getByRole('radio', { name: 'Top-p', exact: true });
		await topP.check();
		assert.equal(await topP.isChecked(), true);
		const samplingSlider = page.locator('.sampling-slider input[type="range"]');
		await samplingSlider.focus();
		await samplingSlider.press('ArrowRight');
		assert.match(await page.locator('.sampling-slider .value').innerText(), /p=0\.6/);
		const topK = page.getByRole('radio', { name: 'Top-k', exact: true });
		await topK.check();
		assert.equal(await topK.isChecked(), true);
		await samplingSlider.focus();
		await samplingSlider.press('ArrowRight');
		assert.match(await page.locator('.sampling-slider .value').innerText(), /k=6/);
		results.checks.push('temperature', 'top-p', 'top-k');
		const modelRequests = requestRecords.slice(modelRequestIndex).filter(record => localModel
			? /\/model-v2\/gpt2\.onnx\.part\d+$/.test(record.url)
			: record.url.startsWith('https://raw.githubusercontent.com/'));
		assert.equal(modelRequests.length, 63);
		assert.ok(modelRequests.every(record => record.method === 'GET' && record.body === null && record.referrer === null));
		assert.equal(JSON.stringify(requestRecords).includes('The capital of France is'), false);
		results.verifiedFragments = 63;
		results.verifiedBytes = manifest.bytes;
		results.networkPrivacyPassed = true;
		if (localModel) assert.ok(requestRecords.every(record => record.url.startsWith(origin)), 'Mode local sans requête externe');
		await page.unroute(modelPattern);
		console.log('PASS GPT-2 réel, prompt libre, attention, tête/bloc, température et top-p/top-k ; 63 GET sans prompt');
	}
	assert.deepEqual(errors, [], 'Aucune erreur JavaScript du fork');
	// Un cache valide doit réutiliser les poids ; l'essai 503 suivant veut au contraire tester le réseau.
	await page.evaluate(async () => {
		for (const key of await caches.keys()) await caches.delete(key);
	});
	await page.goto(`${origin}/prefix${publicPath}/index.html?theme=dark`);
	await page.getByRole('button', { name: 'Charger GPT-2' }).waitFor();
	assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
	await page.setViewportSize({ width: 390, height: 844 });
	assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	await page.screenshot({ path: 'browser-results/mobile-dark.png', fullPage: true });
	console.log('PASS préfixe d’hébergement, thème sombre et consentement mobile sans débordement');
	await page.route(modelPattern, route => route.fulfill({ status: 503, body: 'Indisponible' }));
	await page.getByRole('button', { name: 'Charger GPT-2' }).click();
	await page.getByRole('alert').waitFor();
	assert.match(await page.getByRole('alert').innerText(), /HTTP 503/);
	assert.ok(requests.some(url => url.includes(`/prefix${publicPath}/tokenizer/tokenizer.json`)));
	console.log('PASS tokenizer, manifeste et reprise sous préfixe d’hébergement');
	const requestIndex = requests.length;
	await page.evaluate(async () => {
		const { mountTransformerExplainer } = await import('/parcours/epics/anatomie-llm/_shared/transformer-explainer.js');
		const container = document.createElement('div');
		document.body.replaceChildren(container);
		window.laboratory = await mountTransformerExplainer(container, { theme: 'dark' });
	});
	await page.frameLocator('iframe').getByRole('button', { name: 'Charger GPT-2' }).waitFor();
	assert.ok((await page.locator('iframe').boundingBox()).height >= 780);
	assert.ok((await page.locator('iframe').getAttribute('src')).endsWith('/public/index.html?theme=dark'));
	await page.getByRole('button', { name: 'Agrandir en plein écran' }).click();
	const expanded = await page.evaluate(() => !!document.fullscreenElement);
	if (expanded) await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
	else assert.match(await page.getByRole('status').innerText(), /Plein écran indisponible/);
	await page.evaluate(() => window.laboratory.destroy());
	assert.equal(await page.locator('iframe').count(), 0);
	assert.equal(requests.slice(requestIndex).some(url => !url.startsWith(origin)), false);
	console.log('PASS API de montage, iframe ample, plein écran/fallback et nettoyage sans téléchargement des poids');
	if (process.env.INSECURE_ORIGIN || process.env.MISSING_WEBCRYPTO === '1') {
		const index = requests.length;
		const missingCrypto = process.env.MISSING_WEBCRYPTO === '1';
		if (missingCrypto) await page.addInitScript(() => {
			Object.defineProperty(window.crypto, 'subtle', { value: undefined });
		});
		await page.goto(`${missingCrypto ? origin : process.env.INSECURE_ORIGIN}${publicPath}/index.html`);
		await page.getByRole('button', { name: 'Charger GPT-2' }).click();
		await page.getByRole('alert').waitFor();
		assert.match(await page.getByRole('alert').innerText(), /HTTPS ou localhost est nécessaire/);
		assert.equal(requests.slice(index).some(url => /\/runtime\/|\/tokenizer\/|\/model-v2\/gpt2\.onnx\.part/.test(url)), false);
		await page.getByRole('button', { name: 'Réessayer le chargement' }).waitFor();
		results.checks.push(missingCrypto
			? 'WebCrypto availability guard (simulated missing crypto.subtle), before tokenizer/runtime/weights'
			: 'insecure HTTP refused before tokenizer/runtime/weights');
		console.log('PASS absence WebCrypto refusée avant tokenizer/runtime/poids, erreur et reprise visibles');
	}
	assert.deepEqual(errors, [], 'Aucune erreur JavaScript du fork ni du wrapper');
	results.success = true;
	results.javascriptErrors = errors;
} catch (cause) {
	console.error({ root, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1500), errors, requests: requests.slice(0, 12) });
	await page.screenshot({ path: 'browser-results/failure.png', fullPage: true });
	throw cause;
} finally {
	writeFileSync(`browser-results/${shellOnly ? 'shell-verification' : 'verification'}.json`, `${JSON.stringify(results, null, 2)}\n`);
	await context.close();
	await browser.close();
	await new Promise(resolve => server.close(resolve));
}
