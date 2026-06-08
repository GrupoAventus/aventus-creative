const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const SONNET = "claude-haiku-4-5-20251001";   // tudo no Haiku para economizar
const HAIKU  = "claude-haiku-4-5-20251001";

const USUARIOS = {
  "squad01":"aventus","squad02":"aventus","brunoguedes":"aventus",
  "heloisa":"aventus","moldandoinox":"aventus","fernando":"aventus",
  "romulo":"aventus","darlene":"aventus","joel":"aventus","construart":"aventus",
};

async function api(prompt, modelo, webSearch = false, maxTokens = 1000) {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (webSearch) headers["anthropic-beta"] = "web-search-2025-03-05";

  const body = { model: modelo, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  if (webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers, body: JSON.stringify(body)
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.content || []).filter(i => i.type === "text").map(i => i.text).join("");
}

function parseJSON(text) {
  const limpo = text
    .replace(/<a[^>]*>/g, "").replace(/<\/a>/g, "")
    .replace(/<cite[^>]*>/g, "").replace(/<\/cite>/g, "")
    .replace(/<strong[^>]*>/g, "").replace(/<\/strong>/g, "")
    .replace(/<em[^>]*>/g, "").replace(/<\/em>/g, "")
    .replace(/<[^>]+>/g, "");
  const s = limpo.indexOf("{"), e = limpo.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON não encontrado");
  const clean = limpo.slice(s, e + 1)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\n/g, " ").replace(/\r/g, " ").replace(/\t/g, " ");
  return JSON.parse(clean);
}

app.post("/login", (req, res) => {
  const u = (req.body.usuario || "").toLowerCase().replace(/\s+/g, "");
  const s = req.body.senha;
  USUARIOS[u] && USUARIOS[u] === s ? res.json({ ok: true }) : res.status(401).json({ ok: false });
});

