# Apito — Resultados de Futebol

## Estrutura
```
apito/
  index.html
  detail.html
  api/
    live.js
    standings.js
    fixture.js
```

## Passos agora que já tens o repositório no GitHub

1. Confirma que a estrutura de pastas no GitHub é exatamente esta —
   a pasta `api` tem de estar na raiz do repositório, ao lado do
   `index.html` (não dentro de outra pasta).
2. No Vercel: **Add New Project → Import Git Repository** → escolhe
   este repositório (em vez de arrastar ficheiros).
3. Antes de clicar em "Deploy", vai a **Settings → Environment
   Variables** e adiciona:
   - Name: `APIFOOTBALL_KEY`
   - Value: a tua chave da API-Football (recomendo gerares uma nova,
     já que a anterior foi partilhada nesta conversa)
4. Deploy.
5. Testa: `https://o-teu-site.vercel.app/api/live` deve devolver JSON
   com jogos (não uma página HTML de erro).

Se já tinhas importado o projeto sem a variável configurada, força um
"Redeploy" depois de a adicionares — variáveis novas só entram em
deployments feitos depois de serem criadas.

## IDs de ligas úteis (API-Football)
- 94 → Liga Portugal
- 39 → Premier League
- 140 → La Liga
- 135 → Serie A
- 61 → Ligue 1
- 2 → Champions League

## Limite do plano grátis
100 pedidos/dia. As funções têm cache (`/api/live` 60s, `/api/standings` 1h)
para não gastares o limite depressa.
