package com.oursocial.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        );
        getWindow().setStatusBarColor(Color.rgb(12, 12, 22));
        getWindow().setNavigationBarColor(Color.rgb(12, 12, 22));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        setFinishOnTouchOutside(false);

        renderIncomingCall();
    }

    private void renderIncomingCall() {
        String callerName = safe(getIntent().getStringExtra("caller_name"));
        if (callerName.isEmpty()) callerName = "LOLZ";

        String mediaType = safe(getIntent().getStringExtra("media_type"));
        String language = "en".equalsIgnoreCase(getIntent().getStringExtra("language"))
                ? "en" : "ar";
        boolean video = "video".equalsIgnoreCase(mediaType);

        String groupName = safe(getIntent().getStringExtra("group_name"));
        String channelName = safe(getIntent().getStringExtra("channel_name"));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(28), dp(44), dp(28), dp(32));
        root.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(24, 21, 48), Color.rgb(9, 10, 19), Color.rgb(8, 13, 24)}
        ));

        TextView brand = text("LOLZ", 22, Color.rgb(173, 166, 255), Typeface.BOLD);
        brand.setLetterSpacing(0.18f);
        LinearLayout.LayoutParams brandParams =
                new LinearLayout.LayoutParams(-2, -2);
        brandParams.bottomMargin = dp(50);
        root.addView(brand, brandParams);

        TextView avatar = text(initials(callerName), 38, Color.WHITE, Typeface.BOLD);
        avatar.setGravity(Gravity.CENTER);
        GradientDrawable avatarBackground = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.rgb(137, 128, 255), Color.rgb(79, 65, 188)}
        );
        avatarBackground.setShape(GradientDrawable.OVAL);
        avatarBackground.setStroke(dp(3), Color.argb(90, 255, 255, 255));
        avatar.setBackground(avatarBackground);
        LinearLayout.LayoutParams avatarParams =
                new LinearLayout.LayoutParams(dp(132), dp(132));
        avatarParams.bottomMargin = dp(28);
        root.addView(avatar, avatarParams);

        TextView incoming = text(
                language.equals("ar") ? "مكالمة واردة" : "INCOMING CALL",
                13,
                Color.rgb(180, 177, 205),
                Typeface.BOLD
        );
        incoming.setLetterSpacing(0.12f);
        LinearLayout.LayoutParams incomingParams =
                new LinearLayout.LayoutParams(-2, -2);
        incomingParams.bottomMargin = dp(12);
        root.addView(incoming, incomingParams);

        TextView name = text(callerName, 29, Color.WHITE, Typeface.BOLD);
        name.setGravity(Gravity.CENTER);
        name.setMaxLines(2);
        LinearLayout.LayoutParams nameParams =
                new LinearLayout.LayoutParams(-1, -2);
        nameParams.bottomMargin = dp(12);
        root.addView(name, nameParams);

        String subtitle = video
                ? (language.equals("ar") ? "مكالمة فيديو واردة" : "Incoming video call")
                : (language.equals("ar") ? "مكالمة صوتية واردة" : "Incoming audio call");
        TextView details = text(subtitle, 16, Color.rgb(198, 198, 215), Typeface.NORMAL);
        details.setGravity(Gravity.CENTER);
        root.addView(details, new LinearLayout.LayoutParams(-1, -2));

        String roomName = !groupName.isEmpty() ? groupName : channelName;
        if (!roomName.isEmpty()) {
            TextView room = text(roomName, 14, Color.rgb(157, 151, 196), Typeface.NORMAL);
            room.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams roomParams =
                    new LinearLayout.LayoutParams(-1, -2);
            roomParams.topMargin = dp(10);
            root.addView(room, roomParams);
        }

        LinearLayout spacer = new LinearLayout(this);
        LinearLayout.LayoutParams spacerParams =
                new LinearLayout.LayoutParams(1, 0, 1f);
        root.addView(spacer, spacerParams);

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER);
        actions.setOrientation(LinearLayout.HORIZONTAL);

        TextView decline = actionButton(
                language.equals("ar") ? "رفض" : "Decline",
                Color.rgb(195, 55, 69)
        );
        decline.setOnClickListener(view ->
                IncomingCallNotification.launchMainActivity(this, getIntent(), "reject")
        );

        TextView answer = actionButton(
                language.equals("ar") ? "قبول" : "Answer",
                Color.rgb(38, 151, 93)
        );
        answer.setOnClickListener(view ->
                IncomingCallNotification.launchMainActivity(this, getIntent(), "answer")
        );

        LinearLayout.LayoutParams declineParams =
                new LinearLayout.LayoutParams(0, dp(58), 1f);
        declineParams.setMargins(dp(6), 0, dp(6), 0);
        LinearLayout.LayoutParams answerParams =
                new LinearLayout.LayoutParams(0, dp(58), 1f);
        answerParams.setMargins(dp(6), 0, dp(6), 0);
        actions.addView(decline, declineParams);
        actions.addView(answer, answerParams);
        root.addView(actions);

        setContentView(root);
    }

    private TextView text(String value, float size, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private TextView actionButton(String label, int color) {
        TextView button = text(label, 17, Color.WHITE, Typeface.BOLD);
        GradientDrawable background = new GradientDrawable();
        background.setColor(color);
        background.setCornerRadius(dp(32));
        button.setBackground(background);
        button.setClickable(true);
        button.setFocusable(true);
        return button;
    }

    private String initials(String value) {
        String trimmed = safe(value);
        if (trimmed.isEmpty()) return "L";
        String[] parts = trimmed.split("\\s+");
        if (parts.length > 1) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
        }
        return trimmed.substring(0, 1).toUpperCase();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
