package com.oursocial.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CallBackgroundPlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingCallIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingCallIntent(intent);
    }

    private void handleIncomingCallIntent(Intent intent) {
        if (intent == null) return;

        Uri data = intent.getData();
        if (data == null || !"call".equals(data.getHost())) return;

        IncomingCallNotification.cancel(
                this,
                data.getQueryParameter("call_id")
        );
    }
}
