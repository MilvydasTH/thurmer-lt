import { useEffect } from 'react';
import { AppState } from 'react-native';

import { toast } from '@/components/ui';
import { useT } from '@/i18n';
import { syncFamily } from '@/lib/familySync';
import { useStore } from '@/store';

/**
 * Keeps the family library in step without anyone pressing a button: when the app opens,
 * when it comes back to the front, a few seconds after a local change, and every few minutes
 * while it stays open. Renders nothing.
 */
export function FamilySync() {
  const t = useT();
  const joined = useStore((s) => !!s.family);
  const pending = useStore((s) => s.dirty.length + s.tombstones.length);

  useEffect(() => {
    if (!joined) return;
    const go = () =>
      syncFamily().then((r) => {
        if (r === 'removed') toast(t('family_removed'));
      });
    go();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') go();
    });
    const every = setInterval(go, 4 * 60_000);
    return () => {
      sub.remove();
      clearInterval(every);
    };
  }, [joined, t]);

  useEffect(() => {
    if (!joined || pending === 0) return;
    // Wait a moment so a burst of edits goes out as one exchange.
    const timer = setTimeout(() => void syncFamily(), 3000);
    return () => clearTimeout(timer);
  }, [joined, pending]);

  return null;
}
