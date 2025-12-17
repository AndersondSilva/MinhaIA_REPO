let currentConvo = "default";
let chatHistory = [];
let convoType = 'chat'; 

function el(id){ return document.getElementById(id); }

function updateChatHeader(title, isDefault = false){
  const elTitle = el('chat-title');
  const actions = el('header-actions');
  
  if(isDefault){
    elTitle.textContent = "Mini Ollama";
    actions.style.display = 'none';
  } else {
    elTitle.textContent = title || currentConvo;
    actions.style.display = 'flex';
    
    // Strict check
    const isProject = convoType === 'project' || currentConvo.startsWith('proj_');
    const editBtn = actions.querySelector('button[title="Renomear"]');
    
    if(editBtn){
      if(isProject) editBtn.style.display = 'inline-block';
      else editBtn.style.display = 'none';
    }
  }
}

function editCurrentTitle(){
  // Find current title
  let currentTitle = currentConvo;
  // Try to find in lists (expensive but accurate)
  // Actually we can just prompt with current text content
  const oldTitle = el('chat-title').textContent;
  renameConversation(currentConvo, oldTitle);
}

function deleteCurrentChat(){
  deleteConversation(currentConvo);
}

// -------------------- UI ACTIONS --------------------
function toggleSidebar(){
  const s = el('sidebar');
  s.classList.toggle('hidden');
}

function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('ollama_theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

function toggleProjects(){
  const list = el('project-list');
  const icon = el('proj-toggle-icon');
  const isHidden = list.style.display === 'none';
  
  if(isHidden){
    list.style.display = 'block';
    icon.textContent = '▼';
    localStorage.setItem('ollama_proj_collapsed', 'false');
  } else {
    list.style.display = 'none';
    icon.textContent = '▶';
    localStorage.setItem('ollama_proj_collapsed', 'true');
  }
}

function toggleConversations(){
  const list = el('convo-list');
  const icon = el('chat-toggle-icon');
  const isHidden = list.style.display === 'none';
  
  if(isHidden){
    list.style.display = 'block';
    icon.textContent = '▼';
    localStorage.setItem('ollama_chat_collapsed', 'false');
  } else {
    list.style.display = 'none';
    icon.textContent = '▶';
    localStorage.setItem('ollama_chat_collapsed', 'true');
  }
}

function restoreProjectToggle(){
  const collapsed = localStorage.getItem('ollama_proj_collapsed') === 'true';
  const list = el('project-list');
  const icon = el('proj-toggle-icon');
  if(collapsed){
    list.style.display = 'none';
    icon.textContent = '▶';
  } else {
    list.style.display = 'block';
    icon.textContent = '▼';
  }
  
  const chatCollapsed = localStorage.getItem('ollama_chat_collapsed') === 'true';
  const chatList = el('convo-list');
  const chatIcon = el('chat-toggle-icon');
  if(chatCollapsed){
    chatList.style.display = 'none';
    chatIcon.textContent = '▶';
  } else {
    chatList.style.display = 'block';
    chatIcon.textContent = '▼';
  }
}

function openSettings(){
  el('settings-modal').style.display = 'block';
  loadSettingsUI();
}
function closeSettings(){ el('settings-modal').style.display = 'none'; }

function toggleCustomArea(){
  const chk = el('chk-custom-persona');
  el('custom-persona-area').style.display = chk.checked ? 'block' : 'none';
}

function saveSettings(){
  const lang = el('cfg-lang').value;
  const layout = el('cfg-layout').value;
  const learning = el('cfg-learning').checked;
  const custom = el('cfg-custom').value;
  const accent = el('cfg-accent') ? el('cfg-accent').value : localStorage.getItem('ollama_accent') || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const gId = el('cfg-google-id').value.trim();
  
  // Collect personas
  const personas = [];
  document.querySelectorAll('.persona-chk:checked').forEach(c => personas.push(c.value));
  const useCustom = el('chk-custom-persona').checked;

  localStorage.setItem('ollama_lang', lang);
  localStorage.setItem('ollama_layout', layout);
  localStorage.setItem('ollama_learning', learning);
  localStorage.setItem('ollama_personas', JSON.stringify(personas));
  localStorage.setItem('ollama_use_custom', useCustom);
  localStorage.setItem('ollama_custom', custom);
  localStorage.setItem('ollama_accent', accent);
  
  if(gId !== googleClientId){
    fetch('/config/google-id', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ clientId: gId })
    }).then(() => {
      alert('Google ID salvo! A página será recarregada.');
      location.reload();
    });
  }
  
  applyLayout();
  applyAccent();
  alert('Configurações salvas!');
  closeSettings();
}

