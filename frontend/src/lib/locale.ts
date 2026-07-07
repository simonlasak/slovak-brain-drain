import { useEffect, useState } from 'react';

export type Locale = 'sk' | 'en';

// English is the authoritative language for now; Slovak copy is being authored
// by Simon and lands section by section. Flip DEFAULT_LOCALE to 'sk' once the
// Slovak drafts are reviewed.
export const DEFAULT_LOCALE: Locale = 'en';

const STORAGE_KEY = 'sbd-locale';
const EVENT = 'sbd-locale-change';

export function getLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'sk' || stored === 'en' ? stored : DEFAULT_LOCALE;
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  document.documentElement.setAttribute('data-locale', locale);
  window.dispatchEvent(new CustomEvent<Locale>(EVENT, { detail: locale }));
}

/**
 * React hook. Returns the active locale and re-renders any island when the
 * locale changes anywhere (nav toggle, another island, another tab).
 */
export function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // Sync to the real value on mount (avoids SSR/client hydration mismatch).
    setLocaleState(getLocale());

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      setLocaleState(detail ?? getLocale());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLocaleState(getLocale());
    };

    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return locale;
}

/** Pick the value for the active locale from a bilingual record. */
export function t<T>(bundle: Record<Locale, T>, locale: Locale): T {
  return bundle[locale];
}
