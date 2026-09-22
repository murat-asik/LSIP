import enDict from './locales/en.json';
import trDict from './locales/tr.json';
import { useAppStore, LanguageType } from '../stores/app.store';
import { interpolate } from './format';
import { translateMessage } from './messages';

const dictionaries: Record<LanguageType, any> = {
  en: enDict,
  tr: trDict,
};

/**
 * Gets nested property from object by string path (e.g., 'dashboard.title')
 */
function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof path !== 'string') return undefined;
  return path.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
}

function createSafeTranslationFunction(langGetter: () => LanguageType) {
  const fn = (key: string, params?: Record<string, any>): string => {
    if (!key) return '';
    const lang = langGetter() || 'en';
    const dict = dictionaries[lang] || dictionaries.en;

    let raw = getNestedValue(dict, key);
    
    // Fallback to English if key missing in target language
    if (raw === undefined && lang !== 'en') {
      raw = getNestedValue(dictionaries.en, key);
    }

    // Fallback to human readable key if missing everywhere
    if (raw === undefined) {
      const parts = key.split('.');
      const last = parts[parts.length - 1];
      return last ? last.charAt(0).toUpperCase() + last.slice(1) : key;
    }

    // Interpolate variables if present (e.g., "Hello {name}")
    if (params && typeof raw === 'string') {
      raw = interpolate(raw, params);
    }

    return String(raw);
  };

  // Attach Proxy to function so if code accesses fn.workspaces.blue, it returns empty string instead of crashing
  return new Proxy(fn, {
    get(target: any, prop: string | symbol) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string') {
        // Return a proxy that returns empty string for any property access
        return new Proxy(() => '', {
          get() {
            return '';
          },
        });
      }
      return undefined;
    },
  });
}

/**
 * Enterprise Translation Function
 * @param key Dot-separated key string (e.g. "common.status")
 * @param params Optional template interpolation params { count: 5 }
 */
export const t = createSafeTranslationFunction(() => useAppStore.getState()?.language || 'en');
export const message = (value: any) => translateMessage(value, useAppStore.getState()?.language || 'en');

/**
 * Custom React hook that subscribes to language changes in useAppStore
 */
export function useTranslation() {
  const { language } = useAppStore();

  const translate = createSafeTranslationFunction(() => language || 'en');

  return {
    t: translate,
    message: (value: any) => translateMessage(value, language || 'en'),
    language: language || 'en',
  };
}
