
package com.oursocial.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CallBackground")
public class CallBackgroundPlugin extends Plugin {

    private static final String DEFAULT_TITLE = "LOLZ";
    private static final String DEFAULT_TEXT = "مكالمة نشطة";

    /**
     * Start the Android foreground service for an active call.
     */
    @PluginMethod
    public void startCall(PluginCall call) {

        boolean video = Boolean.TRUE.equals(
                call.getBoolean("video")
        );

        if (!hasRuntimePermission(Manifest.permission.RECORD_AUDIO)) {
            call.reject(
                    "Microphone permission has not been granted."
            );
            return;
        }

        if (video && !hasRuntimePermission(Manifest.permission.CAMERA)) {
            call.reject(
                    "Camera permission has not been granted."
            );
            return;
        }

        String title = getSafeString(
                call.getString("title"),
                DEFAULT_TITLE
        );

        String text = getSafeString(
                call.getString("text"),
                DEFAULT_TEXT
        );

        launchCallService(
                CallForegroundService.ACTION_START,
                title,
                text,
                video,
                call
        );
    }

    /**
     * Update the ongoing call notification.
     */
    @PluginMethod
    public void updateCallNotification(PluginCall call) {

        boolean video = Boolean.TRUE.equals(
                call.getBoolean("video")
        );

        if (!hasRuntimePermission(Manifest.permission.RECORD_AUDIO)) {
            call.reject(
                    "Microphone permission has not been granted."
            );
            return;
        }

        if (video && !hasRuntimePermission(Manifest.permission.CAMERA)) {
            call.reject(
                    "Camera permission has not been granted."
            );
            return;
        }

        String title = getSafeString(
                call.getString("title"),
                DEFAULT_TITLE
        );

        String text = getSafeString(
                call.getString("text"),
                DEFAULT_TEXT
        );

        launchCallService(
                CallForegroundService.ACTION_UPDATE,
                title,
                text,
                video,
                call
        );
    }

    /**
     * Stop the Android foreground call service.
     */
    @PluginMethod
    public void stopCall(PluginCall call) {

        try {
            Context context = getContext();

            if (context == null) {
                call.reject("Android context is unavailable.");
                return;
            }

            Intent intent = new Intent(
                    context,
                    CallForegroundService.class
            );

            boolean stopped = context.stopService(intent);

            JSObject result = new JSObject();
            result.put("stopped", stopped);

            call.resolve(result);

        } catch (Exception error) {
            call.reject(
                    "Could not stop background call service: "
                            + error.getMessage(),
                    error
            );
        }
    }

    /**
     * Check an Android runtime permission.
     * Uses a unique method name to avoid conflicts with Capacitor Plugin.
     */
    private boolean hasRuntimePermission(String permission) {

        Context context = getContext();

        if (context == null) {
            return false;
        }

        return ContextCompat.checkSelfPermission(
                context,
                permission
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Start or update the foreground service.
     */
    private void launchCallService(
            String action,
            String title,
            String text,
            boolean video,
            PluginCall call
    ) {

        try {
            Context context = getContext();

            if (context == null) {
                call.reject("Android context is unavailable.");
                return;
            }

            Intent intent = new Intent(
                    context,
                    CallForegroundService.class
            );

            intent.setAction(action);

            intent.putExtra(
                    CallForegroundService.EXTRA_TITLE,
                    title
            );

            intent.putExtra(
                    CallForegroundService.EXTRA_TEXT,
                    text
            );

            intent.putExtra(
                    CallForegroundService.EXTRA_VIDEO,
                    video
            );

            ContextCompat.startForegroundService(
                    context,
                    intent
            );

            JSObject result = new JSObject();
            result.put("started", true);
            result.put("video", video);

            call.resolve(result);

        } catch (Exception error) {
            call.reject(
                    "Could not start background call service: "
                            + error.getMessage(),
                    error
            );
        }
    }

    /**
     * Return a non-empty string.
     */
    private String getSafeString(
            String value,
            String fallback
    ) {
        if (value == null || value.trim().isEmpty()) {
            return fallback;
        }

        return value.trim();
    }
}
