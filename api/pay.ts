export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep as is
      }
    }

    const { amount, phone } = body || {};
    if (!amount || !phone) {
      return res.status(400).json({ success: false, error: 'Amount and phone number are required.' });
    }

    const upesiAuth =
      process.env.UPESI_AUTH_HEADER ||
      (process.env.UPESI_API_USERNAME && process.env.UPESI_API_PASSWORD
        ? `Basic ${Buffer.from(
            `${process.env.UPESI_API_USERNAME}:${process.env.UPESI_API_PASSWORD}`
          ).toString('base64')}`
        : 'Basic V2lTRnF3cEgwSXVtUEJBS3N2aDc6c0tXandRMlNtaXR0TnZPcTFLcDd3UmdIRDYtbURFQ2EwR1FrZGsyWQ==');
    const channelId = Number(process.env.UPESI_CHANNEL_ID) || 260;

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

      return res.status(200).json({
        success: true,
        reference: checkoutId,
        transactionId: merchantId,
        message: upesiData.message || 'STK push sent successfully.',
      });
    } else {
      return res.status(200).json({
        success: false,
        error: upesiData.message || 'Payment initiation rejected by UpesiPay gateway.',
        errorCode: upesiData.error_code,
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in /api/pay:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal payment server error',
    });
  }
}
