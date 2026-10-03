import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const skills = ['playlab-ui', 'playlab-create-game', 'playlab-create-epic', 'playlab-release', 'playlab-review'];

describe('Skills de projet versionnés', () => {
  test.each(skills)('%s possède des métadonnées et références utilisables', name => {
    const path = resolve(root, '.github', 'skills', name, 'SKILL.md');
    const text = readFileSync(path, 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    expect(frontmatter).not.toBeNull();
    const metadata = parse(frontmatter[1]);
    expect(metadata.name).toBe(name);
    expect(typeof metadata.description).toBe('string');
    expect(metadata.description.trim().length).toBeGreaterThan(20);
    expect(text.split('\n').length).toBeLessThan(500);
    for (const [, target] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (!/^(?:https?:|#)/.test(target)) {
        expect(existsSync(resolve(dirname(path), target.split('#')[0]))).toBe(true);
      }
    }
  });

  test.each(skills)('%s fournit des demandes et assertions évaluables', name => {
    const data = JSON.parse(readFileSync(resolve(root, '.github', 'skills', name, 'evals', 'evals.json'), 'utf8'));
    expect(data.skill_name).toBe(name);
    expect(data.evals.length).toBeGreaterThanOrEqual(2);
    expect(new Set(data.evals.map(item => item.id)).size).toBe(data.evals.length);
    for (const item of data.evals) {
      expect(typeof item.prompt).toBe('string');
      expect(item.prompt.length).toBeGreaterThan(30);
      expect(typeof item.expected_output).toBe('string');
      expect(item.assertions.length).toBeGreaterThan(0);
      item.files.forEach(path => expect(existsSync(resolve(root, path))).toBe(true));
    }
    expect(data.trigger_cases.some(item => item.should_trigger)).toBe(true);
    expect(data.trigger_cases.some(item => !item.should_trigger)).toBe(true);
  });
});
