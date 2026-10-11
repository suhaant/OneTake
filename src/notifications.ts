/**
 * Notifications: a remote push token for the server's nudges (friend scored, streak saver),
 * plus a local 9pm streak reminder scheduled on the device so it works without the server and
 * in Expo Go on Android, where remote push is unavailable.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ApiError } from './api';

const STREAK_HOUR = 21;
const REMINDER_ID = 'streak-reminder';

let configured = false;

/** Call once at startup: foreground banners on, and a tapped notification opens the app's deep link. */
export function configureNotifications(onOpenUrl: (url: string) => void) {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') onOpenUrl(url);
  });
  // The app was launched by tapping a notification.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string') onOpenUrl(url);
    })
    .catch(() => {});
}

/** Asks for permission if needed. Throws ApiError('notifications_denied') when the user said no. */
export async function ensurePermission(): Promise<void> {
  if (Platform.OS === 'web') throw new ApiError('push_unavailable');
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return;
  if (!current.canAskAgain) throw new ApiError('notifications_denied');
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  if (!asked.granted) throw new ApiError('notifications_denied');
}

/**
 * The Expo push token for this device, or null where remote push cannot work: Expo Go on Android
 * (SDK 53+), or no EAS project id yet (`npx eas init` adds one to app.json). Local reminders are
 * unaffected.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    console.warn('[onetake] push token unavailable:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Keeps exactly one local reminder scheduled for the next 9pm on which the user still needs to
 * take the prompt: tonight if today's take is not done and it is before 9pm, otherwise tomorrow.
 * Call whenever "done today" may have changed. With `enabled` false it clears the reminder.
 */
export async function scheduleStreakReminder(enabled: boolean, doneToday: boolean, streak: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    if (!enabled) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const at = new Date();
    at.setHours(STREAK_HOUR, 0, 0, 0);
    if (doneToday || at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: streak > 0 ? `Your ${streak}-day streak ends tonight` : "Today's take is still open",
        body: streak > 0 ? 'One 30-second take keeps it alive. The panda is waiting.' : "Thirty seconds, one take. Get today's prompt in before midnight.",
        sound: 'default',
        data: { url: 'onetake://', kind: 'streak_saver' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch (err) {
    console.warn('[onetake] could not schedule reminder:', err instanceof Error ? err.message : String(err));
  }
}
