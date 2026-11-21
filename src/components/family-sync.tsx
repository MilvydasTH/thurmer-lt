import { useEffect } from 'react';
import { AppState } from 'react-native';

import { toast } from '@/components/ui';
import { useT } from '@/i18n';
import { syncFamily } from '@/lib/familySync';
import { useStore } from '@/store';

/**
 * Keeps the family library in step without anyone pressing a button: when the app opens,
 * when it comes back to the front, a moment after a local change, and every half minute
 * while it stays open. Renders nothing.
 */
export function FamilySync() {
  const t = useT();
  const joined = useStore((s) => !!s.family);
  const pending = useStore((s) => s.dirty.length + s.tombstones.length + s.cartDirty.length + s.cartGone.length);

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
    // Often enough that a shared shopping list feels live while two people are in the shop.
    const every = setInterval(go, 30_000);
    return () => {
      sub.remove();
      clearInterval(every);
    };
  }, [joined, t]);

  useEffect(() => {
    if (!joined || pending === 0) return;
    // Wait a moment so a burst of edits goes out as one exchange.
    const timer = setTimeout(() => void syncFamily(), 1500);
    return () => clearTimeout(timer);
  }, [joined, pending]);

  return null;
}
