require('dotenv').config();
console.log("Chave SendGrid carregada:", process.env.SENDGRID_API_KEY);

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Inicializa Firebase
const serviceAccount = require('./firebase-admin.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Rota de teste
app.get('/', (req, res) => {
  res.send('Escape Game API online');
});

// Webhook de fulfillment do Shopify
app.post('/webhook/fulfillment', async (req, res) => {
  const payload = req.body;
  console.log('Webhook recebido:', payload);

  try {
    const email = payload.email;
    const orderId = payload.order_id || payload.id;

    if (!email || !orderId) {
      return res.status(400).send('Faltam dados: email ou order_id');
    }

    // Buscar chave livre
    const snapshot = await db.collection('keys')
      .where('utilizada', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(500).send('Sem chaves disponíveis');
    }

    const chaveDoc = snapshot.docs[0];
    const chave = chaveDoc.data().chave;

    // Marcar como usada
    await chaveDoc.ref.update({
      utilizada: true,
      email: email,
      order_id: orderId
    });

    try {
        await sgMail.send({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: 'A sua chave para o Escape Game',
          text: `Olá!\n\nObrigado pela sua compra!\n\nAqui está a sua chave única: ${chave}\n\nUse-a em: https://link-do-jogo.com\n\nBoa sorte!`
        });
        console.log(`E-mail enviado com sucesso para ${email}`);
      } catch (sendErr) {
        console.error('Erro ao enviar email:', sendErr);
      }
      
      

    res.status(200).send('Chave atribuída com sucesso');
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).send('Erro interno');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