function loadSettingsUI(){
  el('cfg-lang').value = localStorage.getItem('ollama_lang') || 'pt';
  el('cfg-layout').value = localStorage.getItem('ollama_layout') || 'normal';
  el('cfg-learning').checked = localStorage.getItem('ollama_learning') === 'true';
  el('cfg-custom').value = localStorage.getItem('ollama_custom') || '';
  el('cfg-google-id').value = googleClientId === 'seu_client_id_aqui' ? '' : googleClientId;
  if(el('cfg-accent')) {
    el('cfg-accent').value = localStorage.getItem('ollama_accent') || '#0078ff';
  }
  
  const savedPersonas = JSON.parse(localStorage.getItem('ollama_personas') || '[]');
  document.querySelectorAll('.persona-chk').forEach(c => {
    c.checked = savedPersonas.includes(c.value);
  });
  
  const useCustom = localStorage.getItem('ollama_use_custom') === 'true';
  el('chk-custom-persona').checked = useCustom;
  toggleCustomArea();
}

function applyLayout(){
  const layout = localStorage.getItem('ollama_layout') || 'normal';
  const wrapper = el('messages');
  if(layout === 'flipped'){
    wrapper.classList.add('layout-flipped');
  } else {
    wrapper.classList.remove('layout-flipped');
  }
}

function applyAccent(){
  const accent = localStorage.getItem('ollama_accent');
  if(accent){
    document.documentElement.style.setProperty('--accent', accent);
  }
}

// -------------------- AUTH LOGIC --------------------
async function checkAuth(){
  const r = await fetch('/me');
  const user = await r.json();
  const container = el('auth-area');
  
  if(user){
    // Logged in
    container.innerHTML = `
      <div class="user-profile" onclick="toggleUserMenu()" style="position:relative; cursor:pointer; display:flex; align-items:center; gap:8px;">
        <img src="${user.picture}" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border-dark);">
        <span style="font-size:14px; color:var(--text-primary);">${user.name}</span>
        <div id="user-menu" style="display:none; position:absolute; top:40px; right:0; background:var(--panel-dark); border:1px solid var(--border-dark); border-radius:8px; padding:8px; min-width:120px; z-index:100; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
           <button onclick="logout()" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">Sair</button>
        </div>
      </div>
    `;
    closeLogin(); // Close modal if open
  } else {
    // Not logged in
    container.innerHTML = `
      <button onclick="openLogin()">➕ Criar Conta</button>
      <button onclick="openLogin()">Entrar</button>
    `;
  }
}

function toggleUserMenu(){
    const m = el('user-menu');
    if(m) m.style.display = m.style.display === 'block' ? 'none' : 'block';
}

async function logout(){
  await fetch('/logout', { method:'POST' });
  checkAuth();
}

// Local Auth
async function localRegister(){
    const email = el('login-email').value;
    const password = el('login-password').value;
    const name = email.split('@')[0]; // Simple name inference
    const msg = el('login-msg');
    
    if(!email || !password) {
        msg.textContent = "⚠️ Preencha email e senha!";
        return;
    }
    
    msg.textContent = "⏳ Criando conta...";
    msg.style.color = "var(--text-secondary)";
    
    try {
        const r = await fetch('/auth/register', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email, password, name })
        });
        
        const d = await r.json();
        if(d.error) {
            msg.textContent = "❌ " + d.error;
            msg.style.color = "#e91e63";
        } else {
            msg.textContent = "✅ Sucesso! Entrando...";
            msg.style.color = "#10a37f";
            setTimeout(() => checkAuth(), 1000);
        }
    } catch(e) {
        msg.textContent = "❌ Erro de conexão";
        console.error(e);
    }
}

async function localLogin(){
    const email = el('login-email').value;
    const password = el('login-password').value;
    const msg = el('login-msg');
    
    if(!email || !password) {
        msg.textContent = "⚠️ Preencha email e senha!";
        return;
    }
    
    msg.textContent = "⏳ Entrando...";
    msg.style.color = "var(--text-secondary)";
    
    try {
        const r = await fetch('/auth/login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email, password })
        });
        
        const d = await r.json();
        if(d.error) {
            msg.textContent = "❌ " + d.error;
            msg.style.color = "#e91e63";
        } else {
            msg.textContent = "✅ Bem-vindo!";
            msg.style.color = "#10a37f";
            setTimeout(() => checkAuth(), 1000);
        }
    } catch(e) {
        msg.textContent = "❌ Erro de conexão";
        console.error(e);
    }
}

