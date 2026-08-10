// TEMPORÁRIO — mostra a resposta em bruto da BSD para vermos os nomes certos dos campos
export default async function handler(req, res) {
  const key = process.env.APIFOOTBALL_KEY;
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const url = `https://sports.bzzoiro.com/api/v2/events/?date_from=${date}&date_to=${date}&limit=3`;
  const response = await fetch(url, { headers: { Authorization: `Token ${key}` } });
  const corpo = await response.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(response.status).send(corpo);
}
