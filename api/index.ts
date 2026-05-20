import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Vercel serverless function entry for Express
const app = express();
app.use(express.json());

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  try {
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized via env variable.");
      } else {
         console.warn("FIREBASE_SERVICE_ACCOUNT env var is missing.");
      }
    }
  } catch (e) {
    console.error("Firebase Admin initialization error:", e);
  }
}

initializeFirebaseAdmin();

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

export default app;
