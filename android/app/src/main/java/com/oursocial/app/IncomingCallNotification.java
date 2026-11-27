package com.oursocial.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import java.util.Map;

public final class IncomingCallNotification {

    public static final String CHANNEL_ID = "lolz_incoming_calls";
    private static final String URI_SCHEME = "com.oursocial.app";
    private static final String URI_HOST = "call";
    private static final int REQUEST_BASE = 62000;

    private IncomingCallNotification() {}

    public static void show(Context context, Map<String, String> data) {
        String callId = safe(data.get("call_id"));
        if (callId.isEmpty()) return;

        createChannel(context, data.get("language"));

        String callerName = safe(data.get("caller_name"));
        if (callerName.isEmpty()) callerName = "LOLZ";

        String mediaType = safe(data.get("media_type"));
        boolean video = "video".equalsIgnoreCase(mediaType);
        String language = "en".equalsIgnoreCase(data.get("language")) ? "en" : "ar";
        String callLabel = video
                ? (language.equals("ar") ? "مكالمة فيديو واردة" : "Incoming video call")
                : (language.equals("ar") ? "مكالمة صوتية واردة" : "Incoming audio call");

        int notificationId = notificationId(callId);

        Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class);
        copyCallData(data, fullScreenIntent);
        fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                requestCode(callId, "fullscreen"),
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent openPendingIntent = PendingIntent.getActivity(
                context,
                requestCode(callId, "open"),
                createMainIntent(context, data, "open"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent answerPendingIntent = PendingIntent.getActivity(
                context,
                requestCode(callId, "answer"),
                createMainIntent(context, data, "answer"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent declinePendingIntent = PendingIntent.getActivity(
                context,
                requestCode(callId, "decline"),
                createMainIntent(context, data, "reject"),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);

        builder
                .setSmallIcon(R.drawable.ic_stat_lolz)
                .setContentTitle(callerName)
                .setContentText(callLabel)
                .setSubText(safe(data.get("group_name")).isEmpty()
                        ? safe(data.get("channel_name"))
                        : safe(data.get("group_name")))
                .setColor(Color.rgb(119, 112, 255))
                .setCategory(Notification.CATEGORY_CALL)
                .setPriority(Notification.PRIORITY_MAX)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(false)
                .setContentIntent(openPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Person caller = new Person.Builder()
                    .setName(callerName)
                    .setImportant(true)
                    .build();

            Notification.CallStyle callStyle = Notification.CallStyle
                    .forIncomingCall(caller, declinePendingIntent, answerPendingIntent)
                    .setIsVideo(video)
                    .setDeclineButtonColorHint(Color.rgb(220, 65, 75))
                    .setAnswerButtonColorHint(Color.rgb(38, 166, 100));

            builder.setStyle(callStyle);
        } else {
            String declineLabel = language.equals("ar") ? "رفض" : "Decline";
            String answerLabel = language.equals("ar") ? "قبول" : "Answer";
            builder.addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    declineLabel,
                    declinePendingIntent
            );
            builder.addAction(
                    android.R.drawable.sym_action_call,
                    answerLabel,
                    answerPendingIntent
            );
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setTimeoutAfter(45_000L);
        }

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }

    public static void cancel(Context context, String callId) {
        if (safe(callId).isEmpty()) return;
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(notificationId(callId));
    }

    public static void launchMainActivity(Context context, Intent source, String action) {
        String callId = source.getStringExtra("call_id");
        Uri.Builder uri = new Uri.Builder()
                .scheme(URI_SCHEME)
                .authority(URI_HOST)
                .appendQueryParameter("action", action);

        append(uri, "call_id", callId);
        append(uri, "conversation_id", source.getStringExtra("conversation_id"));
        append(uri, "group_id", source.getStringExtra("group_id"));
        append(uri, "channel_id", source.getStringExtra("channel_id"));
        append(uri, "call_type", source.getStringExtra("call_type"));
        append(uri, "media_type", source.getStringExtra("media_type"));

        Intent intent = new Intent(Intent.ACTION_VIEW, uri.build(), context, MainActivity.class);
        intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        context.startActivity(intent);
        cancel(context, callId);
    }

    private static Intent createMainIntent(
            Context context,
            Map<String, String> data,
            String action
    ) {
        Uri.Builder uri = new Uri.Builder()
                .scheme(URI_SCHEME)
                .authority(URI_HOST)
                .appendQueryParameter("action", action);

        append(uri, "call_id", data.get("call_id"));
        append(uri, "conversation_id", data.get("conversation_id"));
        append(uri, "group_id", data.get("group_id"));
        append(uri, "channel_id", data.get("channel_id"));
        append(uri, "call_type", data.get("call_type"));
        append(uri, "media_type", data.get("media_type"));

        Intent intent = new Intent(Intent.ACTION_VIEW, uri.build(), context, MainActivity.class);
        intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        return intent;
    }

    private static void copyCallData(Map<String, String> data, Intent intent) {
        String[] keys = {
                "call_id", "conversation_id", "group_id", "channel_id",
                "call_type", "media_type", "caller_name", "group_name",
                "channel_name", "language"
        };
        for (String key : keys) {
            String value = data.get(key);
            if (value != null) intent.putExtra(key, value);
        }
    }

    private static void createChannel(Context context, String language) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        String channelName = "en".equalsIgnoreCase(language)
                ? "Incoming calls"
                : "المكالمات الواردة";

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Incoming LOLZ audio and video calls");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 700, 350, 700});
        channel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
        );
        manager.createNotificationChannel(channel);
    }

    private static Uri.Builder append(Uri.Builder builder, String key, String value) {
        if (value != null && !value.trim().isEmpty()) {
            builder.appendQueryParameter(key, value);
        }
        return builder;
    }

    private static int requestCode(String callId, String action) {
        return REQUEST_BASE + ((callId + ":" + action).hashCode() & 0x3fffffff);
    }

    private static int notificationId(String callId) {
        return 5200 + (callId.hashCode() & 0x3fffffff) % 100000;
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
