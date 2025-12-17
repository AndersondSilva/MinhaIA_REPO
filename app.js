let themeDark = true;
let history = [];
let currentConvo = "default";
let customText = "";

// -------------------- LocalStorage --------------------
function saveLocal(){
  localStorage.setItem("ollama_history_"+currentConvo, JSON.stringify(history));
}
function loadLocal(name){
  const saved = localStorage.getItem("ollama_history_"+name);
  history = saved ? JSON.parse(saved) : [];
  render();
}
function saveCustomText(){
  customText = document.getElementById("custom-text").value;
  localStorage.setItem("ollama_custom_text", customText);
  alert("Texto padrão salvo!");
}

// -------------------- Theme --------------------
function loadTheme(){
  themeDark = localStorage.getItem("ollama_theme") !== "light";
  document.body.classList.toggle("light", !themeDark);
}
function toggleTheme(){
  themeDark = !themeDark;
  document.body.classList.toggle("light", !themeDark);
  localStorage.setItem("ollama_theme", themeDark ? "dark" : "light");
}

// -------------------- Sidebar --------------------
function toggleSidebar(){
  document.getElementById("sidebar").classList.toggle("hidden");
}

// -------------------- Configurações --------------------
function openSettings(){
  document.getElementById("sidebar").classList.remove("hidden");
}

// -------------------- UI --------------------
function append(who, text){
  const el = document.getElementById("messages");
  el.innerHTML += `<div class="message ${who}">${who==="user"?"Você":"IA"}: ${text}</div>`;
  el.scrollTop = el.scrollHeight;
}

function render(){
  const el=document.getElementById("messages");
  el.innerHTML="";
  history.forEach(m => append(m.who, m.text));
}

function renderConvos(){
  const ul=document.getElementById("convo-list");
  ul.innerHTML="";
  const keys = Object.keys(localStorage).filter(k=>k.startsWith("ollama_history_"));
  const names = keys.map(k=> k.replace("ollama_history_","").replace(/^.*_/,""));
  const unique=[...new Set(names)];
  unique.forEach(n=>{
    const li=document.createElement("li");
    li.textContent=n; li.style.cursor="pointer";
    li.onclick=()=>{ currentConvo=n; loadLocal(n); };
    ul.appendChild(li);
  });
}

// -------------------- Chat --------------------
function newChat(){
  currentConvo="chat_"+Date.now();
  history=[]; saveLocal(); renderConvos(); render();
}

async function sendMessage(){
  const i=document.getElementById("input");
  const txt=i.value.trim(); if(!txt) return;
  append("user",txt);
  history.push({who:"user",text:txt});
  i.value="";
  saveLocal();

  const spinner=document.createElement("div");
  spinner.className="spinner"; spinner.id="think";
  spinner.textContent="Pensando...";
  document.getElementById("messages").appendChild(spinner);

  const t=document.getElementById("timer"); let c=3;
  t.textContent=c+"s";
  const timer=setInterval(()=>{c--; if(c>0) t.textContent=c+"s"; else{ clearInterval(timer); t.textContent=""; }},1000);

  try{
    const model=document.getElementById("model").value;
    const res = await fetch("/ollama", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:txt,history:history,model,customText})
    });
    const data=await res.json();
    document.getElementById("think").remove();
    append("bot", data.result);
    history.push({who:"bot",text:data.result});
    saveLocal();
  }catch{
    document.getElementById("think").remove();
    append("bot","Erro de comunicação.");
  }
}

// -------------------- Inicialização --------------------
function loadCustomText(){
  customText = localStorage.getItem("ollama_custom_text") || "";
  document.getElementById("custom-text").value = customText;
}
loadTheme();
loadCustomText();
renderConvos();
