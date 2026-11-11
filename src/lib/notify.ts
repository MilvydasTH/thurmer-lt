import { Platform } from 'react-native';

/**
 * Local notifications for cook-mode timers, so a timer still rings when the phone is locked or
 * the app is in the background. Loaded lazily and wrapped: on web, and in builds without the
 * notifications module, timers simply fall back to ringing only while the screen is open.
 */
type Module = typeof import('expo-notifications');
let loaded: Promise<Module | null> | undefined;

function load(): Promise<Module | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  loaded ??= import('expo-notifications')
    .then(async (N) => {
      // While the app is open the cook screen announces the timer itself; just play the sound.
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('timers', { name: 'Timers', importance: N.AndroidImportance.HIGH, vibrationPattern: [0, 400, 200, 400] });
      }
      return N;
    })
    .catch(() => null);
  return loaded;
}

/** Schedules an alert `seconds` from now. Returns an id to cancel it with, or undefined when not possible. */
export async function scheduleTimerAlert(title: string, body: string, seconds: number): Promise<string | undefined> {
  try {
    const N = await load();
    if (!N) return undefined;
    let perm = await N.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await N.requestPermissionsAsync();
    if (!perm.granted) return undefined;
    return await N.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'timers' },
    });
  } catch {
    return undefined;
  }
}

export async function cancelTimerAlert(id: string | undefined): Promise<void> {
  if (!id) return;
  try {
    const N = await load();
    await N?.cancelScheduledNotificationAsync(id);
  } catch {
    /* already fired or never scheduled */
  }
}
