import * as Speech from 'expo-speech';

const LOCALES: Record<string, string> = { en: 'en-US', da: 'da-DK', lt: 'lt-LT' };

/** True when the device has a voice for this language; without one, reading aloud would be garbled or silent. */
export async function canSpeak(lang: string | undefined): Promise<boolean> {
  const locale = LOCALES[lang ?? 'en'] ?? lang ?? 'en-US';
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    // Some platforms report no voices until the first utterance; treat an empty list as "try it".
    return voices.length === 0 || voices.some((v) => v.language.toLowerCase().startsWith(locale.slice(0, 2)));
  } catch {
    return false;
  }
}

/** Reads a cooking step aloud in the recipe's language, replacing whatever was being read. */
export function speak(text: string, lang: string | undefined): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: LOCALES[lang ?? 'en'] ?? lang ?? 'en-US', rate: 0.95 });
  } catch {
    /* no speech on this device */
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    /* nothing playing */
  }
}
