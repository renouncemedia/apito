// TEMPORÁRIO — mostra a resposta em bruto dos marcadores
export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  const league = req.query.league || '2';
  const headers = { Authorization: `Token ${key}` };
  const seasonResp = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/${league}/season/`, { headers });
  const season = await seasonResp.json();
  const url = `https://sports.bzzoiro.com/api/v2/leagues/${league}/top/scorers/?season_id=${season.id}&limit=5`;
  const response = await fetch(url, { headers });
  const corpo = await response.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(response.status).send(corpo);
}
