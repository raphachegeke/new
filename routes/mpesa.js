const express = require('express');
const axios = require('axios');
const moment = require('moment');
const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));
const MPESA_CALLBACK_URL = 'https://anchormen.onrender.com/api/mpesa/callback';

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_ENV
} = process.env;

const baseURL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// Get access token
async function getToken() {
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  return res.data.access_token;
}

// STK Push
router.post('/mpesa/pay', async (req, res) => {
console.log('BODY:', req.body);
  try {
if (!req.body) {
  return res.status(400).json({ error: 'Request body missing' });
}

const { phone, amount, accountRef } = req.body;

if (!phone || !amount || !accountRef) {
  return res.status(400).json({ error: 'Missing parameters' });
}


    const token = await getToken();
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const response = await axios.post(
      `${baseURL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: 6444134,
        PhoneNumber: phone,
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: accountRef,
        TransactionDesc: 'Payment'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Mpesa payment failed' });
  }
});

// Callback
router.post('/mpesa/callback', (req, res) => {
  console.log('M-PESA CALLBACK:', JSON.stringify(req.body, null, 2));
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = router;
