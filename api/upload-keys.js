// /api/upload-keys.js

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Configuração do Firebase Admin com variáveis de ambiente da Vercel
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// Inicializa o Firebase Admin apenas uma vez
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  const { keys } = req.body;

  if (!Array.isArray(keys)) {
    return res.status(400).json({ error: "Formato inválido. Esperado um array em 'keys'." });
  }

  if (keys.length === 0) {
    return res.status(400).json({ error: "A lista de chaves está vazia." });
  }

  try {
    const batch = db.batch();
    keys.forEach((chave) => {
      const ref = db.collection('keys').doc();
      batch.set(ref, {
        chave: String(chave).trim(),
        utilizada: false,
        criado_em: new Date()
      });
    });

    await batch.commit();

    return res.status(200).json({ status: "ok", inseridas: keys.length });
  } catch (error) {
    console.error("Erro ao inserir chaves:", error);
    return res.status(500).json({ error: "Erro ao inserir chaves", detalhe: error.message });
  }
};