function openLogin(){
  el('login-modal').style.display = 'block'; 
  el('login-msg').textContent = '';
  // Google button rendering is handled by the script tag in HTML, but we might want to check
  // if(!googleClientId) ... (logic remains similar but now we have local option)
}
function closeLogin(){ el('login-modal').style.display = 'none'; }

// -------------------- CHAT RENDER --------------------
function appendMessage(who, text, index = null){
  const wrapper = el('messages');
  const msg = document.createElement('div');
  msg.className = `message ${who}`;
  
  // Markdown parsing for Bot, Plain text for User (safe)
  if(who === 'bot' && window.marked) {
    msg.innerHTML = marked.parse(text);
    
    // Syntax Highlight
    if(window.hljs) {
      msg.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }

    // Code Copy Buttons (Independent of hljs)
    msg.querySelectorAll('pre').forEach(pre => {
      // Avoid double buttons
      if(pre.querySelector('.code-copy-btn')) return;
      
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.innerHTML = '📋'; // Icon only
      btn.title = 'Copiar Código';
      
      btn.onclick = (e) => {
         e.stopPropagation();
         const code = pre.querySelector('code');
         // Fallback: if no code tag, use pre text
         const textToCopy = code ? code.textContent : pre.textContent;
         
         navigator.clipboard.writeText(textToCopy).then(()=>{
           const original = btn.innerHTML;
           btn.innerHTML = '✅';
           setTimeout(()=> btn.innerHTML = original, 2000);
         });
      };
      
      pre.appendChild(btn);
    });
  } else {
    msg.textContent = text;
  }
  
  // Action Buttons Wrapper
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  if(who === 'user'){
    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title = 'Editar Mensagem';
    btnEdit.onclick = () => editMessage(index, text);
    actions.appendChild(btnEdit);
  } else {
    // Bot actions: Copy, Print, PDF
    
    // Copy
    const btnCopy = document.createElement('button');
    btnCopy.textContent = '📋';
    btnCopy.title = 'Copiar Resposta';
    btnCopy.onclick = () => copyText(text);
    actions.appendChild(btnCopy);

    // Print
    const btnPrint = document.createElement('button');
    btnPrint.textContent = '🖨️';
    btnPrint.title = 'Imprimir Resposta';
    
    // We need to pass clean HTML without the buttons
    btnPrint.onclick = () => {
        const clone = msg.cloneNode(true);
        const acts = clone.querySelector('.msg-actions');
        if(acts) acts.remove();
        printMessage(clone.innerHTML);
    }; 
    actions.appendChild(btnPrint);

    // PDF
    const btnPDF = document.createElement('button');
    btnPDF.textContent = '📄';
    btnPDF.title = 'Gerar PDF';
    btnPDF.onclick = () => saveAsPDF(msg);
    actions.appendChild(btnPDF);
  }
  
  msg.appendChild(actions);
  wrapper.appendChild(msg);
  wrapper.scrollTop = wrapper.scrollHeight;
}

function copyText(text){
  navigator.clipboard.writeText(text).then(()=>alert('Copiado!'));
}

function printMessage(htmlContent){
  const win = window.open('', '', 'height=600,width=800');
  win.document.write('<html><head><title>Imprimir Resposta</title>');
  // Include basic styles for readability
  win.document.write('<style>body{font-family:sans-serif; padding:20px; line-height:1.6;} code{background:#eee; padding:2px 4px; border-radius:4px;} pre{background:#f4f4f4; padding:10px; overflow-x:auto;}</style>');
  win.document.write('</head><body>');
  win.document.write(htmlContent);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  // Delay slightly to ensure render
  setTimeout(() => { win.print(); win.close(); }, 250);
}

