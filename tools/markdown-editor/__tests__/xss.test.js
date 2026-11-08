/**
 * Sécurité : aucun vecteur XSS classique ne doit produire de balise active,
 * d'attribut d'événement ou d'URL exécutable.
 */
import { renderHtml, escapeHtml } from '../src/render-html.js';
import { isSafeUrl, normalizeUrl, sanitizeUrl, urlScheme } from '../src/sanitize-url.js';

const TAB = String.fromCharCode(9);
const ZWSP = String.fromCharCode(0x200B);
const NUL = String.fromCharCode(0);
/** Schéma « javascript: » assemblé pour ne pas déclencher la règle no-script-url. */
const JS = ['java', 'script:'].join('');

/** Vecteurs Markdown et HTML classiques. */
const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:alert(1)">x</a>',
  '[x](javascript:alert(1))',
  '[x](JaVaScRiPt:alert(1))',
  `[x](java${TAB}script:alert(1))`,
  `[x](jav${ZWSP}ascript:alert(1))`,
  '[x](&#106;avascript:alert(1))',
  '[x](&#x6A;avascript&colon;alert(1))',
  '[x](javascript&colon;alert(1))',
  '[x](<javascript:alert(1)>)',
  '[x]( javascript:alert(1))',
  '[x](vbscript:msgbox(1))',
  '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '[x](file:///etc/passwd)',
  '![x](javascript:alert(1))',
  '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
  '![x](data:text/html,<script>alert(1)</script>)',
  '<javascript:alert(1)>',
  '<vbscript:msgbox(1)>',
  '[x][r]\n\n[r]: javascript:alert(1)',
  '[x](/u "\\" onmouseover=\\"alert(1)")',
  '[x](/u \'" onmouseover="alert(1)\')',
  '![x" onerror="alert(1)](/i.png)',
  '```"><script>alert(1)</script>\ncode\n```',
  '# "><img src=x onerror=alert(1)>',
  '`<script>alert(1)</script>`',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '| <script>alert(1)</script> |\n| - |\n| <img onerror=alert(1)> |',
  '- [ ] <b onclick=alert(1)>x</b>',
  `[x](javascript${NUL}:alert(1))`,
  '[x](%6Aavascript:alert(1))',
];

const ATTRIBUTES = ['href', 'title', 'src', 'alt', 'class', 'id', 'start', 'align', 'type', 'checked', 'disabled'];

describe('rendu sûr par construction', () => {
  test.each(PAYLOADS.map((payload) => [payload]))('%s', (payload) => {
    const html = renderHtml(payload);
    // Aucune balise autre que celles du moteur de rendu.
    const tags = [...html.matchAll(/<([a-z][a-z0-9]*)/g)].map((match) => match[1]);
    const allowed = new Set(['p', 'h1', 'a', 'img', 'span', 'code', 'pre', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'li', 'input', 'em', 'strong']);
    expect(tags.filter((tag) => !allowed.has(tag))).toEqual([]);
    // Chaque balise n'a que des attributs connus, bien formés et entre guillemets
    // (un « onerror= » échappé dans une valeur reste du texte inoffensif).
    for (const [, , attrs] of html.matchAll(/<([a-z][a-z0-9]*)([^>]*)>/g)) {
      const rest = attrs.replace(/\s([a-z-]+)="[^"<>]*"/g, (_all, name) => {
        expect(ATTRIBUTES).toContain(name);
        return '';
      });
      expect(rest.replace(/\s*\/$/, '')).toBe('');
    }
    // Aucune URL active dangereuse.
    for (const match of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      expect(isSafeUrl(match[1].replace(/&amp;/g, '&'), { image: true })).toBe(true);
      expect(match[1]).not.toMatch(/^\s*(?:javascript|vbscript|data:text|file):/i);
    }
  });

  test('un lien refusé garde son texte, sans href', () => {
    expect(renderHtml('[cliquer](javascript:alert(1))')).toBe(
      '<p><span class="md-blocked" title="Lien bloqué : adresse non autorisée">cliquer</span></p>\n',
    );
  });

  test('une image refusée affiche son texte alternatif', () => {
    expect(renderHtml('![logo](data:image/svg+xml,abc)')).toContain('<span class="md-blocked" title="Image bloquée : adresse non autorisée">logo</span>');
  });

  test('les guillemets d\'un titre sont échappés', () => {
    expect(renderHtml('[x](/u "a\\"b")')).toBe('<p><a href="/u" title="a&quot;b">x</a></p>\n');
  });

  test('escapeHtml', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('filtrage d\'URL', () => {
  test.each([
    ['https://exemple.org', true],
    ['http://exemple.org', true],
    ['mailto:a@b.c', true],
    ['tel:+33100000000', true],
    ['/relatif/page', true],
    ['#ancre', true],
    ['?q=1', true],
    ['./a:b', true],
    [`${JS}alert(1)`, false],
    [' JAVASCRIPT:alert(1)', false],
    [`java${TAB}script:x`, false],
    ['vbscript:x', false],
    ['data:image/png;base64,AAAA', false],
    ['ftp://x', false],
    ['irc://x', false],
  ])('lien %s → %s', (url, safe) => {
    expect(isSafeUrl(url)).toBe(safe);
  });

  test.each([
    ['data:image/png;base64,AAAA', true],
    ['data:image/jpeg;base64,AAAA', true],
    ['data:image/webp,AAAA', true],
    ['DATA:IMAGE/GIF;base64,R0lG', true],
    ['data:image/svg+xml;base64,AAAA', false],
    ['data:text/html,x', false],
    ['data:image/png' , false],
  ])('image %s → %s', (url, safe) => {
    expect(isSafeUrl(url, { image: true })).toBe(safe);
  });

  test('schéma détecté malgré les caractères ignorés', () => {
    expect(urlScheme(`${NUL} java${ZWSP}script:x`)).toBe('javascript');
    expect(urlScheme('/chemin')).toBeNull();
  });

  test('normalisation en pourcentage', () => {
    expect(normalizeUrl('/a b/é?x=1&y=[2]')).toBe('/a%20b/%C3%A9?x=1&y=%5B2%5D');
    expect(normalizeUrl('/déjà%20encodé%zz')).toBe('/d%C3%A9j%C3%A0%20encod%C3%A9%25zz');
    expect(normalizeUrl(`/x${String.fromCharCode(0xD800)}`)).toBe('/x%EF%BF%BD');
    expect(sanitizeUrl(`${JS}x`)).toBeNull();
    expect(sanitizeUrl('https://a.org/é')).toBe('https://a.org/%C3%A9');
  });
});
