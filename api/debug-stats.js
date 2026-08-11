// TEMPORÁRIO — mostra a resposta em bruto das estatísticas de um jogo
// ?id=<id real de um jogo já terminado ou em curso>
export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  const id = req.query.id;
  const headers = { Authorization: `Token ${key}` };
  const response = await fetch(`https://sports.bzzoiro.com/api/v2/events/${id}/stats/`, { headers });
  const corpo = await response.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(response.status).send(corpo);
}
