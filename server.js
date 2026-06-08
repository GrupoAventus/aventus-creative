const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MODELO = "claude-sonnet-4-6";

const USUARIOS = {
  "squad01": "aventus",
  "squad02": "aventus",
  "brunoguedes": "aventus",
  "heloisa": "aventus",
  "moldandoinox": "aventus",
  "fernando": "aventus",
  "romulo": "aventus",
  "darlene": "aventus",
  "joel": "aventus",
  "construart": "aventus",
};

async function chamarAPI(prompt, usarWebSearch = false, maxTokens = 1500) {
  const body = {
    model: MODELO,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (usarWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
  if (usarWebSearch) {
    headers["anthropic-beta"] = "web-search-2025-03-05";
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const data = await response.json();
  console.log("API response:", JSON.stringify(data).slice(0, 200));
  if (data.error) throw new Error(data.error.message);
  const text = (data.content || []).filter(i => i.type === "text").map(i => i.text).join("");
  return text;
}

function extrairJSON(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON não encontrado");
  return JSON.parse(text.slice(s, e + 1));
}

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  const u = usuario.toLowerCase().replace(/\s+/g, "");
  if (USUARIOS[u] && USUARIOS[u] === senha) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

app.post("/gerar-roteiro", async (req, res) => {
  const { ideia, tom, duracao, nicho } = req.body;
  if (!ideia) return res.status(400).json({ error: "Ideia obrigatória" });
  const nichoSelecionado = nicho || "Negócios & Empreendedorismo";
  const GANCHO_TIPOS = ["Negativo","Contraintuitivo","Curiosidade","Polêmica","Pergunta: Você sabia que...","Autoridade","Storytelling","Identificação","Frases de Impacto","Urgência","Visual"];

  const prompt = `Você é um especialista em roteiros virais para Instagram Reels no nicho de ${nichoSelecionado}.
Ideia/tema: "${ideia}", Tom: ${tom}, Duração: ${duracao}, Nicho: ${nichoSelecionado}
Use web search para pesquisar dados reais sobre esse tema.
Os 11 tipos de gancho: ${GANCHO_TIPOS.map((g,i) => `${i+1}. ${g}`).join(", ")}
Responda APENAS JSON puro sem markdown:
{"ideia":"...","gancho":"...","tipo_gancho":"...","desenvolvimento":"...","climax":"...","fechamento":"...","legenda":"Legenda humana max 150 palavras terminando com pergunta","hashtags":"#tag1 #tag2 (10 hashtags)"}`;

  try {
    const text = await chamarAPI(prompt, true, 1500);
    res.json(extrairJSON(text));
  } catch(e) {
    console.error("Erro roteiro:", e.message);
    res.status(500).json({ error: "Erro ao gerar roteiro: " + e.message });
  }
});

app.post("/buscar-trends", async (req, res) => {
  const { nicho } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const hoje = new Date().toLocaleDateString('pt-BR');
  const prompt = `Você é um especialista em monitoramento de redes sociais e tendências virais.
A data de hoje é ${hoje}.
Pesquise na internet sobre o nicho: "${nicho}"

REGRA CRÍTICA: Retorne APENAS casos dos ÚLTIMOS 5 DIAS. Não invente datas nem retorne casos antigos.

Busque:
1. Trends viralizando agora nesse nicho
2. Polêmicas, brigas, cancelamentos dos ÚLTIMOS 5 DIAS
3. Conquistas e novidades dos ÚLTIMOS 5 DIAS

Responda APENAS JSON puro, cada campo max 50 palavras:
{
  "trends": [{"titulo":"...","score":85,"plataformas":["Reels","TikTok"],"tags":["tag1"],"descricao":"...","como_usar":"...","fonte":"URL da fonte ou null"}],
  "casos": [{"nome":"...","tipo":"polêmica","tempo":"há X dias","descricao":"...","oportunidade":"...","fonte":"URL da notícia ou post original ou null"}]
}
Tipos: "polêmica", "conquista", "novidade"
Retorne 3 trends e 4 casos dos ÚLTIMOS 5 DIAS. Mínimo 2 polêmicas. Inclua a URL real da fonte quando disponível.`;

  try {
    const text = await chamarAPI(prompt, true, 2000);
    let trends = [], casos = [];
    try {
      const parsed = extrairJSON(text);
      trends = parsed.trends || [];
      casos = parsed.casos || [];
    } catch(parseErr) {
      try {
        const trendsMatch = text.match(/"trends"\s*:\s*(\[[\s\S]*?\])\s*,\s*"casos"/);
        if (trendsMatch) trends = JSON.parse(trendsMatch[1]);
        const casosMatch = text.match(/"casos"\s*:\s*(\[[\s\S]*?\])\s*\}/);
        if (casosMatch) casos = JSON.parse(casosMatch[1]);
      } catch(e2) {
        console.error("Parse parcial falhou:", e2.message);
      }
    }
    if (trends.length === 0 && casos.length === 0) {
      return res.status(500).json({ error: "Não foi possível processar a resposta" });
    }
    res.json({ trends, casos });
  } catch(e) {
    console.error("Erro trends:", e.message);
    res.status(500).json({ error: "Erro ao buscar trends: " + e.message });
  }
});

app.post("/gerar-followup", async (req, res) => {
  const { nicho, publico } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });
  const contexto = publico ? `Produto/serviço: "${nicho}". Público-alvo: "${publico}"` : `Nicho: "${nicho}"`;

  const prompt = `Especialista em vendas. Gere sequência de follow-up Padrão Aventus para:
${contexto}
Mensagens enviadas PELO VENDEDOR para LEADS. Use "fulano" como placeholder.

Sequência obrigatória:
1. Imediato: boas-vindas + dica vídeo
2. Até 20min: ligar
3. Se não ligou: avisar que vai ligar
4. Se não atendeu: apresentação + diferencial
5. +24h: perguntar disponibilidade
6. +7h: ligar → não atendeu: manda "oi"
7. +24h: ligar → não atendeu:
8. +7h: "vou apagar contato — interesse ou correria?"
9. +24h: AUTOMAÇÃO PERDIDOS — post Instagram
10. +2 dias: mensagem criativa sobre insistência
11. +2 dias: outro conteúdo
12. +2 dias: outro conteúdo
13. +2 dias: convite reunião

Responda APENAS JSON puro:
{"followup":[{"tempo":"Imediato","tipo":"mensagem","acao":"Boas-vindas","mensagem":"texto","dica":"dica"}]}`;

  try {
    const text = await chamarAPI(prompt, false, 3000);
    res.json(extrairJSON(text));
  } catch(e) {
    console.error("Erro followup:", e.message);
    res.status(500).json({ error: "Erro ao gerar follow-up: " + e.message });
  }
});

