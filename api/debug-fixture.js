// TEMPORÁRIO — mostra a resposta em bruto do detalhe de um jogo
// ?id=<um id real de um jogo, tira-o de /api/live>
export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  const id = req.query.id;
  const headers = { Authorization: `Token ${key}` };

  const [detail, incidents, lineups] = await Promise.all([
    fetch(`https://sports.bzzoiro.com/api/v2/events/${id}/`, { headers }).then(r => r.text()),
    fetch(`https://sports.bzzoiro.com/api/v2/events/${id}/incidents/`, { headers }).then(r => r.text()),
    fetch(`https://sports.bzzoiro.com/api/v2/events/${id}/lineups/`, { headers }).then(r => r.text())
  ]);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).send(JSON.stringify({ detail: JSON.parse(detail), incidents: JSON.parse(incidents), lineups: JSON.parse(lineups) }, null, 2));
}