function saveAsPDF(element){
  if(!window.html2pdf) return alert('Biblioteca PDF não carregada.');
  // Clone element to remove actions buttons if present (though they are usually outside the content flow we want, wait, they are IN the message div)
  // The element passed is `msg` which includes `.msg-actions`. We should clone and remove actions.
  const clone = element.cloneNode(true);
  const actions = clone.querySelector('.msg-actions');
  if(actions) actions.remove();
  
  // Style for PDF
  clone.style.background = 'white';
  clone.style.color = 'black';
  clone.style.padding = '20px';
  
  const opt = {
    margin:       10,
    filename:     'resposta-ollama.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(clone).save();
}

function editMessage(index, oldText){
  const input = el('input');
  input.value = oldText;
  input.focus();
  // Truncate history
  chatHistory = chatHistory.slice(0, index);
  renderMessages();
}

function renderMessages(){
  const wrapper = el('messages');
  wrapper.innerHTML = '';
  chatHistory.forEach((m, i) => appendMessage(m.who, m.text, i));
}

function showSpinner(){
  const wrapper = el('messages');
  const sp = document.createElement('div');
  sp.className = 'spinner';
  sp.id = 'spinner';
  sp.textContent = 'Gerando resposta...';
  wrapper.appendChild(sp);
  wrapper.scrollTop = wrapper.scrollHeight;
}

function hideSpinner(){
  const sp = document.getElementById('spinner');
  if(sp) sp.remove();
}

// -------------------- DATA & LOGIC --------------------
function saveCurrent(title){
  const body = { messages: chatHistory, type: convoType };
  if(title) body.title = title;
  
  fetch(`/conversation/${currentConvo}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
}

async function loadConversations(){
  try{
    const r = await fetch('/conversations');
    const list = await r.json();
    
    const ulChat = el('convo-list');
    const ulProj = el('project-list');
    ulChat.innerHTML = '';
    ulProj.innerHTML = '';
    
    list.forEach(item => {
      const li = document.createElement('li');
      li.dataset.name = item.name;
      li.className = currentConvo === item.name ? 'active' : '';
      
      // Format display name for legacy/raw projects
    let displayName = item.title || item.name;
    if((!item.title || item.title === item.name) && item.name.startsWith('proj_')){
       // proj_nome_do_projeto_timestamp
       const clean = item.name.replace(/^proj_/, '').replace(/_\d+$/, '').replace(/_/g, ' ');
       // Capitalize
       displayName = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    const spanName = document.createElement('span');
    spanName.textContent = displayName;
    // spanName.onclick = () => loadConversation(item.name); // Moved to li
    spanName.style.flex = "1";
    spanName.title = item.name; // Tooltip with real ID
      
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      // Make actions visible if active
      if(currentConvo === item.name) actions.style.opacity = '1';
      
      const btnEdit = document.createElement('button');
      btnEdit.textContent = '✏️';
      btnEdit.title = "Renomear";
      
      // Strict check for project type or prefix
      const isProject = item.type === 'project' || item.name.startsWith('proj_');
      
      if(!isProject) btnEdit.style.display = 'none';
      btnEdit.onclick = (e) => { e.stopPropagation(); renameConversation(item.name, item.title); };
      
      const btnDel = document.createElement('button');
      btnDel.textContent = '🗑️';
      btnDel.title = "Excluir";
      btnDel.onclick = (e) => { e.stopPropagation(); deleteConversation(item.name); };
      
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      
      li.appendChild(spanName);
      li.appendChild(actions);
      
      // Click on row loads conversation
      li.onclick = () => loadConversation(item.name);
      
      if(isProject) ulProj.appendChild(li);
      else ulChat.appendChild(li);
    });
  }catch(e){ console.error(e); }
}

async function loadConversation(name){
  currentConvo = name;
  
  // Instant visual feedback before fetch
  const allLis = document.querySelectorAll('#convo-list li, #project-list li');
  allLis.forEach(li => {
      // Basic check against tooltip or similar since we don't have item ref here easily
      // But we can check text content or better, rely on standard reload or specific class toggle if we found it.
      // Actually, just let loadConversations handle it, OR force reload:
      li.classList.remove('active');
  });
  const currentLi = document.querySelector(`#convo-list li[data-name="${name}"], #project-list li[data-name="${name}"]`);
  if(currentLi) currentLi.classList.add('active');
  
  const r = await fetch(`/conversation/${name}`);
  if(!r.ok){ alert('Conversa não encontrada'); return; }
  const data = await r.json();
  
  if(Array.isArray(data)){
    chatHistory = data;
    convoType = 'chat';
  } else {
    chatHistory = data.messages || [];
    convoType = data.type || 'chat';
  }
  
  renderMessages();
  updateChatHeader(data.title || name);
  loadConversations(); // This will re-apply 'active' class correctly
}

async function deleteConversation(name){
  if(!confirm("Tem certeza que deseja excluir?")) return;
  await fetch(`/conversation/${name}`, { method: 'DELETE' });
  if(currentConvo === name) newChat();
  else loadConversations();
}

async function renameConversation(name, oldTitle){
  const newTitle = prompt("Novo nome:", oldTitle || name);
  if(!newTitle) return;
  await fetch(`/conversation/${name}/rename`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ title: newTitle })
  });
  loadConversations();
  if(name === currentConvo) updateChatHeader(newTitle);
}

