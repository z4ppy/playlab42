import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const manifest = JSON.parse(await readFile(new URL('../static/model-manifest.json', import.meta.url), 'utf8'));
const chunk = manifest.chunks[0];
const url = `${manifest.source}/${chunk.file}`;
const browser = await chromium.connectOverCDP(process.env.BROWSER_CDP);
const context = await browser.newContext();
const report = { source: url, nativeBrowserTransport: true, relay: false, events: [] };
try {
	const page = await context.newPage();
	const network = await context.newCDPSession(page);
	const ids = new Set();
	network.on('Network.requestWillBeSent', event => {
		if (event.request.url === url) ids.add(event.requestId);
	});
	network.on('Network.responseReceivedExtraInfo', event => {
		if (ids.has(event.requestId)) report.events.push({
			networkStatus: event.statusCode,
			allowOrigin: Object.entries(event.headers).find(([key]) => key.toLowerCase() === 'access-control-allow-origin')?.[1] ?? null
		});
	});
	await network.send('Network.enable');
	page.on('response', response => {
		if (response.url() === url) report.events.push({ status: response.status(), allowOrigin: response.headers()['access-control-allow-origin'] ?? null });
	});
	page.on('requestfailed', request => {
		if (request.url() === url) report.events.push({ failure: request.failure()?.errorText });
	});
	page.on('console', message => {
		if (message.type() === 'error') report.events.push({ console: message.text() });
	});
	await page.goto('http://localhost:9222/json/version');
	report.result = await page.evaluate(async url => {
		try {
			const response = await fetch(url, {
				credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(60_000)
			});
			if (!response.ok) return { status: response.status, error: `HTTP ${response.status}` };
			const bytes = await response.arrayBuffer();
			const digest = await crypto.subtle.digest('SHA-256', bytes);
			return { status: response.status, bytes: bytes.byteLength, sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
		} catch (error) {
			return { error: error.message };
		}
	}, url);
	report.fragmentVerified = report.result.bytes === chunk.bytes && report.result.sha256 === chunk.sha256;
	report.fullInferenceCertified = false;
	await mkdir('browser-results', { recursive: true });
	await writeFile('browser-results/direct-transport.json', `${JSON.stringify(report, null, 2)}\n`);
	console.log(JSON.stringify(report, null, 2));
} finally {
	await context.close();
	await browser.close();
}
