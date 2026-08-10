// TEMPORÁRIO — mostra a resposta em bruto da classificação
export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  const league = req.query.league || '2';
  const headers = { Authorization: `Token ${key}` };
  const seasonResp = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/${league}/season/`, { headers });
  const seasonBody = await seasonResp.text();
  const season = JSON.parse(seasonBody);
  const url = `https://sports.bzzoiro.com/api/v2/leagues/${league}/standings/?season_id=${season.id}`;
  const response = await fetch(url, { headers });
  const corpo = await response.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(response.status).send(corpo);
}
