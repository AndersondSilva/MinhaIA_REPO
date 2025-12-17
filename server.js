const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();
const { OAuth2Client } = require("google-auth-library");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "lhama-secret-dev",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// User Profile Memory
const MEMORY_FILE = path.join(DATA_DIR, "user_profile.json");
if (!fs.existsSync(MEMORY_FILE)) fs.writeFileSync(MEMORY_FILE, JSON.stringify({ facts: [] }));

const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));

function readData(name) {
  const file = path.join(DATA_DIR, name + ".json");
  if (!fs.existsSync(file)) return null;
  
  // Infer type from name if possible
  const inferredType = name.startsWith('proj_') ? 'project' : 'chat';
  
  try {
    const content = fs.readFileSync(file, "utf-8");
    if (!content) return { messages: [], type: inferredType, title: name };
    let json = JSON.parse(content);
    if (Array.isArray(json)) return { messages: json, type: inferredType, title: name };
    
    // Ensure type is set correctly if missing
    if(!json.type) json.type = inferredType;
    
    return { ...json, title: json.title || name };
  } catch { return { messages: [], type: inferredType, title: name }; }
}

app.post("/auth/register", (req, res) => {
    const { email, password, name } = req.body;
    if(!email || !password || !name) return res.status(400).json({error: "Dados incompletos"});
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    if(users.find(u => u.email === email)) return res.status(400).json({error: "Email já cadastrado"});
    
    const newUser = { id: Date.now().toString(), email, password, name, picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random` };
    users.push(newUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    
    req.session.user = { id: newUser.id, name: newUser.name, email: newUser.email, picture: newUser.picture };
    res.json(req.session.user);
});

app.post("/auth/login", (req, res) => {
    const { email, password } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    const user = users.find(u => u.email === email && u.password === password);
    
    if(!user) return res.status(401).json({error: "Credenciais inválidas"});
    
    req.session.user = { id: user.id, name: user.name, email: user.email, picture: user.picture };
    res.json(req.session.user);
});

function saveData(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name + ".json"), JSON.stringify(data, null, 2));
}

function listConversations(userId) {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && f !== "user_profile.json" && f !== "users.json" && !f.startsWith("memory_"))
    .map((f) => {
      const name = path.basename(f, ".json");
      const data = readData(name);
      return { name, type: data.type || 'chat', title: data.title || name, userId: data.userId };
    })
    .filter(item => {
        // Show only items that belong to the user
        // If item has no userId (legacy), show it to everyone (or migrate it)
        if (item.userId) return item.userId === userId;
        return true; // Legacy items remain visible to all
    })
    .sort((a,b) => {
      return b.name.localeCompare(a.name);
    });
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/check-ollama", async (req, res) => {
  try {
    await axios.get("http://localhost:11434/api/tags");
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

app.post("/config/google-id", (req, res) => {
    const { clientId } = req.body;
    // Allow empty string to disable
    if(clientId === undefined) return res.status(400).json({error: "Missing clientId"});
    
    // Read .env
    const envPath = path.join(__dirname, ".env");
    let envContent = "";
    if(fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, "utf-8");
    
    // Update or Append
    if(envContent.includes("GOOGLE_CLIENT_ID=")){
        envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/, `GOOGLE_CLIENT_ID=${clientId}`);
    } else {
        envContent += `\nGOOGLE_CLIENT_ID=${clientId}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    process.env.GOOGLE_CLIENT_ID = clientId; // Runtime update (might need restart for some libs)
    res.json({ ok: true });
});

app.get("/me", (req, res) => {
  res.json(req.session.user || null);
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/conversations", (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;
  res.json(listConversations(userId));
});

app.get("/conversation/:name", (req, res) => {
  const data = readData(req.params.name);
  if (!data) return res.status(404).end();
  
  // Optional: Check permission
  // if(data.userId && (!req.session.user || data.userId !== req.session.user.id)) return res.status(403).json({error: "Access denied"});
  
  res.json(data);
});

app.post("/conversation/:name", (req, res) => {
  const messages = req.body.messages || [];
  const type = req.body.type || 'chat';
  const title = req.body.title || req.params.name;
  
  // Determine owner
  const userId = req.session.user ? req.session.user.id : null;
  const existing = readData(req.params.name);
  const ownerId = existing && existing.userId ? existing.userId : userId;
  
  saveData(req.params.name, { messages, type, title, userId: ownerId });
  res.json({ ok: true });
});

app.delete("/conversation/:name", (req, res) => {
  const file = path.join(DATA_DIR, req.params.name + ".json");
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

app.post("/conversation/:name/rename", (req, res) => {
  const oldName = req.params.name;
  const newTitle = req.body.title;
  if(!newTitle) return res.status(400).json({error: "Title required"});
  
  const data = readData(oldName);
  if(!data) return res.status(404).json({error: "Not found"});
  
  data.title = newTitle;
  saveData(oldName, data);
  res.json({ ok: true });
});

// Memory / Learning Endpoints
app.get("/memory", (req, res) => {
  const userId = req.session.user ? req.session.user.id : 'default';
  const memFile = path.join(DATA_DIR, `memory_${userId}.json`);
  
  if (!fs.existsSync(memFile)) fs.writeFileSync(memFile, JSON.stringify({ facts: [] }));
  
  const content = fs.readFileSync(memFile, "utf-8");
  res.json(JSON.parse(content));
});

app.post("/memory/learn", async (req, res) => {
  const userId = req.session.user ? req.session.user.id : 'default';
  const memFile = path.join(DATA_DIR, `memory_${userId}.json`);
  if (!fs.existsSync(memFile)) fs.writeFileSync(memFile, JSON.stringify({ facts: [] }));

  try {
    const { text } = req.body;
    // Call Ollama to extract facts
    const r = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3.2:3b",
      prompt: `Extract key user preferences, facts, or style traits from this text. Return only concise bullet points. Text: "${text}"`,
      stream: false,
    });
    
    const newFacts = r.data.response.trim();
    if(newFacts){
      const mem = JSON.parse(fs.readFileSync(memFile, "utf-8"));
      mem.facts.push({ date: Date.now(), text: newFacts });
      fs.writeFileSync(memFile, JSON.stringify(mem, null, 2));
    }
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ollama", async (req, res) => {
  try {
    const { prompt, history = [], model = "llama3.2:3b", system = "", useMemory = false } = req.body;

    // Build context
    const context = history.slice(-10).map((m) => m.text).join("\n");
    
    // Image Generation Check
    const imageKeywords = ["imagem de", "crie uma imagem", "desenhe", "gerar imagem", "photo of", "image of", "draw"];
    const isImageRequest = imageKeywords.some(k => prompt.toLowerCase().includes(k));

    let finalSystem = system;
    if(isImageRequest) {
       finalSystem += `\n\nIMPORTANT: The user wants an image. You MUST return a Markdown image link using Pollinations.ai.
       Format: ![Description](https://image.pollinations.ai/prompt/DESCRIPTION_IN_ENGLISH_URL_ENCODED?nologo=true)
       Example: User asks "image of a cat", you return "Here is your image:\n![Cat](https://image.pollinations.ai/prompt/cat?nologo=true)"
       Translate the prompt to English for the URL. Do not explain, just provide the image.`;
    }

    if(useMemory){
      try {
        const mem = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
        const facts = mem.facts.map(f => f.text).join("\n");
        if(facts) finalSystem += `\n\nUser Profile/Memory:\n${facts}\n`;
      } catch(e){ console.error("Memory read error", e); }
    }

    const finalPrompt = (finalSystem ? `System: ${finalSystem}\n` : "") + 
                        (context ? `Context:\n${context}\n` : "") + 
                        `User: ${prompt}`;

    const r = await axios.post("http://localhost:11434/api/generate", {
      model,
      prompt: finalPrompt,
      stream: false,
    });
    const d = r.data;
    if (!d.response) return res.status(500).json({ error: "Sem resposta" });
    res.json({ result: d.response.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("🚀 Server ON"));
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

app.post("/auth/google", async (req, res) => {
  try {
    if (!googleClient) return res.status(400).json({ error: "GOOGLE_CLIENT_ID ausente" });
    const idToken = req.body && req.body.id_token;
    if (!idToken) return res.status(400).json({ error: "id_token ausente" });
    const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    const user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };
    req.session.user = user;
    res.json(user);
  } catch (e) {
    res.status(401).json({ error: "Token inválido", details: e.message });
  }
});
