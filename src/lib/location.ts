import * as Location from 'expo-location';

export interface Place {
  lat: number;
  lng: number;
}

let cached: { at: number; place: Place } | undefined;

/**
 * Roughly where the phone is, for "stores near me". Rounded to about a kilometre before it
 * leaves the device: enough to pick nearby shops, not enough to pinpoint a home.
 * Returns null when the person declines or the position cannot be found.
 */
export async function approximatePlace(): Promise<Place | null> {
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.place;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!pos) return null;
    const round = (n: number) => Math.round(n * 100) / 100;
    const place = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
    cached = { at: Date.now(), place };
    return place;
  } catch {
    return null;
  }
}
