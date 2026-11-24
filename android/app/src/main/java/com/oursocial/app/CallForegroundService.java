
package com.oursocial.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class CallForegroundService extends Service {

    public static final String ACTION_START =
            "com.oursocial.app.CALL_START";

    public static final String ACTION_UPDATE =
            "com.oursocial.app.CALL_UPDATE";

    public static final String EXTRA_TITLE = "call_title";
    public static final String EXTRA_TEXT = "call_text";
    public static final String EXTRA_VIDEO = "call_video";

    private static final String CHANNEL_ID = "lolz_active_calls";
    private static final int NOTIFICATION_ID = 4101;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        if (intent == null) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (!ACTION_START.equals(action)
                && !ACTION_UPDATE.equals(action)) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra(EXTRA_TITLE);
        String text = intent.getStringExtra(EXTRA_TEXT);
        boolean video = intent.getBooleanExtra(EXTRA_VIDEO, false);

        if (title == null || title.trim().isEmpty()) {
            title = "LOLZ";
        }

        if (text == null || text.trim().isEmpty()) {
            text = "مكالمة نشطة";
        }

        Notification notification =
                buildNotification(title, text);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {

                int serviceType =
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;

                if (video) {
                    serviceType |=
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
                }

                ServiceCompat.startForeground(
                        this,
                        NOTIFICATION_ID,
                        notification,
                        serviceType
                );

            } else {
                startForeground(
                        NOTIFICATION_ID,
                        notification
                );
            }

        } catch (SecurityException | IllegalArgumentException error) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        return START_NOT_STICKY;
    }

    private Notification buildNotification(
            String title,
            String text
    ) {

        Intent openAppIntent =
                new Intent(this, MainActivity.class);

        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);

        openAppIntent.setFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        4101,
                        openAppIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(this, CHANNEL_ID);

        return builder
                .setSmallIcon(android.R.drawable.sym_action_call)
                .setContentTitle(title)
                .setContentText(text)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .setContentIntent(pendingIntent)
                .build();
    }

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL_ID,
                            "LOLZ Active Calls",
                            NotificationManager.IMPORTANCE_LOW
                    );

            channel.setDescription(
                    "Shows ongoing LOLZ calls"
            );

            channel.setLockscreenVisibility(
                    Notification.VISIBILITY_PUBLIC
            );

            NotificationManager manager =
                    getSystemService(NotificationManager.class);

            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