// CREATIVE — Haiku com estrutura diferente por tipo
app.post("/gerar-roteiro", async (req, res) => {
  const { ideia, tom, duracao, nicho } = req.body;
  if (!ideia) return res.status(400).json({ error: "Ideia obrigatória" });

  const isAnuncio = nicho === "anuncio";
  const durSeg = duracao === "30 segundos" ? "30s" : duracao === "60 segundos" ? "60s" : "90s";

  const prompt = isAnuncio
    ? `Pesquise UM dado real sobre: "${ideia}". Use esse dado para criar roteiro de anúncio ${durSeg}. Tom: ${tom}.
JSON puro, CADA CAMPO MÁXIMO 20 PALAVRAS:
{"ideia":"tema","gancho":"abertura atacando dor","tipo_gancho":"tipo + motivo","desenvolvimento":"dor ou crítica","climax":"diferencial","fechamento":"CTA justificado","legenda":"max 50 palavras com pergunta final","hashtags":"#t1 #t2 #t3 #t4 #t5 #t6 #t7 #t8"}`
    : `Pesquise UM dado real sobre: "${ideia}". Use esse dado para criar roteiro viral ${durSeg}. Tom: ${tom}.
Ganchos: Negativo,Contraintuitivo,Curiosidade,Polêmica,Você sabia que,Autoridade,Storytelling,Identificação,Frases de Impacto,Urgência,Visual.
JSON puro, CADA CAMPO MÁXIMO 20 PALAVRAS:
{"ideia":"tema com dado real","gancho":"frase exata 0-3s","tipo_gancho":"tipo + motivo","desenvolvimento":"corpo do vídeo","climax":"insight principal","fechamento":"conclusão+CTA","legenda":"max 50 palavras com pergunta final","hashtags":"#t1 #t2 #t3 #t4 #t5 #t6 #t7 #t8"}`;

  try {
    res.json(parseJSON(await api(prompt, HAIKU, true, 2000)));
  } catch(e) {
    console.error("Roteiro:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// TREND — duas buscas separadas e curtas
app.post("/buscar-trends", async (req, res) => {
  const { nicho } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const hoje = new Date().toLocaleDateString('pt-BR');

  try {
    // Busca 1: trends (sem web search, modelo mais barato)
    const promptTrends = `Nicho: "${nicho}". Liste 3 trends viralizando agora no Instagram/TikTok. JSON puro:
{"trends":[{"titulo":"...","score":80,"plataformas":["Reels","TikTok"],"tags":["tag1","tag2"],"descricao":"por que viraliza em 30 palavras","como_usar":"como usar em 20 palavras","fonte":null}]}`;

    // Busca 2: polêmicas (com web search focado)
    const promptCasos = `Hoje é ${hoje}. Busque na internet: polêmicas, escândalos, brigas, cancelamentos dos ÚLTIMOS 5 DIAS no nicho de "${nicho}" no Brasil. Inclua influenciadores, empresários, marcas. Seja direto. Se não houver polêmica, busque novidades e conquistas recentes. JSON puro:
{"casos":[{"nome":"nome real","tipo":"polêmica","tempo":"há X dias","descricao":"o que aconteceu em 30 palavras","oportunidade":"como criar conteúdo em 20 palavras","fonte":"url real ou null"}]}
4 casos reais e recentes.`;

    const [textTrends, textCasos] = await Promise.all([
      api(promptTrends, HAIKU, false, 800),
      api(promptCasos, SONNET, true, 1000),
    ]);

    let trends = [], casos = [];
    try { trends = parseJSON(textTrends).trends || []; } catch(e) { console.error("Parse trends:", e.message); }
    try { casos = parseJSON(textCasos).casos || []; } catch(e) { console.error("Parse casos:", e.message); }

    if (!trends.length && !casos.length) return res.status(500).json({ error: "Sem resultados" });
    res.json({ trends, casos });
  } catch(e) {
    console.error("Trends:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// FOLLOW — Haiku (mensagens simples)
app.post("/gerar-followup", async (req, res) => {
  const { nicho, publico } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const prompt = `Sequência follow-up Padrão Aventus. Vendedor vende: "${nicho}" para: "${publico||"leads"}".
Use "fulano" como placeholder. Mensagens do vendedor para o lead.
13 etapas obrigatórias:
1.Imediato-boas-vindas+dica vídeo 2.Até 20min-ligar 3.Não ligou-avisar 4.Não atendeu-apresentação+diferencial 5.+24h-disponibilidade 6.+7h-ligar→oi 7.+24h-ligar→ 8.+7h-apagar contato 9.+24h-PERDIDOS post Instagram 10.+2dias-insistência criativa 11.+2dias-conteúdo 12.+2dias-conteúdo 13.+2dias-reunião
JSON puro:
{"followup":[{"tempo":"Imediato","tipo":"mensagem","acao":"Boas-vindas","mensagem":"texto","dica":"dica"}]}`;

  try {
    res.json(parseJSON(await api(prompt, HAIKU, false, 2500)));
  } catch(e) {
    console.error("Follow:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// PROPOSAL — Sonnet (qualidade máxima)
app.post("/gerar-proposta", async (req, res) => {
  const { diferencial, problema, ciclo, solucao, credenciais, endereco, indicadores, metodo, icp, preco_caro, preco_final } = req.body;

  const prompt = `Proposta comercial Método Aventus. Dados:
Diferencial:${diferencial}|Problema:${problema}|Ciclo:${ciclo}|Solução:${solucao}|Credenciais:${credenciais}|Endereço:${endereco}|Indicadores:${indicadores}|Método:${metodo}|ICP:${icp}|Preço cheio:${preco_caro}|Preço final:${preco_final}

15 slides em ordem: 1.DIFERENCIAL 2.PROBLEMA DO MERCADO 3.CICLO VICIOSO 4.COMO TRATAMOS 5.CREDENCIAIS 6.ONDE NOS ENCONTRAR 7.NOSSOS NÚMEROS 8.NOSSO MÉTODO 9.SÓ INFORMAÇÃO NÃO BASTA(metáfora criativa ao nicho) 10.O QUE CONTINUARÁ SENTINDO(dores+"uma decisão muda tudo") 11.O QUE TE TROUXE AQUI(pergunta agendamento) 12.SUA MOTIVAÇÃO(porquê profundo do ICP) 13.DEPOIMENTOS(placeholder vídeo) 14.INVESTIMENTO COMPLETO(entregas+preço cheio) 15.SEU INVESTIMENTO(preço final)
JSON puro:
{"slides":[{"titulo":"...","subtitulo":"...","tipo":"normal","conteudo":"..."}]}`;

  try {
    res.json(parseJSON(await api(prompt, SONNET, false, 3500)));
  } catch(e) {
    console.error("Proposta:", e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
