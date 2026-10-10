package com.beektools.beekeeper;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        styleNavigationBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply on resume in case the system resets it
        styleNavigationBar();
    }

    /**
     * Amber navigation bar with DARK buttons.
     *
     * This used to force a navy bar with white buttons, written when the whole
     * app was dark. The light conversion (2026-09-08) turned the app cream but
     * never touched this file. On Android 15 and later the app draws edge to
     * edge, so the navy colour is ignored and the app's own cream background
     * shows through instead — under buttons still being told to draw white.
     * White on cream: the back, home and recents buttons all but vanished.
     * Ron spotted it on his tablet on 2026-10-03.
     *
     * Amber rather than the app's cream was Ron's choice the same day: a band
     * of the brand colour under the app. Dark buttons on this amber are about
     * 7.5:1; white ones would be about 2.3:1, below the 3:1 minimum.
     *
     * Two settings, so every Android version agrees:
     *  - the bar colour, which only older Android still honours. On Android 15
     *    and later the web page paints the strip itself (--color-system-bar);
     *  - "light navigation bar", which tells every version the bar behind the
     *    buttons is light, so it draws them dark.
     *
     * The colour is --color-primary from src/index.css. Keep the two in step.
     */
    private void styleNavigationBar() {
        Window window = getWindow();

        window.setNavigationBarColor(Color.parseColor("#E99B1A"));
        WindowCompat.getInsetsController(window, window.getDecorView())
            .setAppearanceLightNavigationBars(true);

        // On Android 10+ stop the system laying its own translucent scrim over
        // the bar. The amber already gives the dark buttons their contrast.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }
}
