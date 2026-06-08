const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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
Responda APENAS JSON puro:
{"ideia":"...","gancho":"...","tipo_gancho":"...","desenvolvimento":"...","climax":"...","fechamento":"...","legenda":"Legenda humana max 150 palavras terminando com pergunta para gerar comentários","hashtags":"#tag1 #tag2 ... (10 hashtags)"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "web-search-2025-03-05" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1500, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = (data.content || []).filter(i => i.type === "text").map(i => i.text).join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Formato inválido" });
    res.json(JSON.parse(text.slice(s, e + 1)));
  } catch(e) {
    console.error("Erro roteiro:", e);
    res.status(500).json({ error: "Erro ao gerar roteiro" });
  }
});

app.post("/buscar-trends", async (req, res) => {
  const { nicho } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const prompt = `Você é um especialista em monitoramento de redes sociais e tendências virais.

Pesquise na internet AGORA sobre o nicho: "${nicho}"

IMPORTANTE: Você DEVE buscar ativamente por polêmicas, escândalos, brigas, cancelamentos e controvérsias recentes. Não omita nada. Seja direto e jornalístico.

Faça as seguintes buscas:
1. Trends e formatos de conteúdo viralizando agora nesse nicho
2. Polêmicas, escândalos, brigas e cancelamentos recentes de influenciadores e empresários do nicho (últimos 30 dias)
3. Conquistas, lançamentos e novidades relevantes do nicho

Retorne OBRIGATORIAMENTE pelo menos 2 casos do tipo "polêmica" com fatos reais e recentes.

Responda APENAS JSON puro, campos CURTOS (max 80 palavras cada):
{
  "trends": [
    {
      "titulo": "título curto da trend",
      "score": 85,
      "plataformas": ["Reels", "TikTok"],
      "tags": ["tag1", "tag2"],
      "descricao": "por que está viralizando agora com dados concretos",
      "como_usar": "como aplicar no nicho de forma prática"
    }
  ],
  "casos": [
    {
      "nome": "Nome real do influenciador/empresário envolvido",
      "tipo": "polêmica",
      "tempo": "há X dias",
      "descricao": "O que aconteceu de forma objetiva e direta. Não suavize.",
      "oportunidade": "como criar conteúdo usando esse caso no seu nicho"
    }
  ]
}

Tipos: "polêmica" (brigas, escândalos, cancelamentos, processos, acusações), "conquista" (recordes, lançamentos, marcos), "novidade" (tendências, mudanças de mercado).
Retorne pelo menos 3 trends e 5 casos — MÍNIMO 2 polêmicas reais.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "web-search-2025-03-05" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2000, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = (data.content || []).filter(i => i.type === "text").map(i => i.text).join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Formato inválido" });
    let jsonStr = text.slice(s, e + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
    res.json(JSON.parse(jsonStr));
  } catch(e) {
    console.error("Erro trends:", e);
    res.status(500).json({ error: "Erro ao buscar trends" });
  }
});

app.post("/gerar-followup", async (req, res) => {
  const { nicho, publico } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });
  const contexto = publico ? `Produto/serviço: "${nicho}". Público-alvo: "${publico}"` : `Nicho: "${nicho}"`;

  const prompt = `Especialista em vendas. Gere sequência de follow-up Padrão Aventus para:
${contexto}
As mensagens são enviadas PELO VENDEDOR para os LEADS. Use "fulano" como placeholder.

Estrutura OBRIGATÓRIA:
1. Imediato: boas-vindas + dica vídeo apresentação
2. Até 20min: ligar
3. Se não ligou em 20min: avisar que vai ligar
4. Se não atendeu: apresentação + diferencial
5. +24h: perguntar disponibilidade
6. +7h: ligar → se não atender: manda "oi"
7. +24h: ligar → se não atender:
8. +7h: "vou apagar seu contato — falta de interesse ou correria?"
9. +24h: AUTOMAÇÃO PERDIDOS — post Instagram
10. +2 dias: mensagem criativa sobre insistência
11. +2 dias: outro conteúdo Instagram
12. +2 dias: outro conteúdo
13. +2 dias: convite reunião

Responda APENAS JSON puro:
{"followup":[{"tempo":"Imediato","tipo":"mensagem","acao":"Mensagem de boas-vindas","mensagem":"texto","dica":"dica"}]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = (data.content || []).filter(i => i.type === "text").map(i => i.text).join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Formato inválido" });
    res.json(JSON.parse(text.slice(s, e + 1)));
  } catch(e) {
    console.error("Erro followup:", e);
    res.status(500).json({ error: "Erro ao gerar follow-up" });
  }
});

app.post("/gerar-proposta", async (req, res) => {
  const { diferencial, problema, ciclo, solucao, credenciais, endereco, indicadores, metodo, icp, preco_caro, preco_final } = req.body;

  const prompt = `Você é um especialista em propostas comerciais. Monte uma proposta no Método Aventus Digital.

Dados do cliente:
- Diferencial: ${diferencial}
- Problema do mercado: ${problema}
- Ciclo vicioso: ${ciclo}
- Solução: ${solucao}
- Credenciais: ${credenciais}
- Endereço/onde encontrar: ${endereco}
- Indicadores: ${indicadores}
- Método e entregáveis: ${metodo}
- Cliente ideal (ICP): ${icp}
- Preço cheio: ${preco_caro}
- Preço final: ${preco_final}

Gere EXATAMENTE esses slides em ordem:
1. DIFERENCIAL — o que diferencia essa empresa no mercado
2. PROBLEMA DO MERCADO — dor que o cliente enfrenta
3. CICLO VICIOSO — por que o cliente não consegue resolver sozinho
4. COMO TRATAMOS — como essa empresa resolve de forma diferente
5. CREDENCIAIS — formação, experiência, autoridade
6. ONDE NOS ENCONTRAR — endereço e presença digital
7. NOSSOS NÚMEROS — indicadores e resultados
8. NOSSO MÉTODO — entregáveis e como funciona
9. SÓ INFORMAÇÃO NÃO BASTA — adapte uma metáfora criativa ao nicho mostrando que sem execução/acompanhamento não funciona
10. O QUE VOCÊ VAI CONTINUAR SENTINDO — dores se não contratar, finalizando com "uma decisão pode mudar tudo isso"
11. O QUE TE TROUXE AQUI HOJE — pergunta: "O que fez você agendar essa conversa hoje e não daqui 3 meses?"
12. SUA MOTIVAÇÃO — com base no ICP, descubra a motivação profunda perguntando "por quê?" 3 vezes. Mostre onde o cliente quer chegar
13. DEPOIMENTOS — slide indicando que aqui vai um vídeo de feedback de cliente
14. INVESTIMENTO COMPLETO — liste TODAS as entregas com o preço cheio
15. SEU INVESTIMENTO — apenas o preço final protagonista

Responda APENAS JSON puro:
{"slides":[{"titulo":"DIFERENCIAL","subtitulo":"Por que somos diferentes","tipo":"normal","conteudo":"conteúdo do slide"}]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = (data.content || []).filter(i => i.type === "text").map(i => i.text).join("");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) return res.status(500).json({ error: "Formato inválido" });
    res.json(JSON.parse(text.slice(s, e + 1)));
  } catch(e) {
    console.error("Erro proposta:", e);
    res.status(500).json({ error: "Erro ao gerar proposta" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
