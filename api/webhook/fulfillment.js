// fulfillment.js (Firestore via REST com acesso público — sem autenticação)
const fetch = require("node-fetch");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Método não permitido");
  }

  const email = req.body.email;
  const order_id = req.body.order_id || req.body.name || req.body.id?.toString();

  if (!email || !order_id) {
    return res.status(400).send("Dados 'email' e 'order_id' ausentes no payload do Shopify.");
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const collection = "keys";

    // Buscar uma chave não utilizada
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const query = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: "utilizada" },
            op: "EQUAL",
            value: { booleanValue: false }
          }
        },
        limit: 1
      }
    };

    const queryResponse = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(query),
    });

    const queryData = await queryResponse.json();
    const found = queryData.find((doc) => doc.document);

    if (!found) {
      return res.status(404).send("Nenhuma chave disponível.");
    }

    const docName = found.document.name;
    const chave = found.document.fields.chave.stringValue;

    // Atualizar a chave como usada
    const patchUrl = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=utilizada&updateMask.fieldPaths=order_id&updateMask.fieldPaths=email_cliente`;
    const update = {
      fields: {
        utilizada: { booleanValue: true },
        order_id: { stringValue: order_id },
        email_cliente: { stringValue: email }
      }
    };

    await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(update),
    });

    // Enviar email
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

    await sgMail.send(msg);
    console.log(`Email enviado para ${email} com a chave ${chave}`);
    return res.status(200).send("Chave atribuída e email enviado com sucesso.");
  } catch (error) {
    console.error("Erro geral:", error);
    return res.status(500).send("Erro interno");
  }
};