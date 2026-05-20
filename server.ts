import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), "service-account.json");

function initializeFirebaseAdmin() {
  try {
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully via ENV variable.");
      } else {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
        console.log(
          "Firebase Admin initialized successfully with service account at:",
          serviceAccountPath,
        );
      }
    }
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
  }
}

initializeFirebaseAdmin();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending notifications
  app.post("/api/notify", async (req, res) => {
    const { token, tokens, title, body, data } = req.body;
    let targetTokens = tokens || (token ? [token] : []);

    if (!targetTokens.length)
      return res.status(400).json({ error: "Tokens are required" });

    try {
      const message: any = {
        data: {
          title: String(title || "New Message"),
          body: String(body || ""),
          senderId: String(data?.senderId || ""),
          chatId: String(data?.chatId || ""),
          icon: String(
            req.body.image || "https://linkupply-4ffb4.web.app/icon-192.png",
          ),
          type: "message",
        },
        tokens: targetTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      res.json({ success: true, response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
