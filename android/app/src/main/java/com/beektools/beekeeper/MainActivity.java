package com.beektools.beekeeper;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forceNavigationBarDark();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply on resume in case the system resets it
        forceNavigationBarDark();
    }

    private void forceNavigationBarDark() {
        Window window = getWindow();
        
        // Force the navigation bar to dark navy
        window.setNavigationBarColor(Color.parseColor("#1a1a2e"));
        
        // Clear the light navigation bar flag so icons render WHITE on dark background
        View decorView = window.getDecorView();
        int flags = decorView.getSystemUiVisibility();
        // Remove SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR so icons are light/white
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        decorView.setSystemUiVisibility(flags);
        
        // On Android 10+ disable contrast enforcement which can override our color
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
    }
}
