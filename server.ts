import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Admin Setup ---
const serviceAccountPath = path.join(process.cwd(), "service-account.json");

function initializeFirebaseAdmin() {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      console.log("✅ Firebase Admin initialized successfully.");
    }
  } catch (e) {
    console.error("❌ Firebase Admin initialization error:", e);
  }
}

initializeFirebaseAdmin();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Notification API Route ---
  app.post("/api/notify", async (req, res) => {
    const { token, tokens, title, body, data, image } = req.body;
    
    // Multiple tokens ya single token handle karne ke liye
    let targetTokens = tokens || (token ? [token] : []);

    if (!targetTokens.length) {
      return res.status(400).json({ error: "Tokens are required" });
    }

    try {
      /**
       * CRITICAL: Yahan 'notification' key bilkul nahi honi chahiye.
       * Agar 'notification' object miley ga toh Windows/Chrome Service Worker 
       * ko bypass kar ke purani notification dikhayega.
       */
      const message: any = {
        data: {
          title: String(title || "New Message"),
          body: String(body || ""),
          senderId: String(data?.senderId || ""),
          chatId: String(data?.chatId || ""),
          icon: String(image || "https://linkupply-4ffb4.web.app/icon-192.png"),
          type: "message", // Custom type for logic handling
        },
        tokens: targetTokens,
      };

      console.log("🚀 Sending Data-Only Payload to FCM:", JSON.stringify(message));
      
      const response = await admin.messaging().sendEachForMulticast(message);
      
      console.log("✅ FCM Response:", response.successCount, "sent successfully.");
      res.json({ success: true, response });
    } catch (error: any) {
      console.error("❌ FCM Send Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite / Production Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();