const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { documentElement: { setAttribute() {} } };
const { interpolate } = require('../src/renderer/i18n/format.ts');
const { translateMessage } = require('../src/renderer/i18n/messages.ts');
const { t } = require('../src/renderer/i18n/index.ts');
const { useAppStore } = require('../src/renderer/stores/app.store.ts');
const en = require('../src/renderer/i18n/locales/en.json');
const tr = require('../src/renderer/i18n/locales/tr.json');
function flatten(obj, prefix = '') { return Object.fromEntries(Object.entries(obj).flatMap(([key, val]) => typeof val === 'object' ? Object.entries(flatten(val, prefix + key + '.')) : [[prefix + key, val]])); }
const a = flatten(en), b = flatten(tr);
assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
const names = s => [...s.matchAll(/\{\{([^{}]+)\}\}|\{([^{}]+)\}/g)].map(m => m[1] || m[2]).sort();
for (const key of Object.keys(a)) assert.deepEqual(names(a[key]), names(b[key]), 'Placeholder mismatch: ' + key);
assert.equal(interpolate('{{count}} nodes / {count}', { count: 3 }), '3 nodes / 3');
assert.equal(interpolate('{name}', { name: '$& <host> {count}' }), '$& <host> {count}');
assert.equal(interpolate('{name}', {}), '{name}');
for (const language of ['en', 'tr']) {
  useAppStore.getState().setLanguage(language);
  assert.equal(t('redTeamView.surfaceTopologyMap', { count: 4 }), (language === 'en' ? en : tr).redTeamView.surfaceTopologyMap.replace('{{count}}', '4'));
}
const nmap = 'Nmap bulunamadı. Yerel Node.js tarama motoru aktif.';
assert.match(translateMessage(nmap, 'en'), /Nmap was not found/);
assert.equal(translateMessage(nmap, 'tr'), nmap);
assert.equal(translateMessage('HSTS başlığı eksik', 'en'), 'Missing HSTS header');
assert.equal(translateMessage('Kayıt kapsamı: 2 varlık ve 4 açık port kaydı. Sonuçlar farklı zaman/hedeflere ait olabilir; envanterin tamamını veya güncel ağ durumunu kanıtlamaz.', 'en'), 'Record coverage: 2 assets and 4 open port records. Results may refer to different times/targets; they do not prove complete inventory or current network state.');
for (const input of ['https://example.org/?q=Eksik', 'CUSTOM_PROVIDER_RESULT', 'aabbcc', 123, null]) assert.equal(translateMessage(input, 'en'), input);
let references = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.tsx')) {
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isCallExpression(node) && ['t', 'translateText'].includes(node.expression.getText(ast)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text; references++; assert.equal(typeof a[key], 'string', 'Missing key: ' + key + ' in ' + file);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
}
walk(path.resolve(__dirname, '../src/renderer'));
console.log(JSON.stringify({ keysPerLanguage: Object.keys(a).length, translatedReferences: references, placeholdersMatch: true, missingKeys: 0, runtimeMessages: 'pass', rawDataPreserved: true }));
