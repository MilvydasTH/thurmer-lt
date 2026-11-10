import { router } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import React, { useEffect } from 'react';

import { firstUrl } from '@/lib/importer';

/**
 * Receives links and text shared into the app from other apps ("Share → Skanu" in Instagram,
 * TikTok, Safari…) and opens the importer with them. Needs a development or store build:
 * the share extension is not part of Expo Go, which is why this is wrapped in a boundary.
 */
function Listener() {
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();

  useEffect(() => {
    if (!sharedPayloads || sharedPayloads.length === 0) return;
    const values = sharedPayloads.map((p) => p.value).filter(Boolean);
    const joined = values.join('\n');
    const url = firstUrl(joined);
    clearSharedPayloads();
    if (url) router.push({ pathname: '/import', params: { mode: 'link', url, auto: '1' } });
    else if (joined.trim()) router.push({ pathname: '/import', params: { mode: 'text', text: joined.slice(0, 8000) } });
  }, [sharedPayloads, clearSharedPayloads]);

  return null;
}

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* sharing into the app is unavailable in this build; nothing to do */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function IncomingShare() {
  return (
    <Boundary>
      <Listener />
    </Boundary>
  );
}
