import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
  };

  const sanitizeData = (data: any) => {
    if (!data || typeof data !== 'object') return {};
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined && value !== null) {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ICD-11 Token Proxy
  let cachedIcdToken: { token: string; expiry: number } | null = null;
  app.get("/api/icd/token", async (req, res) => {
    try {
      const now = Date.now();
      if (cachedIcdToken && cachedIcdToken.expiry > now + 120000) {
        return res.json({ access_token: cachedIcdToken.token });
      }

      const clientId = process.env.WHO_CLIENT_ID;
      const clientSecret = process.env.WHO_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("WHO ICD-11 credentials missing in server environment");
        return res.status(500).json({ error: "ICD-11 credentials not configured" });
      }

      const response = await fetch("https://icdaccessmanagement.who.int/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "icdapi_access",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("WHO Token Error:", errorText);
        return res.status(response.status).json({ error: "Failed to fetch WHO token" });
      }

      const data: any = await response.json();
      cachedIcdToken = {
        token: data.access_token,
        expiry: now + (data.expires_in * 1000),
      };

      res.json({ access_token: data.access_token });
    } catch (error: any) {
      console.error("ICD Token Proxy Error:", error);
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
    const distPath = path.join(process.cwd(), 'web', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