app.post("/gerar-proposta", async (req, res) => {
  const { diferencial, problema, ciclo, solucao, credenciais, endereco, indicadores, metodo, icp, preco_caro, preco_final } = req.body;

  const prompt = `Especialista em propostas comerciais. Monte proposta no Método Aventus Digital.

Dados:
- Diferencial: ${diferencial}
- Problema: ${problema}
- Ciclo vicioso: ${ciclo}
- Solução: ${solucao}
- Credenciais: ${credenciais}
- Endereço: ${endereco}
- Indicadores: ${indicadores}
- Método/entregáveis: ${metodo}
- ICP: ${icp}
- Preço cheio: ${preco_caro}
- Preço final: ${preco_final}

Gere exatamente 15 slides:
1. DIFERENCIAL, 2. PROBLEMA DO MERCADO, 3. CICLO VICIOSO, 4. COMO TRATAMOS, 5. CREDENCIAIS, 6. ONDE NOS ENCONTRAR, 7. NOSSOS NÚMEROS, 8. NOSSO MÉTODO, 9. SÓ INFORMAÇÃO NÃO BASTA (metáfora criativa adaptada ao nicho), 10. O QUE VOCÊ VAI CONTINUAR SENTINDO (dores + "uma decisão pode mudar tudo"), 11. O QUE TE TROUXE AQUI HOJE (pergunta sobre agendamento), 12. SUA MOTIVAÇÃO (motivação profunda do ICP), 13. DEPOIMENTOS (slide para vídeo de feedback), 14. INVESTIMENTO COMPLETO (todas entregas + preço cheio), 15. SEU INVESTIMENTO (preço final protagonista)

Responda APENAS JSON puro:
{"slides":[{"titulo":"DIFERENCIAL","subtitulo":"Por que somos diferentes","tipo":"normal","conteudo":"conteúdo"}]}`;

  try {
    const text = await chamarAPI(prompt, false, 4000);
    res.json(extrairJSON(text));
  } catch(e) {
    console.error("Erro proposta:", e.message);
    res.status(500).json({ error: "Erro ao gerar proposta: " + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