function newChat(){
  currentConvo = `chat_${Date.now()}`;
  convoType = 'chat';
  chatHistory = [];
  renderMessages();
  saveCurrent("Nova Conversa"); // Default title
  updateChatHeader("Nova Conversa", true);
  loadConversations();
}

function newProject(){
  const name = prompt("Nome do Projeto:");
  if(!name) return;
  currentConvo = `proj_${name.replace(/\s+/g,'_').toLowerCase()}_${Date.now()}`;
  convoType = 'project';
  chatHistory = [];
  renderMessages();
  saveCurrent(name);
  updateChatHeader(name);
  loadConversations();
}

// -------------------- SYSTEM PROMPT --------------------
function getSystemPrompt(){
  const lang = localStorage.getItem('ollama_lang') || 'pt';
  const personas = JSON.parse(localStorage.getItem('ollama_personas') || '[]');
  const useCustom = localStorage.getItem('ollama_use_custom') === 'true';
  const custom = localStorage.getItem('ollama_custom') || '';
  
  const personaDefs = {
    serious: "Seja extremamente formal e profissional.",
    fun: "Seja divertido e faça piadas.",
    gossipy: "Aja como alguém fofoqueiro, usando gírias.",
    teacher: "Aja como um professor didático.",
    objective: "Seja direto e sem enrolação.",
    welcoming: "Seja acolhedor e gentil.",
    enthusiastic: "Demonstre muito entusiasmo!",
    sarcastic: "Seja sarcástico e irônico.",
    default: "Seja prestativo e direto."
  };
  
  let p = `Language: ${lang === 'pt' ? 'Portuguese' : 'English'}.\n`;
  
  if(personas.length > 0){
    p += "Combine these personality traits:\n";
    personas.forEach(k => { if(personaDefs[k]) p += `- ${personaDefs[k]}\n`; });
  } else {
    p += "Personality: Helpful and direct.\n";
  }
  
  if(useCustom && custom) p += `\nCustom Instructions:\n${custom}\n`;
  
  return p;
}

// -------------------- SEND & AUTO-TITLE --------------------
async function sendMessage(){
  const input = el('input');
  const modelSel = el('model');
  const text = input.value.trim();
  if(!text) return;

  chatHistory.push({ who:'user', text });
  renderMessages();
  input.value = '';
  input.style.height = 'auto'; // Reset height
  saveCurrent();

  showSpinner();
  try{
    const system = getSystemPrompt();
    const useMemory = localStorage.getItem('ollama_learning') === 'true';
    
    const r = await fetch('/ollama',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ 
        prompt: text, 
        history: chatHistory.slice(0, -1),
        model: modelSel.value, 
        system,
        useMemory
      })
    });
    const d = await r.json();
    hideSpinner();
    if(d && d.result){
      chatHistory.push({ who:'bot', text: d.result });
      renderMessages();
      saveCurrent();
      
      // Post-processing: Learning & Auto-Title
      if(useMemory) learnFromUser(text);
      if(chatHistory.length === 2 && convoType === 'chat') generateAutoTitle();
      
    } else {
      appendMessage('bot','[Erro: resposta vazia]');
    }
  }catch(e){
    hideSpinner();
    appendMessage('bot',`[Erro] ${e.message}`);
  }
}

async function learnFromUser(text){
  // Fire and forget
  fetch('/memory/learn', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ text })
  }).catch(e=>console.error("Learning error", e));
}

