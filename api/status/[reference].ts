export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryRef = req.query?.reference;
  const pathRef = typeof req.url === 'string' ? req.url.split('?')[0].split('/').pop() : '';
  const reference = queryRef || (pathRef !== 'status' ? pathRef : '');

  const upesiAuth =
    process.env.UPESI_AUTH_HEADER ||
    (process.env.UPESI_API_USERNAME && process.env.UPESI_API_PASSWORD
      ? `Basic ${Buffer.from(
          `${process.env.UPESI_API_USERNAME}:${process.env.UPESI_API_PASSWORD}`
        ).toString('base64')}`
      : 'Basic V2lTRnF3cEgwSXVtUEJBS3N2aDc6c0tXandRMlNtaXR0TnZPcTFLcDd3UmdIRDYtbURFQ2EwR1FrZGsyWQ==');

  if (reference) {
    try {
      const statusRes = await fetch(
        `https://upesipay.com/api/v2/transaction-status?reference=${encodeURIComponent(String(reference))}`,
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
          const raw = String(statusJson.data.status).toLowerCase();
          if (raw === 'success' || raw === 'completed') {
            return res.status(200).json({ status: 'completed' });
          }
          if (raw === 'failed' || raw === 'cancelled') {
            return res.status(200).json({ status: 'failed' });
          }
          return res.status(200).json({ status: 'pending' });
        }
      }
    } catch (err) {
      console.error('Error in status polling:', err);
    }
  }

  return res.status(200).json({ status: 'pending' });
}
