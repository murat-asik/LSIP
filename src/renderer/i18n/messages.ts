import en from './locales/en.json';
import tr from './locales/tr.json';
import { interpolate } from './format';

const catalogs = { en: en.interfaceText, tr: tr.interfaceText };
const exact = new Map<string, keyof typeof en.interfaceText>();
const templates: Array<{ pattern: RegExp; names: string[]; key: keyof typeof en.interfaceText }> = [];
for (const key of Object.keys(en.interfaceText) as Array<keyof typeof en.interfaceText>) {
  for (const language of ['en', 'tr'] as const) {
    const value = catalogs[language][key];
    exact.set(value, key);
    const names: string[] = [];
    const parts = value.split(/(\{[a-zA-Z][a-zA-Z0-9]*\})/g);
    if (parts.length > 1) {
      const pattern = parts.map(part => {
        if (/^\{[a-zA-Z][a-zA-Z0-9]*\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)'; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      templates.push({ pattern: new RegExp('^' + pattern + '$'), names, key });
    }
  }
}

/** Presentation only: unknown provider text, identifiers and raw evidence are preserved. */
export function translateMessage(value: any, language: 'en' | 'tr'): any {
  if (typeof value !== 'string') return value;
  const key = exact.get(value);
  if (key) return catalogs[language][key];
  for (const template of templates) {
    const match = value.match(template.pattern);
    if (match) return interpolate(catalogs[language][template.key], Object.fromEntries(template.names.map((name, i) => [name, match[i + 1]])));
  }
  return value;
}
