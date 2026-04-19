import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function signature:
export default async function handler(req: any, res: any) {
  // 1. CORS headers (in case of local testing / cross-origin)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
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
    const { question, apiaryId, sessionToken } = req.body;

    if (!question || !apiaryId) {
      res.status(400).json({ error: 'Missing question or apiaryId' });
      return;
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
      res.status(500).json({ error: 'AI Service is currently unavailable (Configuration Error).' });
      return;
    }

    // Initialize user-scoped Supabase client securely using the passed session token
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase configuration");
    }

    const options: any = {};
    if (sessionToken) {
      options.global = { headers: { Authorization: `Bearer ${sessionToken}` } };
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, options);

    // 1. Fetch Context: Apiary (Location)
    const { data: apiary, error: apiaryError } = await supabase
      .from('apiaries')
      .select('*')
      .eq('id', apiaryId)
      .single();

    if (apiaryError || !apiary) {
      console.error('AI Action: Fetch Apiary Error', apiaryError);
      res.status(500).json({ error: 'Could not fetch Apiary location context.' });
      return;
    }

    // 2. Fetch Context: Hives (Types)
    const { data: hives } = await supabase
      .from('hives')
      .select('name, type')
      .eq('apiary_id', apiaryId);

    const uniqueHiveTypes = Array.from(new Set(hives?.map(h => h.type) || []));

    // 3. Derive Season Context
    let weatherContext = "Location coordinates: N/A";
    if (apiary.latitude && apiary.longitude) {
      const month = new Date().getMonth() + 1; // 1-12
      const isNorth = apiary.latitude > 0;
      let season = 'Unknown';
      if (isNorth) {
        if (month >= 3 && month <= 5) season = 'Spring';
        else if (month >= 6 && month <= 8) season = 'Summer';
        else if (month >= 9 && month <= 11) season = 'Autumn';
        else season = 'Winter';
      } else {
        if (month >= 3 && month <= 5) season = 'Autumn';
        else if (month >= 6 && month <= 8) season = 'Winter';
        else if (month >= 9 && month <= 11) season = 'Spring';
        else season = 'Summer';
      }
      weatherContext = `Location: ${apiary.zip_code || 'Lat/Lng provided'}. Estimated Season: ${season}.`;
    }

    // 4. Construct Prompt
    const systemPrompt = `
You are an expert beekeeping assistant for the 'BeekTools' application.
Goal: Answer the user's beekeeping question concisely and accurately.

CONTEXT:
${weatherContext}
User's Hive Types in this Apiary: ${uniqueHiveTypes.join(', ') || 'None specified'}.

RULES:
1. If the question is NOT related to beekeeping, bees, hives, or apiary management, politely decline to answer.
2. Context Awareness: Use the location/season context to tailor your advice.
3. Hive Type Awareness: If the advice depends heavily on hive type (e.g. "adding a super") and the user has multiple incompatible types (e.g. Top Bar vs Langstroth) and didn't specify which one, ask for clarification.
4. Formatting: Use Markdown (bolding, lists) for readability. Keep it under 200 words if possible.
`;

    const userPrompt = `Question: ${question}`;

    // 5. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      systemPrompt,
      userPrompt
    ]);

    const response = result.response;
    const answer = response.text();

    // 6. Return response
    res.status(200).json({ answer });

  } catch (error: any) {
    console.error('AI Action Error:', error);
    if (error.message?.includes('429') || error.status === 429) {
      res.status(429).json({ error: 'The hive is busy (Rate Limit Reached). Please try again in a minute.' });
      return;
    }
    res.status(500).json({ error: 'Failed to process request: ' + (error.message || 'Unknown error') });
  }
}
