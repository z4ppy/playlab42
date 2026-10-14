import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

test('Le guide français traduit les vingt pages, pas leurs sélecteurs interactifs', async () => {
	const source = await readFile(new URL('../src/utils/textbookPages.ts', import.meta.url), 'utf8');
	const syntax = ts.createSourceFile('textbookPages.ts', source, ts.ScriptTarget.Latest, true);
	const declaration = syntax.statements
		.filter(ts.isVariableStatement)
		.flatMap(statement => [...statement.declarationList.declarations])
		.find(variable => variable.name.getText(syntax) === 'textPages');
	const mapping = declaration.initializer;
	assert.ok(ts.isCallExpression(mapping));
	assert.equal(mapping.expression.name.text, 'map');
	const pages = mapping.expression.expression;
	assert.ok(ts.isArrayLiteralExpression(pages));
	const ids = pages.elements.map(page =>
		page.properties.find(property => property.name?.getText(syntax) === 'id').initializer.text
	);
	const translationSource = await readFile(new URL('../src/utils/textbook-fr.ts', import.meta.url), 'utf8');
	const { outputText } = ts.transpileModule(translationSource, {
		compilerOptions: { module: ts.ModuleKind.ESNext }
	});
	const { textbookFr } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
	assert.equal(ids.length, 20);
	assert.deepEqual(Object.keys(textbookFr).sort(), ids.sort());
	for (const page of Object.values(textbookFr)) {
		assert.deepEqual(Object.keys(page).sort(), ['content', 'title']);
		assert.ok(page.title && page.content);
	}
});
