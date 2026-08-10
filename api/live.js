// /api/leagues.js — TEMPORÁRIO, só para descobrir IDs de ligas na BSD.
// Podes apagar este ficheiro depois de usares.
// Uso: /api/leagues?country=Portugal

export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) return res.status(500).json({ error: 'APIFOOTBALL_KEY não está configurada no Vercel.' });

  const country = req.query.country || 'Portugal';
  const url = `https://sports.bzzoiro.com/api/v2/leagues/?country=${encodeURIComponent(country)}`;

  try {
    const response = await fetch(url, { headers: { Authorization: `Token ${key}` } });
    const corpo = await response.text();
    if (!response.ok) return res.status(response.status).json({ error: corpo.slice(0,500) });
    return res.status(200).send(corpo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