async function generateAutoTitle(){
  // Generate title based on first user message
  const firstMsg = chatHistory[0].text;
  try{
    const r = await fetch('/ollama', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        prompt: `Analyze the language of the following message. Generate a very short title (max 4 words) in THAT SAME LANGUAGE (Portuguese or English). Return ONLY the title. Message: "${firstMsg}"`,
        model: "llama3.2:3b",
        stream: false
      })
    });
    const d = await r.json();
    if(d.result){
      let newTitle = d.result.replace(/["']/g, "").trim();
      saveCurrent(newTitle);
      updateChatHeader(newTitle);
      loadConversations();
    }
  }catch(e){ console.error("Auto title failed", e); }
}

// -------------------- OLLAMA CHECK --------------------
async function checkOllama(){
  const statusEl = el('ollama-status');
  try{
    const r = await fetch('/check-ollama');
    const d = await r.json();
    if(d.ok){
      statusEl.textContent = '🟢 Online';
      statusEl.title = 'Conectado com sucesso';
      statusEl.className = 'ok';
    } else {
      statusEl.textContent = '🔴 Offline';
      statusEl.className = '';
    }
  }catch{
    statusEl.textContent = '🔴 Offline';
  }
}

// -------------------- GOOGLE & AUTH --------------------
let googleClientId = '';
let currentUser = null;

function updateUserUI(){
  const container = document.getElementById('auth-area');
  if(!container) return;
  
  if(currentUser){
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer; position:relative;" onclick="toggleUserMenu()">
         <img src="${currentUser.picture}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">
         <span style="font-size:14px; font-weight:600;">${currentUser.name}</span>
         <div id="user-menu" style="display:none; position:absolute; top:40px; right:0; background:var(--panel-dark); border:1px solid var(--border-dark); padding:8px; border-radius:8px; z-index:100; min-width:150px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
            <button onclick="logout()" style="width:100%; text-align:left; background:transparent; border:none; color:var(--text-primary); cursor:pointer; padding:8px;">❌ Desconectar</button>
         </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openLogin()">➕ Criar Conta</button>
      <button onclick="openLogin()">Entrar</button>
    `;
  }
}

function toggleUserMenu(){
  const menu = document.getElementById('user-menu');
  if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function initGoogle(){
  const btn = document.getElementById('googleBtn');
  if(!btn) return;

  if(!googleClientId || googleClientId === 'seu_client_id_aqui'){
      // Fake Google Button (Placeholder)
      btn.innerHTML = `
      <div onclick="alert('O login com Google não foi configurado pelo administrador do sistema.\\n\\nPor favor, utilize a opção de Email e Senha acima para entrar ou criar sua conta.')" 
           style="min-width:250px; height:40px; cursor:pointer; background:#131314; color:#e3e3e3; border:1px solid #747775; border-radius:20px; display:flex; align-items:center; justify-content:center; gap:10px; font-family:Roboto, sans-serif; font-weight:500; font-size:14px; user-select:none;">
           <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
           Sign in with Google
      </div>
    `;
    return;
  }
  
  if(!window.google) return;
  
  try {
      google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
      google.accounts.id.renderButton(btn, { theme:'filled_black', size:'large', shape:'pill', text:'signin_with', width: '250' });
  } catch(e) {
      console.error("Google Init Error:", e);
      btn.textContent = "Erro ao carregar Google Login";
  }
}

async function handleGoogleCredential(response){
  try{
    const r = await fetch('/auth/google',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id_token: response.credential }) });
    if(!r.ok) throw new Error('Falha na autenticação');
    currentUser = await r.json();
    updateUserUI();
    closeLogin();
  }catch(e){ alert(e.message); }
}

async function logout(){
  await fetch('/logout',{ method:'POST' });
  currentUser = null;
  updateUserUI();
}

// -------------------- INIT --------------------
document.addEventListener('DOMContentLoaded', ()=>{
  const input = el('input');
  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendMessage();
     }
   });

   input.addEventListener('input', function(){
     this.style.height = 'auto';
     this.style.height = (this.scrollHeight) + 'px';
   });
   
   if(window.hljs && hljs.highlightAll) {
     hljs.highlightAll();
   }
   
   loadConversations();
  checkOllama();
  applyLayout();
  applyAccent();
  restoreProjectToggle();
  
  fetch('/config').then(r=>r.json()).then(cfg=>{ googleClientId = cfg.googleClientId||''; initGoogle(); });
  fetch('/me').then(r=>r.json()).then(u=>{ currentUser = u; updateUserUI(); });

  // Auto-hide sidebar on mobile
  if(window.innerWidth <= 768) {
      el('sidebar').classList.add('hidden');
  }
});
