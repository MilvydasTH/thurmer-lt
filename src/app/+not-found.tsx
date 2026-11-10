import { Redirect } from 'expo-router';

/** Unknown paths (an old link, a host that serves the app from a sub-path) land on the recipe list. */
export default function NotFound() {
  return <Redirect href="/" />;
}
