// Vercel Serverless Proxy for Agromonitoring API
// Keeps the AGRO_API_KEY server-side only (never shipped to the client)

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

  const apiKey = process.env.AGRO_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Agromonitoring API key not configured on server.' });
    return;
  }

  try {
    const { action, lat, lng, polygonId } = req.body;

    if (action === 'createPolygon') {
      // Create a polygon for NDVI lookups
      const offset = 0.0006;
      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lng - offset, lat - offset],
              [lng - offset, lat + offset],
              [lng + offset, lat + offset],
              [lng + offset, lat - offset],
              [lng - offset, lat - offset],
            ],
          ],
        },
      };

      const resp = await fetch(
        `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}&duplicated=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Apiary_${Date.now()}`, geo_json: geojson }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: `Polygon creation failed: ${text}` });
        return;
      }

      const data = await resp.json();
      res.status(200).json({ polygonId: data.id });

    } else if (action === 'getNDVI') {
      if (!polygonId) {
        res.status(400).json({ error: 'Missing polygonId' });
        return;
      }

      const currentYear = new Date().getFullYear();
      const jan1Unix = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);
      const jan31Unix = Math.floor(new Date(`${currentYear}-01-31T00:00:00Z`).getTime() / 1000);
      const currentEndUnix = Math.floor(Date.now() / 1000);
      const currentStartUnix = currentEndUnix - 30 * 24 * 60 * 60;

      const [janResp, currentResp] = await Promise.all([
        fetch(`https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${jan1Unix}&end=${jan31Unix}&appid=${apiKey}`),
        fetch(`https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${currentStartUnix}&end=${currentEndUnix}&appid=${apiKey}`),
      ]);

      const janJson = await janResp.json();
      const currentJson = await currentResp.json();

      const baseline = janJson?.length > 0 ? janJson[0].data.mean : 0.4;

      let current = 0.6;
      let dearthDrop = false;

      if (currentJson?.length > 0) {
        current = currentJson[currentJson.length - 1].data.mean;
        const oneWeekAgoUnix = currentEndUnix - 7 * 24 * 60 * 60;
        const olderReading = currentJson.find((p: any) => p.dt <= oneWeekAgoUnix);
        if (olderReading && olderReading.data.mean - current > 0.05) {
          dearthDrop = true;
        }
      }

      res.status(200).json({ baseline, current, dearthDrop });

    } else {
      res.status(400).json({ error: 'Unknown action. Use "createPolygon" or "getNDVI".' });
    }
  } catch (error: any) {
    console.error('Agro proxy error:', error);
    res.status(500).json({ error: 'Agro API proxy failed: ' + (error.message || 'Unknown error') });
  }
}
