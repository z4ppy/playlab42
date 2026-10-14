import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDiagramRect } from './geometry.js';

test('les liens SVG restent locaux même avec introduction, iframe et scroll document', () => {
	const rect = { left: 230, right: 310, top: 540, bottom: 580, width: 80, height: 40 };
	const origin = { left: 100, top: 400 };
	const result = toDiagramRect(rect, origin, 20, 70);
	assert.equal(result.left + 20, 130);
	assert.equal(result.top + 70, 140);
	assert.equal(result.right + 20, 210);
	assert.equal(result.bottom + 70, 180);
	assert.equal(result.width, 80);
	assert.equal(result.height, 40);
});

test('le défilement de la surface ne déplace pas les coordonnées internes', () => {
	const rect = { left: 50, right: 130, top: 50, bottom: 90, width: 80, height: 40 };
	const origin = { left: -80, top: -90 };
	const result = toDiagramRect(rect, origin);
	assert.equal(result.left, 130);
	assert.equal(result.top, 140);
});
