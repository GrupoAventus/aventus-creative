const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ======= USUÁRIOS E SENHAS =======
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
// =================================

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  const u = usuario.toLowerCase().replace(/\s+/g, "");
  if (USUARIOS[u] && USUARIOS[u] === senha) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Usuário ou senha incorretos." });
  }
});

app.post("/gerar-roteiro", async (req, res) => {
  const { ideia, tom, duracao, nicho } = req.body;
  if (!ideia) return res.status(400).json({ error: "Ideia obrigatória" });
  const nichoSelecionado = nicho || "Negócios & Empreendedorismo";

  const GANCHO_TIPOS = ["Negativo","Contraintuitivo","Curiosidade","Polêmica","Pergunta: Você sabia que...","Autoridade","Storytelling","Identificação","Frases de Impacto","Urgência","Visual"];

  const prompt = `Você é um especialista em roteiros virais para Instagram Reels no nicho de ${nichoSelecionado}.

O usuário quer criar um Reel com a seguinte ideia/tema: "${ideia}"
Tom desejado: ${tom}
Duração alvo: ${duracao}
Nicho: ${nichoSelecionado}

Use web search para pesquisar dados reais e atuais sobre esse tema antes de criar o roteiro.

Os 11 tipos de gancho: ${GANCHO_TIPOS.map((g,i) => `${i+1}. ${g}`).join(", ")}

Responda APENAS em JSON puro, sem markdown, sem texto fora do JSON:

{
  "ideia": "Mensagem central em 1-2 frases com dados reais do tema.",
  "gancho": "Frase exata de abertura (0-3s) que para o scroll. Deve ser falada na câmera, impactante.",
  "tipo_gancho": "Nome do tipo de gancho escolhido + explicação em 2-3 frases de POR QUE esse gancho foi escolhido e como retém atenção nos primeiros 3 segundos.",
  "desenvolvimento": "Corpo do vídeo (4-30s): entrega o presságio rapidamente, sem enrolação.",
  "climax": "O ponto alto (30s-1min): o insight, a virada, a lição mais importante.",
  "fechamento": "Conclusão + CTA (1min-1:30min): entrega a promessa e termina com chamada clara."
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    console.log("Roteiro API:", JSON.stringify(data).slice(0, 300));

    if (data.error) return res.status(500).json({ error: data.error.message });

    const content = data.content || [];
    const text = content.filter(i => i.type === "text").map(i => i.text).join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Formato inválido" });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("Erro roteiro:", e);
    res.status(500).json({ error: "Erro ao gerar roteiro" });
  }
});

app.post("/buscar-trends", async (req, res) => {
  const { nicho } = req.body;
  if (!nicho) return res.status(400).json({ error: "Nicho obrigatório" });

  const prompt = `Você é um especialista em tendências de conteúdo viral para redes sociais.

Use a busca na web para pesquisar AGORA as trends mais quentes para o nicho: "${nicho}"

Pesquise: vídeos viralizando, temas em alta, hashtags trending, formatos de conteúdo que estão bombando no Instagram Reels e TikTok para esse nicho nos últimos dias.

Para cada trend, calcule um score de 0 a 100 baseado em:
- Volume de engajamento de vídeos similares
- Velocidade de crescimento
- Potencial de replicação

Retorne APENAS JSON puro, sem markdown, sem texto fora do JSON:

{
  "trends": [
    {
      "titulo": "Título chamativo da trend",
      "score": 85,
      "plataformas": ["Reels", "TikTok"],
      "tags": ["tag1", "tag2", "tag3"],
      "descricao": "Por que essa trend está viralizando agora, com dados concretos de engajamento e alcance de vídeos similares.",
      "como_usar": "Sugestão prática e específica de como criar um conteúdo usando essa trend no nicho informado."
    },
    {...},
    {...}
  ]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    console.log("Trends API:", JSON.stringify(data).slice(0, 300));

    if (data.error) return res.status(500).json({ error: data.error.message });

    const content = data.content || [];
    const text = content.filter(i => i.type === "text").map(i => i.text).join("");

    // Extrai o JSON mais externo (do primeiro { ao último })
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return res.status(500).json({ error: "Formato inválido" });
    const jsonStr = text.slice(start, end + 1);
    res.json(JSON.parse(jsonStr));
  } catch (e) {
    console.error("Erro trends:", e);
    res.status(500).json({ error: "Erro ao buscar trends" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
