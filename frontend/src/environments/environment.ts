const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const httpBase = `http://${browserHost}`;

export const environment = {
  production: false,
<<<<<<< Updated upstream
=======
  chatbotEnabled: true,
  chatbotWebhookUrl: 'https://thanhthao123.app.n8n.cloud/webhook/4a338bbc-5585-47e8-8540-fcee8a2ad7bd/chat',
>>>>>>> Stashed changes
  apiBase: `${httpBase}:3000`,
  mlApi: `${httpBase}:5001`,
  paymentApi: `${httpBase}:3000/api/payment`,
  vnpayApi: `${httpBase}:8888`,
  googleClientId: '977189466141-dui9vfeok79v78r9k5jtks0anhoq50qm.apps.googleusercontent.com',
};
