const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { keys } = req.body;
  if (!Array.isArray(keys)) {
    return res.status(400).json({ error: "Formato inválido" });
  }

  try {
    const batch = db.batch();
    keys.forEach((key) => {
      const ref = db.collection('keys').doc();
      batch.set(ref, {
        chave: key,
        utilizada: false,
        criado_em: new Date()
      });
    });
    await batch.commit();
    res.status(200).json({ status: "ok", inseridas: keys.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao gravar no Firestore" });
  }
};
