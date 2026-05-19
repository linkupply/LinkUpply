# Custom Android Notification Integration Guide

This guide provides the exact Android implementation details required to show a **Custom Notification Layout** (with the Neon Glassmorphism design) inside the **Native Android System Tray** using Firebase Cloud Messaging (FCM). 

Since you requested *System Tray Integration* using `RemoteViews` for the killed state, you must place these files into your Capacitor Android project (`android/app/src/main/...`).

### 1. `res/layout/custom_notification.xml`
Create this custom layout block. It uses standard Android Views mimicking your neon & glassmorphism border styling.

```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:padding="8dp">

    <!-- Neon border background (simulated via shape drawable or gradient colors) -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:background="#2E044B" <!-- Deep purple fallback -->
        android:orientation="horizontal"
        android:padding="16dp"
        android:gravity="center_vertical">

        <!-- Avatar -->
        <ImageView
            android:id="@+id/notification_avatar"
            android:layout_width="48dp"
            android:layout_height="48dp"
            android:scaleType="centerCrop"
            android:src="@drawable/ic_avatar_placeholder" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:layout_marginStart="12dp">

            <TextView
                android:id="@+id/notification_title"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#FFFFFF"
                android:textSize="16sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/notification_message"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textColor="#BBBBBB"
                android:textSize="14sp"
                android:maxLines="2" />
        </LinearLayout>

        <!-- Glassmorphism Action Buttons -->
        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:gravity="end">

            <!-- Reply Button -->
            <TextView
                android:id="@+id/action_reply"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="REPLY"
                android:textColor="#FF00FF" <!-- Neon Pink -->
                android:background="#33FFFFFF" <!-- Glass effect -->
                android:paddingHorizontal="12dp"
                android:paddingVertical="6dp"
                android:layout_marginBottom="8dp"/>

            <!-- Mark as Read Button -->
            <TextView
                android:id="@+id/action_mark_read"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="MARK READ"
                android:textColor="#00FFFF" <!-- Cyan Neon -->
                android:background="#33FFFFFF"
                android:paddingHorizontal="12dp"
                android:paddingVertical="6dp"/>
        </LinearLayout>
    </LinearLayout>
</RelativeLayout>
```

### 2. Override Firebase Messaging Service (Java)

To ensure notifications display customized regardless if the app is killed or running, create a custom `FirebaseMessagingService`.

*File Location: `android/app/src/main/java/com/your/app/MyFirebaseMessagingService.java`*

```java
package com.your.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "Messages_High_Priority";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        if (remoteMessage.getData().size() > 0) {
            String title = remoteMessage.getData().get("title");
            String body = remoteMessage.getData().get("body");
            String imageUrl = remoteMessage.getData().get("image");
            
            showCustomNotification(title, body, imageUrl);
        }
    }

    private void showCustomNotification(String title, String message, String imageUrl) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // High Priority Channel (Heads Up setup)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Messages",
                    NotificationManager.IMPORTANCE_HIGH // Bypass DND and show heads-up
            );
            notificationManager.createNotificationChannel(channel);
        }

        // Inflate custom layout
        RemoteViews remoteViews = new RemoteViews(getPackageName(), R.layout.custom_notification);
        remoteViews.setTextViewText(R.id.notification_title, title);
        remoteViews.setTextViewText(R.id.notification_message, message);

        // Fetch image for avatar (Sync call inside background service is allowed)
        if (imageUrl != null && !imageUrl.isEmpty()) {
            Bitmap bitmap = getBitmapFromURL(imageUrl);
            if (bitmap != null) {
                remoteViews.setImageViewBitmap(R.id.notification_avatar, bitmap);
            }
        }

        // Open App Intent
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Construct Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setCustomContentView(remoteViews) // Apply Custom View
                .setCustomBigContentView(remoteViews)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private Bitmap getBitmapFromURL(String src) {
        try {
            URL url = new URL(src);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void onNewToken(String token) {
        // Send token to Firestore user document
    }
}
```

### 3. Update `AndroidManifest.xml`

Register the service so FCM invokes it instead of the system default handler:

```xml
<service
    android:name=".MyFirebaseMessagingService"
    android:exported="true">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- Default Notification Settings -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="Messages_High_Priority" />
```

### Note regarding payload formats
To ensure `MyFirebaseMessagingService.onMessageReceived()` gets executed reliably while the app is killed or swiped away, **you must only send FCM `data` messages** from your backend, NOT `notification` messages. Using custom views requires custom native code inflation anyway!

```javascript
// Example Firebase Function payload:
const fcmPayload = {
    data: {
        title: "Jane Doe",
        body: "Hey, are we still on for tonight?",
        image: "https://url-to.image/...",
        senderId: "abcd..."
    },
    token: userToken // DO NOT use `notification: {...}` block!
};
```
