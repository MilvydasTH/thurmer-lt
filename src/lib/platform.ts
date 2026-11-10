import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Linking, Platform, Share } from 'react-native';

import { uid } from './units';

/** Returns 'shared' when a share sheet opened, 'copied' when the text went to the clipboard instead. */
export async function shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, text });
        return 'shared';
      } catch (e) {
        // The person closing the share sheet is not a failure; anything else falls back to copying.
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      }
    }
    await Clipboard.setStringAsync(text);
    return 'copied';
  }
  const res = await Share.share({ message: text, title });
  return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
}

export async function saveTextFile(filename: string, contents: string, mime = 'application/json'): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename, UTI: 'public.json' });
}

export async function pickTextFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    if (asset.file) return await asset.file.text();
    return await (await fetch(asset.uri)).text();
  }
  return await new File(asset.uri).text();
}

export interface PickedImage {
  /** A URI that stays valid: a file in the app's documents on native, a data URL on web. */
  uri: string;
  base64: string;
  mediaType: 'image/jpeg';
}

export async function pickImage(source: 'library' | 'camera', opts: { maxWidth?: number; persist?: boolean } = {}): Promise<PickedImage | null> {
  const maxWidth = opts.maxWidth ?? (Platform.OS === 'web' ? 900 : 1400);
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('permission');
  }
  const picker = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const res = await picker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const actions = asset.width && asset.width > maxWidth ? [{ resize: { width: maxWidth } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: Platform.OS === 'web' ? 0.7 : 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  const base64 = (out.base64 ?? '').replace(/^data:image\/\w+;base64,/, '');
  if (Platform.OS === 'web' || opts.persist === false) {
    return { uri: `data:image/jpeg;base64,${base64}`, base64, mediaType: 'image/jpeg' };
  }
  // The manipulator writes to the cache, which the OS may purge; keep recipe photos in documents.
  const dest = new File(Paths.document, `photo-${uid()}.jpg`);
  new File(out.uri).copy(dest);
  return { uri: dest.uri, base64, mediaType: 'image/jpeg' };
}

export async function readClipboard(): Promise<string> {
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return '';
  }
}

export function openUrl(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}
