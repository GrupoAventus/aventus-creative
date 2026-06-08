const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const SONNET = "claude-sonnet-4-6";   // qualidade alta — Creative e Proposal
const HAIKU  = "claude-haiku-4-5-20251001"; // rápido e barato — Trend e Follow

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
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON não encontrado");
  return JSON.parse(text.slice(s, e + 1));
}

app.post("/login", (req, res) => {
  const u = (req.body.usuario || "").toLowerCase().replace(/\s+/g, "");
  const s = req.body.senha;
  USUARIOS[u] && USUARIOS[u] === s ? res.json({ ok: true }) : res.status(401).json({ ok: false });
});

// CREATIVE — Sonnet (qualidade máxima)
app.post("/gerar-roteiro", async (req, res) => {
  const { ideia, tom, duracao, nicho } = req.body;
  if (!ideia) return res.status(400).json({ error: "Ideia obrigatória" });

  const prompt = `Roteiro viral para Instagram Reels. Nicho: ${nicho||"Negócios"}. Tom: ${tom}. Duração: ${duracao}.
Tema: "${ideia}"
Pesquise dados reais sobre o tema na web.
Ganchos disponíveis: Negativo, Contraintuitivo, Curiosidade, Polêmica, Você sabia que, Autoridade, Storytelling, Identificação, Frases de Impacto, Urgência, Visual.
JSON puro apenas:
{"ideia":"mensagem central com dado real","gancho":"frase exata abertura 0-3s","tipo_gancho":"nome + por que foi escolhido em 2 frases","desenvolvimento":"corpo 4-30s sem enrolação","climax":"insight 30s-1min","fechamento":"conclusão+CTA","legenda":"legenda humana max 100 palavras terminando com pergunta","hashtags":"10 hashtags relevantes"}`;

  try {
    res.json(parseJSON(await api(prompt, SONNET, true, 1200)));
  } catch(e) {
    console.error("Roteiro:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// TREND — Haiku (busca web barata)
app.post("/buscar-trends", async (req, res) => {
  const { nicho } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const hoje = new Date().toLocaleDateString('pt-BR');
  const prompt = `Data: ${hoje}. Nicho: "${nicho}".
Pesquise na web: 1) trends viralizando agora 2) polêmicas/casos dos ÚLTIMOS 5 DIAS de influenciadores/empresários desse nicho.
APENAS casos dos últimos 5 dias. Mínimo 2 polêmicas reais.
JSON puro, max 40 palavras por campo:
{"trends":[{"titulo":"...","score":80,"plataformas":["Reels"],"tags":["t1"],"descricao":"...","como_usar":"...","fonte":"url ou null"}],"casos":[{"nome":"...","tipo":"polêmica","tempo":"há X dias","descricao":"...","oportunidade":"...","fonte":"url ou null"}]}
3 trends, 4 casos.`;

  try {
    const text = await api(prompt, HAIKU, true, 1500);
    let trends = [], casos = [];
    try {
      const p = parseJSON(text);
      trends = p.trends || []; casos = p.casos || [];
    } catch {
      const tm = text.match(/"trends"\s*:\s*(\[[\s\S]*?\])\s*,\s*"casos"/);
      const cm = text.match(/"casos"\s*:\s*(\[[\s\S]*?\])\s*\}/);
      if (tm) try { trends = JSON.parse(tm[1]); } catch {}
      if (cm) try { casos = JSON.parse(cm[1]); } catch {}
    }
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
