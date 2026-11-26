import { Capacitor } from "@capacitor/core";

// Must match the Android intent-filter in AndroidManifest.xml.
export const NATIVE_AUTH_CALLBACK_URL = "com.oursocial.app://login-callback";

export function getAuthRedirectUrl() {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_AUTH_CALLBACK_URL;
  }

  return window.location.origin;
}
