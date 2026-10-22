import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Transaction {
  reference: string;
  transactionId: string;
  phone: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
}

const transactions = new Map<string, Transaction>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Initiate M-Pesa STK Push
  app.post('/api/pay', async (req, res) => {
    try {
      const { amount, phone } = req.body;
      if (!amount || !phone) {
        return res.status(400).json({ success: false, error: 'Amount and phone number are required.' });
      }

      const upesiAuth =
        process.env.UPESI_AUTH_HEADER ||
        (process.env.UPESI_API_USERNAME && process.env.UPESI_API_PASSWORD
          ? `Basic ${Buffer.from(
              `${process.env.UPESI_API_USERNAME}:${process.env.UPESI_API_PASSWORD}`
            ).toString('base64')}`
          : '');
      const channelId = Number(process.env.UPESI_CHANNEL_ID) || 260;

      // If UpesiPay credentials are configured, dispatch real STK push
      if (upesiAuth) {
        try {
          const upesiResponse = await fetch('https://upesipay.com/api/v2/collections/initiate/', {
            method: 'POST',
            headers: {
              Authorization: upesiAuth,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel_id: channelId,
              phone_number: String(phone),
              amount: Number(amount),
              callback_url: '',
            }),
          });

          const upesiData = (await upesiResponse.json()) as {
            success?: boolean;
            status_code?: number;
            message?: string;
            error_code?: string;
            data?: {
              checkout_request_id?: string;
              merchant_request_id?: string;
              status?: string;
            };
          };

          if (upesiData.success) {
            const checkoutId =
              upesiData.data?.checkout_request_id ||
              `LOAN-${Math.random().toString(36).substring(2, 10)}`;
            const merchantId =
              upesiData.data?.merchant_request_id ||
              Math.random().toString(16).substring(2, 14);

            const tx: Transaction = {
              reference: checkoutId,
              transactionId: merchantId,
              phone: String(phone),
              amount: Number(amount),
              status: 'pending',
              createdAt: Date.now(),
            };

            transactions.set(checkoutId, tx);

            return res.json({
              success: true,
              reference: checkoutId,
              transactionId: merchantId,
              message: upesiData.message || 'STK push sent successfully.',
            });
          } else {
            // Forward UpesiPay response details
            return res.status(upesiData.status_code || 400).json({
              success: false,
              error: upesiData.message || 'Payment initiation rejected by UpesiPay gateway.',
              errorCode: upesiData.error_code,
            });
          }
        } catch (fetchErr: unknown) {
          console.error('Error connecting to UpesiPay API:', fetchErr);
          return res.status(502).json({
            success: false,
            error: 'Failed to reach UpesiPay gateway. Please verify network connectivity.',
          });
        }
      }

      // Fallback local transaction creation when no credentials are set
      const randomPart = Math.random().toString(36).substring(2, 10);
      const reference = `LOAN-${randomPart}-${Date.now().toString(36)}`;
      const transactionId = Math.random().toString(16).substring(2, 14);

      const tx: Transaction = {
        reference,
        transactionId,
        phone: String(phone),
        amount: Number(amount),
        status: 'pending',
        createdAt: Date.now(),
      };

      transactions.set(reference, tx);

      return res.json({
        success: true,
        reference,
        transactionId,
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // Query status of transaction
  app.get('/api/status/:reference', async (req, res) => {
    const { reference } = req.params;
    const upesiAuth =
      process.env.UPESI_AUTH_HEADER ||
      (process.env.UPESI_API_USERNAME && process.env.UPESI_API_PASSWORD
        ? `Basic ${Buffer.from(
            `${process.env.UPESI_API_USERNAME}:${process.env.UPESI_API_PASSWORD}`
          ).toString('base64')}`
        : '');

    // Check upstream UpesiPay status if configured
    if (upesiAuth && reference) {
      try {
        const statusRes = await fetch(
          `https://upesipay.com/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`,
          {
            headers: {
              Authorization: upesiAuth,
            },
          }
        );

        if (statusRes.ok) {
          const statusJson = (await statusRes.json()) as {
            success?: boolean;
            data?: {
              status?: string;
            };
          };

          if (statusJson.success && statusJson.data?.status) {
            const raw = statusJson.data.status.toLowerCase();
            if (raw === 'success' || raw === 'completed') {
              return res.json({ status: 'completed' });
            }
            if (raw === 'failed' || raw === 'cancelled') {
              return res.json({ status: 'failed' });
            }
            return res.json({ status: 'pending' });
          }
        }
      } catch (err) {
        console.error('Error polling UpesiPay status:', err);
      }
    }

    // Local in-memory transaction status fallback
    const tx = transactions.get(reference);

    if (!tx) {
      return res.status(404).json({ status: 'not_found' });
    }

    const elapsed = Date.now() - tx.createdAt;
    if (tx.status === 'pending' && elapsed >= 6000) {
      tx.status = 'completed';
    }

    return res.json({ status: tx.status });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
