
import { Capacitor, registerPlugin } from "@capacitor/core";

const CallBackground = registerPlugin("CallBackground");

export async function startCallService({
  title = "LOLZ",
  text = "مكالمة نشطة",
  video = false,
} = {}) {
  if (!Capacitor.isNativePlatform()) {
    return { started: false, skipped: true };
  }

  return CallBackground.startCall({
    title,
    text,
    video: Boolean(video),
  });
}

export async function updateCallService({
  title = "LOLZ",
  text = "مكالمة نشطة",
  video = false,
} = {}) {
  if (!Capacitor.isNativePlatform()) {
    return { started: false, skipped: true };
  }

  return CallBackground.updateCallNotification({
    title,
    text,
    video: Boolean(video),
  });
}

export async function stopCallService() {
  if (!Capacitor.isNativePlatform()) {
    return { stopped: false, skipped: true };
  }

  return CallBackground.stopCall();
}
