// Vercel Serverless Proxy for Open-Meteo Historical Weather Archive API
// Bypasses browser CORS blocks, ad blockers, and network restrictions on the client side

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { lat, lng, startDate, endDate, isUS } = req.body;

    if (lat === undefined || lng === undefined || !startDate || !endDate) {
      res.status(400).json({ error: 'Missing required parameters: lat, lng, startDate, endDate' });
      return;
    }

    let url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
    
    if (isUS) {
      url += '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch';
    }

    console.log(`Weather proxy querying URL: ${url}`);

    const resp = await fetch(url);

    if (!resp.ok) {
      const text = await resp.text();
      res.status(resp.status).json({ error: `Open-Meteo Archive API failed: ${text}` });
      return;
    }

    const data = await resp.json();
    res.status(200).json(data);

  } catch (error: any) {
    console.error('Weather proxy error:', error);
    res.status(500).json({ error: 'Weather proxy failed: ' + (error.message || 'Unknown error') });
  }
}
