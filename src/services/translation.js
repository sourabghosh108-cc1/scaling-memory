/**
 * Real Translation Service for Shrishti AI
 * Uses MyMemory Translation API with Lingva and Google Free endpoint fallbacks.
 * Zero Python, 100% browser-native async HTTP requests.
 */

export const LANGUAGE_MAP = {
  af: 'Afrikaans',
  ar: 'Arabic',
  bn: 'Bengali',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  gu: 'Gujarati',
  hi: 'Hindi',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  ko: 'Korean',
  ml: 'Malayalam',
  mr: 'Marathi',
  ne: 'Nepali',
  nl: 'Dutch',
  pa: 'Punjabi',
  pl: 'Polish',
  pt: 'Portuguese',
  ru: 'Russian',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
  vi: 'Vietnamese',
  zh: 'Chinese (Simplified)',
};

export function normalizeLangCode(input) {
  if (!input) return 'auto';
  const clean = input.trim().toLowerCase();

  // If already a known code
  if (LANGUAGE_MAP[clean]) return clean;

  // Search by name
  for (const [code, name] of Object.entries(LANGUAGE_MAP)) {
    if (name.toLowerCase() === clean || name.toLowerCase().startsWith(clean)) {
      return code;
    }
  }

  // Common aliases
  const aliases = {
    english: 'en',
    hindi: 'hi',
    french: 'fr',
    spanish: 'es',
    german: 'de',
    japanese: 'ja',
    chinese: 'zh',
    bengali: 'bn',
    russian: 'ru',
    korean: 'ko',
    italian: 'it',
    dutch: 'nl',
    portuguese: 'pt',
    auto: 'auto',
    automatic: 'auto'
  };

  return aliases[clean] || clean.slice(0, 2);
}

/**
 * Execute translation
 */
export async function translateText({ text, targetLanguage, sourceLanguage = 'auto' }) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('Please provide text to translate.');
  }

  const targetCode = normalizeLangCode(targetLanguage);
  let sourceCode = sourceLanguage ? normalizeLangCode(sourceLanguage) : 'auto';

  // Primary Provider: MyMemory Translation API (Free, high-quality, supports 100+ languages)
  const langPair = `${sourceCode === 'auto' ? 'autodetect' : sourceCode}|${targetCode}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${encodeURIComponent(langPair)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`MyMemory HTTP error ${res.status}`);
    }
    const data = await res.json();

    if (data.responseData && data.responseData.translatedText) {
      let detectedSource = sourceCode;
      if (data.matches && data.matches.length > 0) {
        const best = data.matches[0];
        if (best.source && best.source !== 'autodetect') {
          detectedSource = best.source.toLowerCase();
        }
      }

      return {
        originalText: text.trim(),
        translatedText: data.responseData.translatedText,
        sourceLanguage: detectedSource,
        sourceLanguageName: LANGUAGE_MAP[detectedSource] || detectedSource,
        targetLanguage: targetCode,
        targetLanguageName: LANGUAGE_MAP[targetCode] || targetCode,
        matchQuality: data.responseData.match ?? 1,
        provider: 'MyMemory Translated'
      };
    }
    throw new Error('No translated text returned from translation engine.');
  } catch (primaryErr) {
    console.warn('Primary translation service failed, attempting fallback...', primaryErr);

    // Fallback: Lingva Translate API (open-source Google Translate proxy)
    try {
      const lingvaSrc = sourceCode === 'auto' ? 'auto' : sourceCode;
      const lingvaUrl = `https://lingva.ml/api/v1/${lingvaSrc}/${targetCode}/${encodeURIComponent(text.trim())}`;
      const fallbackRes = await fetch(lingvaUrl);
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData.translation) {
          return {
            originalText: text.trim(),
            translatedText: fbData.translation,
            sourceLanguage: fbData.info?.detectedSource || sourceCode,
            sourceLanguageName: LANGUAGE_MAP[fbData.info?.detectedSource] || sourceCode,
            targetLanguage: targetCode,
            targetLanguageName: LANGUAGE_MAP[targetCode] || targetCode,
            provider: 'Lingva'
          };
        }
      }
    } catch (fbErr) {
      console.error('Fallback translation also failed:', fbErr);
    }

    throw new Error(`Translation failed: ${primaryErr.message}`);
  }
}

