package com.slur.app;

import static org.junit.Assert.assertTrue;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercises the real HTTPS challenge without entering credentials or submitting login. */
@RunWith(AndroidJUnit4.class)
public class NativeSecurityCheckTest {
    @Test
    public void nativeLoginReceivesChallengeToken() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> activity.getBridge().getWebView()
                .loadUrl("https://localhost/?door=signin"));
            long deadline = System.currentTimeMillis() + 60000;
            JSONObject state = new JSONObject();
            while (System.currentTimeMillis() < deadline) {
                CountDownLatch received = new CountDownLatch(1);
                AtomicReference<String> value = new AtomicReference<>();
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                    "JSON.stringify({hosted:!!document.querySelector('iframe[title=\"Security check\"]')," +
                    "verified:!!document.querySelector('.sl-go')&&!document.querySelector('.sl-go').disabled," +
                    "error:document.querySelector('.sl-msg.err')?.textContent||''})",
                    result -> { value.set(result); received.countDown(); }));
                if (received.await(2, TimeUnit.SECONDS) && value.get() != null) {
                    Object decoded = new JSONTokener(value.get()).nextValue();
                    if (decoded instanceof String) state = new JSONObject((String) decoded);
                    if (state.optBoolean("verified")) break;
                }
                Thread.sleep(250);
            }
            assertTrue("Hosted challenge did not open: " + state, state.optBoolean("hosted"));
            assertTrue("No verified token reached the login form: " + state, state.optBoolean("verified"));
        }
    }
}
