const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

try {
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} catch (error) {
  console.error("Erro ao inicializar Firebase ou SendGrid:", error);
  throw error;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  try {
    const email = req.body.email;
    const order_id = req.body.name || req.body.id?.toString();


    if (!email || !order_id) {
        return res.status(400).send("Dados 'email' e 'order_id' ausentes no payload do Shopify.");
      }
      

    const db = admin.firestore();
    const snapshot = await db
      .collection("keys")
      .where("utilizada", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn("Nenhuma chave disponível no Firestore.");
      return res.status(404).send("Nenhuma chave disponível.");
    }

    const doc = snapshot.docs[0];
    const chave = doc.data().chave;

    await doc.ref.update({
      utilizada: true,
      order_id,
      email_cliente: email,
    });

    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: "A sua chave para o Escape Game",
      html: `
        <p>Olá!</p>
        <p>A sua chave é: <strong>${chave}</strong></p>
        <p>Use-a em: <a href="https://app.escapein.pt">app.escapein.pt</a></p>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email enviado para ${email} com a chave ${chave}`);
      return res.status(200).send("Chave atribuída e email enviado com sucesso.");
    } catch (sendError) {
      console.error("Erro ao enviar e-mail via SendGrid:", sendError.response?.body || sendError.message);
      return res
        .status(500)
        .send("Erro ao enviar e-mail: " + JSON.stringify(sendError.response?.body || sendError.message));
    }
  } catch (error) {
    console.error("Erro geral no webhook:", error);
    return res.status(500).send("Erro interno: " + error.message);
  }
};
