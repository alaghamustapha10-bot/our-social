package com.oursocial.app;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class LolzMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // Preserve Capacitor's push events and token/message handling.
        super.onMessageReceived(remoteMessage);

        if ("incoming_call".equals(remoteMessage.getData().get("type"))) {
            IncomingCallNotification.show(this, remoteMessage.getData());
        }
    }
}
