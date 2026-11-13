/**
 * The timer's own ring. Played by the app itself, and allowed in silent mode, because a kitchen
 * timer nobody hears has failed at its one job; the phone's notification sound still obeys the
 * silent switch. Loaded lazily and wrapped so a missing audio module only costs the sound.
 */
export async function playTimerSound(): Promise<void> {
  try {
    const Audio = await import('expo-audio');
    await Audio.setAudioModeAsync({ playsInSilentMode: true });
    const player = Audio.createAudioPlayer(require('@/assets/sounds/timer.wav'));
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* already released */
      }
    }, 4000);
  } catch {
    /* no audio in this build; the on-screen alert and vibration still fire */
  }
}
