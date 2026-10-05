package com.slur.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import org.json.JSONException;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        config = CapConfig.loadDefault(this);
        try {
            // The deployed attachment API accepts native requests, but its browser
            // CORS list does not contain Android's https://localhost origin.
            config.getPluginConfiguration("CapacitorHttp").getConfigJSON().put("enabled", true);
        } catch (JSONException error) {
            throw new IllegalStateException("Could not initialize native networking", error);
        }
        super.load();
    }
}
