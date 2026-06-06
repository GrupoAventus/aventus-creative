const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve o frontend

app.post("/gerar-roteiro", async (req, res) => {
  const { ideia, tom, duracao } = req.body;

  if (!ideia) return res.status(400).json({ error: "Ideia obrigatória" });

  const GANCHO_TIPOS = [
    "Negativo", "Contraintuitivo", "Curiosidade", "Polêmica",
    "Pergunta: Você sabia que...", "Autoridade", "Storytelling",
    "Identificação", "Frases de Impacto", "Urgência", "Visual"
  ];

  const prompt = `Você é um especialista em roteiros virais para Instagram Reels no nicho de Negócios e Empreendedorismo.

Ideia/tema: "${ideia}"
Tom: ${tom}
Duração: ${duracao}

Use web search para pesquisar dados reais e atuais sobre esse tema.

Os 11 tipos de gancho disponíveis: ${GANCHO_TIPOS.map((g,i) => `${i+1}. ${g}`).join(", ")}

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
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content.filter(i => i.type === "text").map(i => i.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao gerar roteiro" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
