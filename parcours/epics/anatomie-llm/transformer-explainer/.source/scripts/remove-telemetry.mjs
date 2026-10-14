import ts from 'typescript';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Supprimer les expressions, pas les callbacks interactifs qui les entourent.
function sanitize(folder) {
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const path = join(folder, entry.name);
		if (entry.isDirectory()) { sanitize(path); continue; }
		if (!/\.(?:ts|svelte)$/.test(path)) continue;
		const original = readFileSync(path, 'utf8');
		const start = entry.name.endsWith('.svelte') ? original.indexOf('>', original.indexOf('<script')) + 1 : 0;
		const end = entry.name.endsWith('.svelte') ? original.indexOf('</script>', start) : original.length;
		if (end < 0) continue;
		const code = original.slice(start, end);
		const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
		const ranges = [];
		function visit(node) {
			if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
				&& /dataLayer.*\.push/.test(node.expression.expression.getText(source))) {
				ranges.push([node.getStart(source), node.end]);
			} else ts.forEachChild(node, visit);
		}
		visit(source);
		let result = code;
		for (const [from, to] of ranges.reverse()) result = result.slice(0, from) + result.slice(to);
		if (ranges.length) writeFileSync(path, original.slice(0, start) + result + original.slice(end));
	}
}
sanitize('src');
