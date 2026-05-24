/* ══════════════════════════════════════════════════════════════
   LifeOS · app.js  — Fixed version
   Reads user from sessionStorage at the very top.
   Passes user_id in every API call.
══════════════════════════════════════════════════════════════ */
console.log("PAGE LOADED", Date.now())
// ── Auth guard — must be FIRST before anything else ─────────────
const _userRaw = sessionStorage.getItem("lifeos_user")

if (!_userRaw || _userRaw === "undefined") {
  console.error("User not found in sessionStorage")
  window.location.href = "/login.html"
}

const currentUser = JSON.parse(_userRaw) // { id, name, email }
const UID = currentUser.id

// ── In-memory state ──────────────────────────────────────────────
let tasks        = []
let habits       = []
let moodLog      = []
let currentMood  = null
let waterData    = {}
let waterGoal    = 8
let sleepLog     = []
let fitnessLog   = []
let nutritionLog = []
let dsaLog       = []
let dsaTopics    = []
let goals        = []
let selectedDate =
  new Date()
    .toISOString()
    .split("T")[0]
// ── Helpers ──────────────────────────────────────────────────────
const today   = () => new Date().toISOString().split("T")[0]
const esc     = s  => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
const fmtDate = d  => { if(!d) return "—"; const x=new Date(d+"T00:00:00"); return x.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) }

function toast(msg, dur=2600) {
  const t = document.getElementById("toast")
  t.textContent = msg; t.classList.add("show")
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove("show"), dur)
}

// ── API wrapper — all calls go through here ──────────────────────
const BASE = window.location.origin// same origin, Express serves frontend too

async function api(method, path, body=null) {
  const opts = { method, headers:{"Content-Type":"application/json"} }
  if (body) opts.body = JSON.stringify(body)
  const res  = await fetch(BASE + path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Request failed")
  return data
}

// ── Chart helpers ────────────────────────────────────────────────
const _ch = {}
function mkChart(id, cfg) {
  if (_ch[id]) _ch[id].destroy()
  const el = document.getElementById(id); if (!el) return
  _ch[id] = new Chart(el, cfg); return _ch[id]
}
const COPTS = {
  responsive:true, maintainAspectRatio:true,
  plugins:{ legend:{display:false}, tooltip:{backgroundColor:"rgba(255,248,242,0.97)",titleColor:"#3D2B1F",bodyColor:"#7A6055",borderColor:"rgba(220,190,170,0.4)",borderWidth:1,padding:10,cornerRadius:10} },
  scales:{
    x:{ grid:{color:"rgba(200,180,160,0.08)"}, ticks:{color:"#B09890",font:{family:"'Quicksand',sans-serif",size:11}} },
    y:{ grid:{color:"rgba(200,180,160,0.08)"}, ticks:{color:"#B09890",font:{family:"'Quicksand',sans-serif",size:11}} }
  }
}
function grad(ctx,c1,c2){ const g=ctx.createLinearGradient(0,0,0,200); g.addColorStop(0,c1); g.addColorStop(1,c2); return g }
function last7Labels(){ return Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toLocaleDateString("en-US",{weekday:"short"}) }) }
function last7Dates(){  return Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split("T")[0] }) }

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════
let initialized = false;

window.onload = async () => {
  if (initialized) return;
  initialized = true;
  try {
    // Populate user info in sidebar — currentUser already set above
    document.getElementById("user-avatar").textContent     = currentUser.name[0].toUpperCase()
    document.getElementById("user-name-disp").textContent  = currentUser.name
    document.getElementById("user-email-disp").textContent = currentUser.email

    const h = new Date().getHours()
    const g = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening"
    document.getElementById("home-greeting").textContent = `${g}, ${currentUser.name} ✨`
    document.getElementById("home-date").textContent =
      new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}) +
      " · Here's your life at a glance"

    loadQuote()
    

    // Load all data from DB in parallel
    await Promise.allSettled([
      loadTasks(), loadHabits(), loadMood(),
      loadWater(), loadSleep(), loadFitness(),
      loadNutrition(), loadDSA(), loadGoals()
    ])


    renderAll()
    initCharts()

  } catch(err) {
    console.error("Init error:", err)
  }
}

function logout() {
  sessionStorage.removeItem("lifeos_user")
  window.location.href = "/login.html"
}

// ── Navigation ───────────────────────────────────────────────────
function nav(page, btn) {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"))
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"))
  document.getElementById("page-"+page).classList.add("active")
  if (btn) btn.classList.add("active")
  const refreshes = {
    home:      ()=>{ renderHomeStats(); renderHomeTasks(); renderHomeStreaks(); renderBalance(); initHomeChart() },
    tasks:     ()=>renderTasksPage(),
    habits:    ()=>{ renderHabits(); renderHeatmap(); initHabChart() },
    mood:      ()=>{ renderMoodGrid(); renderMoodCal(); initMoodChart() },
    water:     ()=>renderWaterPage(),
    sleep:     ()=>{ renderSleepPage(); initSleepChart() },
    fitness:   ()=>{ renderFitnessStats(); initFitnessChart() },
    nutrition: ()=>{ renderFoodStats(); initMacroChart() },
    dsa:       ()=>{ renderDSAStats(); renderDSATopics(); initDsaChart() },
    goals:     ()=>{ renderGoalsGrid(); renderGoalsStats(); initGoalsChart() }
  }
  if (refreshes[page]) refreshes[page]()
}

function renderAll() {
  renderHomeStats(); renderHomeTasks(); renderHomeStreaks(); renderBalance()
  renderTasksPage()
  renderHabits(); renderHeatmap()
  renderMoodGrid(); renderMoodCal()
  renderWaterHome()
  renderSleepHome()
  renderFitnessStats()
  renderFoodStats()
  renderDSAStats(); renderDSATopics()
  renderGoalsGrid(); renderGoalsStats()
}

// ── Quotes ───────────────────────────────────────────────────────
const QUOTES = [
  {q:"Small daily improvements are the key to staggering long-term results.",a:"Robin Sharma"},
  {q:"The secret of getting ahead is getting started.",a:"Mark Twain"},
  {q:"Success is the sum of small efforts repeated day in and day out.",a:"Robert Collier"},
  {q:"Discipline is the bridge between goals and accomplishment.",a:"Jim Rohn"},
  {q:"You don't have to be great to start, but you have to start to be great.",a:"Zig Ziglar"},
  {q:"What you do every day matters more than what you do once in a while.",a:"Gretchen Rubin"},
  {q:"Believe you can and you're halfway there.",a:"Theodore Roosevelt"},
]
function loadQuote() {
  const q = QUOTES[new Date().getDay()%QUOTES.length]
  document.getElementById("quote-text").textContent  = `"${q.q}"`
  document.getElementById("quote-author").textContent= `— ${q.a}`
}

// ════════════════════════════════════════════════════════════════
//  TASKS  — all routes use UID
// ════════════════════════════════════════════════════════════════
async function loadTasks() {
  tasks = await api("GET", `/api/tasks/${UID}`) || []
}
function appendTaskToUI(t) {
  const list = document.getElementById("tasks-full-list")
  const homeList = document.getElementById("home-tasks-list")

  const priC = { high:"rgba(255,200,200,0.5)", med:"rgba(255,240,180,0.5)", low:"rgba(200,240,200,0.5)" }
  const priL = { high:"🔴 High", med:"🟡 Med", low:"🟢 Low" }

  // Add to full task list — remove empty state first
  if (list) {
    const empty = list.querySelector(".empty-state")
    if (empty) empty.remove()

    const div = document.createElement("div")
    div.id = "task-item-" + t.id
    div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:${priC[t.priority]||priC.med};margin-bottom:6px`
    div.innerHTML = `
      <div class="hcheck" onclick="toggleTask(${t.id})">✓</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${esc(t.title)}</div>
        <div style="font-size:11px;color:var(--textmuted);margin-top:2px">
          ${t.category ? `<span style="margin-right:8px">📁 ${esc(t.category)}</span>` : ""}
          ${t.due_date  ? `<span>📅 ${fmtDate(t.due_date)}</span>` : ""}
        </div>
      </div>
      <span style="font-size:11px;font-weight:600;color:var(--textmuted)">${priL[t.priority]||""}</span>
      <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">✕</button>
    `
    list.prepend(div)
  }

  // Add to home preview (only if under 5 pending shown)
  if (homeList) {
    const empty = homeList.querySelector(".empty-state")
    if (empty) empty.remove()

    const pending = tasks.filter(x => !x.done)
    if (pending.length <= 5) {
      const div = document.createElement("div")
      div.id = "home-task-" + t.id
      div.className = "habit-row"
      div.style.cursor = "pointer"
      div.onclick = () => toggleTask(t.id)
      div.innerHTML = `
        <div class="hcheck">✓</div>
        <span style="flex:1;font-size:13px;font-weight:500">${esc(t.title)}</span>
        ${t.priority === "high" ? '<span style="font-size:10px;color:#c4607a;font-weight:700">HIGH</span>' : ""}
      `
      homeList.prepend(div)
    }
  }

  // Update counters directly — no re-render
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  set("task-total-v",   tasks.length)
  set("task-pending-v", tasks.filter(t => !t.done).length)
  set("task-rate-v",    tasks.length ? Math.round(tasks.filter(t=>t.done).length / tasks.length * 100) + "%" : "0%")
}

console.log("addTask called")
async function addTask() {
  const titleEl = document.getElementById("task-title-inp")
  const title = titleEl.value.trim()

  if (!title) {
    toast("Please enter a task title.")
    return
  }

  try {
    const t = await api("POST", "/api/tasks", {
  user_id: UID,
  title,
  priority: document.getElementById("task-pri-inp").value,
  category: document.getElementById("task-cat-inp").value.trim(),
  due_date: document.getElementById("task-due-inp").value,
  log_date: selectedDate
})

    tasks.unshift(t)

    // ✅ ONLY ADD NEW ELEMENT (NO FULL RENDER)
    appendTaskToUI(t)

    titleEl.value = ""
    document.getElementById("task-cat-inp").value = ""
    document.getElementById("task-due-inp").value = ""

    toast("Task added! ✅")

  } catch (e) {
    toast("Error: " + e.message)
  }
}
async function quickAddTask() {

  const inp =
    document.getElementById(
      "quick-task-inp"
    )

  const title =
    inp.value.trim()

  if (!title) return

  try {

    const t = await api(
      "POST",
      "/api/tasks",
      {
        user_id: UID,
        title,
        priority: "med",
        log_date: selectedDate
      }
    )

    tasks.unshift(t)

    inp.value = ""

    appendTaskToUI(t)

    toast("Task added! ✅")

  } catch(e) {

    toast("Error: " + e.message)
  }
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id); if (!task) return
  try {
    const updated = await api("PUT", `/api/tasks/${id}`, { done: !task.done })
    const idx = tasks.findIndex(t => t.id === id); if (idx !== -1) tasks[idx] = updated

    // Update existing DOM element directly — no re-render
    const el = document.getElementById("task-item-" + id)
    if (el) {
      const textDiv = el.querySelector("div > div:first-child")
      if (textDiv) textDiv.style.cssText = updated.done ? "font-size:13px;font-weight:600;text-decoration:line-through;color:var(--textlight)" : "font-size:13px;font-weight:600"
      const check = el.querySelector(".hcheck")
      if (check) check.className = "hcheck" + (updated.done ? " done" : "")
    }

    // Update home task
    const homeEl = document.getElementById("home-task-" + id)
    if (homeEl) {
      const check = homeEl.querySelector(".hcheck")
      if (check) check.className = "hcheck" + (updated.done ? " done" : "")
      const span = homeEl.querySelector("span")
      if (span) span.style.cssText = updated.done ? "flex:1;font-size:13px;font-weight:500;text-decoration:line-through;color:var(--textlight)" : "flex:1;font-size:13px;font-weight:500"
    }

    // Update counters
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
    const todayStr = today()

   const todayTasks =
  tasks.filter(
    t => t.log_date === selectedDate
  )

   const done = todayTasks.filter(t => t.done).length
   const total = todayTasks.length
   
    set("task-done-v",    done)
    set("task-pending-v", tasks.length - done)
    set("task-rate-v",    tasks.length ? Math.round(done / tasks.length * 100) + "%" : "0%")

  } catch(e) { toast("Error: " + e.message) }
}
async function deleteTask(id) {
  try {
    await api("DELETE", `/api/tasks/${id}`)
    tasks = tasks.filter(t => t.id !== id)

    // Remove elements directly — no re-render
    const el     = document.getElementById("task-item-" + id)
    const homeEl = document.getElementById("home-task-" + id)
    if (el)     el.remove()
    if (homeEl) homeEl.remove()

    // Update counters
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
    const done = tasks.filter(t => t.done).length
    set("task-total-v",   tasks.length)
    set("task-done-v",    done)
    set("task-pending-v", tasks.length - done)
    set("task-rate-v",    tasks.length ? Math.round(done / tasks.length * 100) + "%" : "0%")

    // Show empty state if no tasks left
    const list = document.getElementById("tasks-full-list")
    if (list && !tasks.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks found</p></div>`
    }

    toast("Task removed.")
  } catch(e) { toast("Error: " + e.message) }
}

function renderHomeTasks() {
  const el = document.getElementById("home-tasks-list"); if (!el) return
  const pending = tasks.filter(t=>!t.done).slice(0,5)
  if (!pending.length) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><p>No pending tasks</p></div>`; return }
  el.innerHTML = pending.map(t=>`
    <div class="habit-row" style="cursor:pointer" onclick="toggleTask(${t.id})">
      <div class="hcheck${t.done?" done":""}">✓</div>
      <span style="flex:1;font-size:13px;font-weight:500">${esc(t.title)}</span>
      ${t.priority==="high"?"<span style=\"font-size:10px;color:#c4607a;font-weight:700\">HIGH</span>":""}
    </div>`).join("")
}

function renderTasksPage() {
 const todayTasks =
  tasks.filter(
    t => t.log_date === selectedDate
  )

const total = todayTasks.length

const done =
  todayTasks.filter(
    t => t.done
  ).length 
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("task-total-v",total); set("task-done-v",done)
  set("task-pending-v",total-done); set("task-rate-v",total?Math.round(done/total*100)+"%":"0%")

  

let filtered = [...todayTasks]
  const sf=document.getElementById("task-filter")?.value||"all"
  const pf=document.getElementById("task-pri-filter")?.value||"all"
  if (sf==="pending") filtered=filtered.filter(t=>!t.done)
  if (sf==="done")    filtered=filtered.filter(t=>t.done)
  if (pf!=="all")     filtered=filtered.filter(t=>t.priority===pf)

  const priC={high:"rgba(255,200,200,0.5)",med:"rgba(255,240,180,0.5)",low:"rgba(200,240,200,0.5)"}
  const priL={high:"🔴 High",med:"🟡 Med",low:"🟢 Low"}
  const list=document.getElementById("tasks-full-list"); if (!list) return

  if (!filtered.length) {
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>No tasks found</p></div>`
    return
  }

  // Build HTML in memory first, then write once — single paint
  const html = filtered.map(t=>`
    <div id="task-item-${t.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:${priC[t.priority]||priC.med};margin-bottom:6px">
      <div class="hcheck${t.done?" done":""}" onclick="toggleTask(${t.id})">✓</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;${t.done?"text-decoration:line-through;color:var(--textlight)":""}">${esc(t.title)}</div>
        <div style="font-size:11px;color:var(--textmuted);margin-top:2px">
          ${t.category?`<span style="margin-right:8px">📁 ${esc(t.category)}</span>`:""}
          ${t.due_date?`<span>📅 ${fmtDate(t.due_date)}</span>`:""}
        </div>
      </div>
      <span style="font-size:11px;font-weight:600;color:var(--textmuted)">${priL[t.priority]||""}</span>
      <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">✕</button>
    </div>`).join("")

  // Write entire HTML in one operation = single browser paint = no flicker
  list.innerHTML = html
}

function renderHomeStats() {
  const el=document.getElementById("home-stats"); if (!el) return
  const todayTasks =
  tasks.filter(
    t => t.log_date === selectedDate
  )

const done =
  todayTasks.filter(
    t => t.done
  ).length

const total =
  todayTasks.length
  const habDone=habits.filter(h=>h.done).length
  const t=today(), waterToday=waterData[t]?.cups||0
  const lastSleep=sleepLog.length?sleepLog[0].duration:"—"
  el.innerHTML=`
    <div class="stat-card" style="background:linear-gradient(135deg,rgba(230,215,255,0.7),rgba(212,191,255,0.4))">
      <div class="stat-val" style="color:#6b4fbb">${habDone}/${habits.length}</div><div class="stat-label">Habits Done</div><div class="stat-sub">Today</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,rgba(255,214,232,0.7),rgba(240,184,208,0.4))">
      <div class="stat-val" style="color:#c4607a">${lastSleep}</div><div class="stat-label">Last Sleep</div><div class="stat-sub">Goal: 8h</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,rgba(200,240,224,0.7),rgba(160,220,190,0.4))">
      <div class="stat-val" style="color:#2a7a54">${waterToday}/${waterGoal}</div><div class="stat-label">Water Cups</div><div class="stat-sub">${Math.round(waterToday/waterGoal*100)}% of goal</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,rgba(245,230,218,0.7),rgba(232,213,192,0.4))">
      <div class="stat-val" style="color:#c47a35">${done}/${total}</div><div class="stat-label">Tasks Done</div><div class="stat-sub">Today's progress</div>
    </div>`
}

function renderBalance() {
  const el=document.getElementById("balance-bars"); if (!el) return
  const t=today()
  const done=tasks.filter(x=>x.done).length, total=tasks.length
  const habDone=habits.filter(h=>h.done).length, habTotal=habits.length
  const moodEntry=moodLog.find(m=>m.log_date===t)
  const waterToday=waterData[t]?.cups||0
  const bars=[
    {l:"Hydration",  v:Math.round(waterToday/waterGoal*100),                    c:"var(--sky)"},
    {l:"Tasks",      v:total?Math.round(done/total*100):0,                      c:"var(--pink)"},
    {l:"Habits",     v:habTotal?Math.round(habDone/habTotal*100):0,             c:"var(--lavender)"},
    {l:"DSA",        v:Math.min(100,dsaLog.filter(d=>d.log_date===t).length*20),c:"var(--mint)"},
    {l:"Mood",       v:moodEntry?Math.round((moodEntry.mood_index+1)/8*100):0,  c:"var(--peach)"},
    {l:"Nutrition",  v:Math.min(100,nutritionLog.filter(m=>m.log_date===t).length*25),c:"var(--rose)"},
  ]
  el.innerHTML=bars.map(b=>`
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${b.l}</span><span style="color:var(--textmuted)">${b.v}%</span></div>
      <div class="pb-wrap"><div class="pb" style="width:${b.v}%;background:${b.c}"></div></div>
    </div>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  HABITS
// ════════════════════════════════════════════════════════════════
async function loadHabits() {
  habits = await api("GET", `/api/habits/${UID}`) || []
  const t = today()
  habits.forEach(h => { if (h.last_done && h.last_done !== t) h.done = false })
}

async function addHabit() {
  const name=document.getElementById("hab-name").value.trim()
  if (!name) { toast("Please enter a habit name."); return }
  try {
    const h=await api("POST","/api/habits",{user_id:UID, name, icon:document.getElementById("hab-icon").value||"✨", category:document.getElementById("hab-cat").value})
    habits.push(h)
    document.getElementById("hab-name").value=""; document.getElementById("hab-icon").value=""
    renderHabits(); renderHeatmap(); initHabChart(); renderHomeStreaks(); toast("Habit added! ✨")
  } catch(e) { toast("Error: "+e.message) }
}

async function toggleHabit(id) {
  try {
    const updated=await api("PUT",`/api/habits/${id}/toggle`,{user_id:UID, date:today()})
    const idx=habits.findIndex(h=>h.id===id); if (idx!==-1) habits[idx]=updated
    renderHabits(); renderHeatmap(); renderHomeStreaks(); renderBalance(); initHabChart()
    if (updated.done) toast("Habit done! 🔥 Keep the streak going!")
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteHabit(id) {
  try {
    await api("DELETE",`/api/habits/${id}`)
    habits=habits.filter(h=>h.id!==id)
    renderHabits(); renderHeatmap(); initHabChart(); toast("Habit removed.")
  } catch(e) { toast("Error: "+e.message) }
}

function renderHabits() {
  const el=document.getElementById("habits-list"); if (!el) return
  if (!habits.length) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">🔥</div><p>No habits yet. Add your first above!</p></div>`; return }
  el.innerHTML=habits.map(h=>`
    <div class="habit-row">
      <div class="hcheck${h.done?" done":""}" onclick="toggleHabit(${h.id})">✓</div>
      <div style="flex:1">
        <div class="habit-name">${h.icon} ${esc(h.name)}</div>
        <div class="habit-streak">${h.category} · ${h.streak} day streak</div>
      </div>
      <span style="font-size:18px">${h.done?"🔥":"○"}</span>
      <button onclick="deleteHabit(${h.id})" style="background:none;border:none;cursor:pointer;color:var(--textlight);font-size:15px;margin-left:6px">×</button>
    </div>`).join("")
}

function renderHomeStreaks() {
  const el=document.getElementById("home-streaks"); if (!el) return
  const ws=habits.filter(h=>h.streak>0)
  if (!ws.length) { el.innerHTML=`<div class="empty-state"><div class="empty-icon">🔥</div><p>Start a habit to build streaks!</p></div>`; return }
  el.innerHTML=ws.map(h=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(220,190,170,0.15)">
      <span style="font-size:13px">${h.icon||"✨"} ${esc(h.name)}</span>
      <span class="streak-badge">🔥 ${h.streak} days</span>
    </div>`).join("")
}

function renderHeatmap() {
  const el=document.getElementById("hab-heat"); if (!el) return
  el.innerHTML=""
  for (let i=0;i<60;i++) {
    const d=new Date(); d.setDate(d.getDate()-(59-i))
    const ds=d.toISOString().split("T")[0]
    const active=habits.filter(h=>(h.log||[]).includes(ds)).length
    const ratio=habits.length>0?active/habits.length:0
    const c=document.createElement("div")
    c.className="hc"+(ratio>=1?" l4":ratio>0.5?" l3":ratio>0.25?" l2":ratio>0?" l1":"")
    c.title=ds+": "+active+"/"+habits.length+" habits"
    el.appendChild(c)
  }
}

// ════════════════════════════════════════════════════════════════
//  MOOD
// ════════════════════════════════════════════════════════════════
const MOODS=[
  {e:"😄",l:"Amazing"},{e:"😊",l:"Good"},{e:"😌",l:"Calm"},
  {e:"😐",l:"Neutral"},{e:"😔",l:"Sad"},{e:"😤",l:"Stressed"},
  {e:"😢",l:"Upset"},{e:"🤩",l:"Excited"}
]

async function loadMood() {
  moodLog = await api("GET",`/api/mood/${UID}`) || []
  const todayEntry=moodLog.find(m=>m.log_date===today())
  if (todayEntry) currentMood=todayEntry.mood_index
}

function renderMoodGrid() {
  const el=document.getElementById("mood-grid"); if (!el) return
  const todayEntry=moodLog.find(m=>m.log_date===today())
  if (todayEntry) {
    currentMood=todayEntry.mood_index
    const sel=document.getElementById("mood-selected")
    if (sel) sel.textContent=`Feeling: ${MOODS[todayEntry.mood_index].e} ${MOODS[todayEntry.mood_index].l}`
    const ji=document.getElementById("journal-inp"); const gi=document.getElementById("gratitude-inp")
    if (ji&&todayEntry.journal)   ji.value=todayEntry.journal
    if (gi&&todayEntry.gratitude) gi.value=todayEntry.gratitude
  }
  el.innerHTML=MOODS.map((m,i)=>`
    <button class="mood-btn${currentMood===i?" selected":""}" onclick="selectMood(${i})" title="${m.l}">${m.e}</button>`).join("")
}

function selectMood(i) {
  currentMood=i
  document.getElementById("mood-selected").textContent=`Feeling: ${MOODS[i].e} ${MOODS[i].l}`
  renderMoodGrid()
}

async function saveMood() {
  if (currentMood===null||currentMood===undefined) { toast("Please select a mood first 🌸"); return }
  const journal=document.getElementById("journal-inp").value
  const gratitude=document.getElementById("gratitude-inp").value
  try {
    const saved=await api("POST","/api/mood",{user_id:UID, log_date:today(), mood_index:currentMood, journal, gratitude})
    const idx=moodLog.findIndex(m=>m.log_date===today())
    if (idx>=0) moodLog[idx]=saved; else moodLog.unshift(saved)
    renderMoodCal(); initMoodChart(); renderBalance(); toast("Mood & journal saved! 🌸")
  } catch(e) { toast("Error: "+e.message) }
}

function renderMoodCal() {
  const el=document.getElementById("mood-cal"); if (!el) return
  el.innerHTML=""
  for (let i=89;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i)
    const ds=d.toISOString().split("T")[0]
    const entry=moodLog.find(m=>m.log_date===ds)
    const c=document.createElement("div")
    if (entry) { const v=entry.mood_index; c.className="hc"+(v<=1?" l4":v<=3?" l3":v<=5?" l2":" l1"); c.title=ds+": "+MOODS[v].l }
    else c.className="hc"
    el.appendChild(c)
  }
}

const AFFIRMATIONS=["I am worthy of love, success, and happiness. I choose joy today.","Every day I grow stronger, wiser, and more aligned with my purpose.","I attract abundance, health, and beautiful experiences effortlessly.","I am enough. I have enough. I do enough.","My potential is limitless and I am capable of achieving my dreams.","I choose peace over worry and gratitude over fear."]
function newAffirmation(){
  const el=document.getElementById("affirmation-text")
  el.style.opacity="0"
  setTimeout(()=>{el.textContent=AFFIRMATIONS[Math.floor(Math.random()*AFFIRMATIONS.length)];el.style.transition="opacity 0.5s";el.style.opacity="1"},300)
}

// ════════════════════════════════════════════════════════════════
//  WATER
// ════════════════════════════════════════════════════════════════
async function loadWater() {
  const rows=await api("GET",`/api/water/${UID}`) || []
  waterData={}
  rows.forEach(r=>{ waterData[r.log_date]={cups:r.cups,goal:r.goal} })
  const todayRow=waterData[today()]
  waterGoal=todayRow?.goal||8
}

async function saveWater() {
  const t=today(), cups=waterData[t]?.cups||0
  try {
    const saved=await api("POST","/api/water",{user_id:UID, log_date:t, cups, goal:waterGoal})
    waterData[t]={cups:saved.cups,goal:saved.goal}
  } catch(e) { console.error("Water save error:",e) }
}

async function waterDelta(n) {
  const t=today()
  if (!waterData[t]) waterData[t]={cups:0,goal:waterGoal}
  waterData[t].cups=Math.max(0,Math.min(waterGoal,(waterData[t].cups||0)+n))
  renderAllWater(); await saveWater(); renderBalance()
  if (waterData[t].cups===waterGoal) toast("Amazing! Water goal reached! 💧🎉")
}

function updateWaterGoal() {
  const g=parseInt(document.getElementById("water-goal-inp")?.value)||8
  waterGoal=Math.max(1,Math.min(20,g))
  const t=today()
  if (!waterData[t]) waterData[t]={cups:0,goal:waterGoal}
  waterData[t].goal=waterGoal
  renderAllWater(); saveWater()
}

function renderWaterGrid(gridId,countId,goalId,pbId) {
  const g=document.getElementById(gridId); if (!g) return
  const t=today(), cups=waterData[t]?.cups||0
  g.innerHTML=""
  for (let i=0;i<waterGoal;i++) {
    const d=document.createElement("div")
    d.className="drop"+(i<cups?" filled":""); d.innerHTML="💧"
    const idx=i
    d.onclick=()=>{ waterData[t]={cups:idx<cups?idx:idx+1,goal:waterGoal}; renderAllWater(); saveWater() }
    g.appendChild(d)
  }
  if (countId) document.getElementById(countId).textContent=cups
  if (goalId)  document.getElementById(goalId).textContent =waterGoal
  if (pbId)    document.getElementById(pbId).style.width   =Math.min(100,cups/waterGoal*100)+"%"
}

function renderWaterHome() { renderWaterGrid("home-water-grid","home-water-count","home-water-goal","home-water-pb") }
function renderAllWater()  { renderWaterGrid("home-water-grid","home-water-count","home-water-goal","home-water-pb"); renderWaterGrid("water-grid-full","water-count-full","water-goal-full","water-pb-full"); renderHomeStats() }
function renderWaterPage() {
  renderWaterGrid("water-grid-full","water-count-full","water-goal-full","water-pb-full")
  const gi=document.getElementById("water-goal-inp"); if (gi) gi.value=waterGoal
  renderWaterHistory()
}
function renderWaterHistory() {
  const el=document.getElementById("water-history"); if (!el) return
  el.innerHTML=last7Dates().map(d=>{
    const c=waterData[d]?.cups||0, g=waterData[d]?.goal||waterGoal
    const p=Math.min(100,c/g*100)
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(220,190,170,0.12)">
      <div style="width:72px;font-size:12px;color:var(--textmuted);font-weight:600;flex-shrink:0">${fmtDate(d).split(" ").slice(0,2).join(" ")}</div>
      <div style="flex:1;height:7px;background:rgba(200,175,155,0.15);border-radius:99px;overflow:hidden">
        <div style="width:${p}%;height:100%;background:linear-gradient(90deg,var(--sky),#6db8f8);border-radius:99px;transition:width 0.6s"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:var(--text);min-width:36px;text-align:right">${c}/${g}</span>
    </div>`
  }).join("")
}

// ════════════════════════════════════════════════════════════════
//  SLEEP
// ════════════════════════════════════════════════════════════════
async function loadSleep() {
  sleepLog = await api("GET",`/api/sleep/${UID}`) || []
}

function calcSleep() {
  const bed=document.getElementById("bedtime-inp")?.value
  const wake=document.getElementById("wake-inp")?.value
  if (!bed||!wake) return
  const [bh,bm]=bed.split(":").map(Number), [wh,wm]=wake.split(":").map(Number)
  let mins=(wh*60+wm)-(bh*60+bm); if (mins<0) mins+=1440
  document.getElementById("sleep-dur").textContent=Math.floor(mins/60)+"h "+mins%60+"m"
  document.getElementById("sleep-pb").style.width=Math.min(100,mins/480*100)+"%"
}

function restoreSleepInputs() {
  const entry=sleepLog.find(s=>s.log_date===today())||sleepLog[0]; if (!entry) return
  const bi=document.getElementById("bedtime-inp"), wi=document.getElementById("wake-inp")
  if (bi) bi.value=entry.bedtime||""
  if (wi) wi.value=entry.wake_time||""
  calcSleep()
}

async function logSleep() {
  const log_date=document.getElementById("sl-date")?.value
  const bedtime=document.getElementById("sl-bed")?.value
  const wake_time=document.getElementById("sl-wake")?.value
  if (!log_date||!bedtime||!wake_time) { toast("Please fill date, bedtime and wake time."); return }
  const [bh,bm]=bedtime.split(":").map(Number), [wh,wm]=wake_time.split(":").map(Number)
  let mins=(wh*60+wm)-(bh*60+bm); if (mins<0) mins+=1440
  const duration=Math.floor(mins/60)+"h "+mins%60+"m"
  const quality=parseInt(document.getElementById("sl-quality")?.value)||7
  const notes=document.getElementById("sl-notes")?.value.trim()||""
  try {
    const saved=await api("POST","/api/sleep",{user_id:UID, log_date, bedtime, wake_time, duration, mins, quality, notes})
    const idx=sleepLog.findIndex(s=>s.log_date===log_date)
    if (idx>=0) sleepLog[idx]=saved; else sleepLog.unshift(saved)
    if (document.getElementById("sl-notes")) document.getElementById("sl-notes").value=""
    renderSleepPage(); initSleepChart(); renderHomeStats(); toast("Sleep logged! 🌙")
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteSleep(id) {
  try {
    await api("DELETE",`/api/sleep/${id}`)
    sleepLog=sleepLog.filter(s=>s.id!==id)
    renderSleepPage(); initSleepChart()
  } catch(e) { toast("Error: "+e.message) }
}

function renderSleepHome() {
  const entry=sleepLog.find(s=>s.log_date===today())||sleepLog[0]; if (!entry) return
  const bi=document.getElementById("bedtime-inp"), wi=document.getElementById("wake-inp")
  if (bi) bi.value=entry.bedtime||""
  if (wi) wi.value=entry.wake_time||""
  calcSleep()
}

function renderSleepPage() {
  const avg=sleepLog.length?(sleepLog.reduce((s,e)=>s+e.mins,0)/sleepLog.length/60).toFixed(1):"—"
  const best=sleepLog.length?(Math.max(...sleepLog.map(e=>e.mins))/60).toFixed(1):"—"
  const avgQ=sleepLog.length?(sleepLog.reduce((s,e)=>s+e.quality,0)/sleepLog.length).toFixed(1):"—"
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("sl-avg-v",avg!=="—"?avg+"h":"—"); set("sl-best-v",best!=="—"?best+"h":"—")
  set("sl-quality-v",avgQ!=="—"?avgQ+"/10":"—"); set("sl-entries-v",sleepLog.length)
  const tbody=document.getElementById("sleep-log-body"); if (!tbody) return
  if (!sleepLog.length) { tbody.innerHTML='<tr><td colspan="6" style="color:var(--textmuted);padding:16px;text-align:center">No sleep entries yet.</td></tr>'; return }
  tbody.innerHTML=[...sleepLog].map(e=>`
    <tr>
      <td>${fmtDate(e.log_date)}</td><td>${e.bedtime||"—"}</td><td>${e.wake_time||"—"}</td>
      <td><strong>${e.duration}</strong></td>
      <td>${"⭐".repeat(Math.round((e.quality||5)/2))}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteSleep(${e.id})">✕</button></td>
    </tr>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  FITNESS
// ════════════════════════════════════════════════════════════════
async function loadFitness() {
  fitnessLog = await api("GET",`/api/fitness/${UID}`) || []
}

async function logWorkout() {
  const name=document.getElementById("w-name")?.value.trim()
  if (!name) { toast("Please enter a workout name."); return }
  try {
    const entry=await api("POST","/api/fitness",{
      user_id:UID, name, type:document.getElementById("w-type")?.value||"",
      duration:parseInt(document.getElementById("w-dur")?.value)||0,
      calories:parseInt(document.getElementById("w-kcal")?.value)||0,
      notes:document.getElementById("w-notes")?.value.trim()||"", log_date:today()
    })
    fitnessLog.unshift(entry)
    ;["w-name","w-dur","w-kcal","w-notes"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""})
    renderFitnessStats(); initFitnessChart(); toast("Workout logged! 💪")
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteWorkout(id) {
  try {
    await api("DELETE",`/api/fitness/${id}`)
    fitnessLog=fitnessLog.filter(f=>f.id!==id)
    renderFitnessStats(); initFitnessChart()
  } catch(e) { toast("Error: "+e.message) }
}

function renderFitnessStats() {
  let streak=0, d=new Date()
  while(true){ const ds=d.toISOString().split("T")[0]; if(fitnessLog.some(f=>f.log_date===ds)){streak++;d.setDate(d.getDate()-1)}else break }
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("fit-streak",streak); set("fit-total",fitnessLog.length)
  set("fit-time",fitnessLog.reduce((s,f)=>s+f.duration,0))
  set("fit-kcal",fitnessLog.reduce((s,f)=>s+f.calories,0))
  const tbody=document.getElementById("workout-log-body"); if (!tbody) return
  if (!fitnessLog.length) { tbody.innerHTML='<tr><td colspan="6" style="color:var(--textmuted);padding:16px;text-align:center">No workouts yet.</td></tr>'; return }
  tbody.innerHTML=fitnessLog.map(f=>`
    <tr>
      <td><strong>${esc(f.name)}</strong></td><td>${f.type}</td>
      <td>${f.duration?f.duration+" min":"—"}</td><td>${f.calories?f.calories+" kcal":"—"}</td>
      <td>${fmtDate(f.log_date)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteWorkout(${f.id})">✕</button></td>
    </tr>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  NUTRITION
// ════════════════════════════════════════════════════════════════
async function loadNutrition() {
  nutritionLog = await api("GET",`/api/nutrition/${UID}`) || []
}

async function logMeal() {
  const food=document.getElementById("meal-food")?.value.trim()
  if (!food) { toast("Please enter a food item."); return }
  try {
    const entry=await api("POST","/api/nutrition",{
      user_id:UID, meal_type:document.getElementById("meal-type")?.value||"", food,
      calories:parseFloat(document.getElementById("meal-cal")?.value)||0,
      protein:parseFloat(document.getElementById("meal-prot")?.value)||0,
      carbs:parseFloat(document.getElementById("meal-carbs")?.value)||0,
      fats:parseFloat(document.getElementById("meal-fats")?.value)||0, log_date:today()
    })
    nutritionLog.unshift(entry)
    ;["meal-food","meal-cal","meal-prot","meal-carbs","meal-fats"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""})
    renderFoodStats(); initMacroChart(); renderBalance(); toast("Meal logged! 🥗")
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteMeal(id) {
  try {
    await api("DELETE",`/api/nutrition/${id}`)
    nutritionLog=nutritionLog.filter(m=>m.id!==id)
    renderFoodStats(); initMacroChart(); renderBalance()
  } catch(e) { toast("Error: "+e.message) }
}

function renderFoodStats() {
  const t=today(), tm=nutritionLog.filter(m=>m.log_date===t)
  const cal=tm.reduce((s,m)=>s+m.calories,0), prot=tm.reduce((s,m)=>s+m.protein,0)
  const carbs=tm.reduce((s,m)=>s+m.carbs,0), fats=tm.reduce((s,m)=>s+m.fats,0)
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("f-cal",Math.round(cal).toLocaleString()); set("f-prot",Math.round(prot)+"g")
  set("f-carbs",Math.round(carbs)+"g"); set("f-fats",Math.round(fats)+"g")
  const tbody=document.getElementById("meal-log-body"); if (!tbody) return
  if (!nutritionLog.length) { tbody.innerHTML='<tr><td colspan="7" style="color:var(--textmuted);padding:16px;text-align:center">No meals logged yet.</td></tr>'; return }
  tbody.innerHTML=nutritionLog.map(m=>`
    <tr>
      <td>${m.meal_type}</td><td>${esc(m.food)}</td><td>${m.calories||0}</td>
      <td>${m.protein||0}g</td><td>${m.carbs||0}g</td><td>${m.fats||0}g</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteMeal(${m.id})">✕</button></td>
    </tr>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  DSA
// ════════════════════════════════════════════════════════════════
async function loadDSA() {
  const data=await api("GET",`/api/dsa/${UID}`)||{logs:[],topics:[]}
  dsaLog=data.logs; dsaTopics=data.topics
}

async function logDSA() {
  const name=document.getElementById("dsa-name")?.value.trim()
  if (!name) { toast("Please enter a problem name."); return }
  try {
    const entry=await api("POST","/api/dsa",{
      user_id:UID, name, topic:document.getElementById("dsa-topic")?.value||"",
      difficulty:document.getElementById("dsa-diff")?.value||"Medium",
      platform:document.getElementById("dsa-platform")?.value||"LeetCode",
      notes:document.getElementById("dsa-notes")?.value.trim()||"", log_date:today()
    })
    dsaLog.unshift(entry)
    ;["dsa-name","dsa-notes"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""})
    renderDSAStats(); initDsaChart(); renderBalance(); toast("Problem logged! 💻 Great work!")
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteDSA(id) {
  try {
    await api("DELETE",`/api/dsa/${id}`)
    dsaLog=dsaLog.filter(d=>d.id!==id)
    renderDSAStats(); initDsaChart()
  } catch(e) { toast("Error: "+e.message) }
}

async function cycleTopic(id, currentStatus) {
  const cycle={todo:"partial",partial:"done",done:"todo"}
  try {
    const updated=await api("PUT",`/api/dsa/topics/${id}`,{status:cycle[currentStatus]})
    const idx=dsaTopics.findIndex(t=>t.id===id); if (idx!==-1) dsaTopics[idx]=updated
    renderDSATopics()
  } catch(e) { toast("Error: "+e.message) }
}

function renderDSAStats() {
  const t=today()
  let streak=0, d=new Date()
  while(true){ const ds=d.toISOString().split("T")[0]; if(dsaLog.some(l=>l.log_date===ds)){streak++;d.setDate(d.getDate()-1)}else break }
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("dsa-total-v",dsaLog.length); set("dsa-streak-v",streak)
  set("dsa-today-v",dsaLog.filter(l=>l.log_date===t).length)
  set("dsa-hard-v",dsaLog.filter(l=>l.difficulty==="Hard").length)
  const tbody=document.getElementById("dsa-log-body"); if (!tbody) return
  if (!dsaLog.length) { tbody.innerHTML='<tr><td colspan="6" style="color:var(--textmuted);padding:16px;text-align:center">No problems logged yet.</td></tr>'; return }
  const cls={Easy:"diff-easy",Medium:"diff-med",Hard:"diff-hard"}
  tbody.innerHTML=dsaLog.map(l=>`
    <tr>
      <td><strong>${esc(l.name)}</strong></td><td>${l.topic}</td><td>${l.platform}</td>
      <td><span class="${cls[l.difficulty]||"diff-med"}">${l.difficulty}</span></td>
      <td>${fmtDate(l.log_date)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteDSA(${l.id})">✕</button></td>
    </tr>`).join("")
}

function renderDSATopics() {
  const el=document.getElementById("dsa-topics"); if (!el) return
  el.innerHTML=dsaTopics.map(t=>`
    <span class="chip chip-${t.status}" onclick="cycleTopic(${t.id},'${t.status}')" title="Click to update">${t.name}</span>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  GOALS
// ════════════════════════════════════════════════════════════════
async function loadGoals() {
  goals = await api("GET",`/api/goals/${UID}`) || []
}

async function addGoal() {
  const title=document.getElementById("goal-title")?.value.trim()
  if (!title) { toast("Please enter a goal title."); return }
  try {
    const g=await api("POST","/api/goals",{
      user_id:UID, title, emoji:document.getElementById("goal-emoji")?.value||"🌟",
      category:document.getElementById("goal-cat")?.value||"Personal",
      target_date:document.getElementById("goal-date")?.value||"",
      progress:parseInt(document.getElementById("goal-prog")?.value)||0
    })
    goals.unshift(g)
    ;["goal-title","goal-emoji","goal-prog"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""})
    renderGoalsGrid(); renderGoalsStats(); initGoalsChart(); toast("Goal added! 🌟")
  } catch(e) { toast("Error: "+e.message) }
}

async function updateGoalProg(id, val) {
  try {
    const updated=await api("PUT",`/api/goals/${id}`,{progress:parseInt(val)||0})
    const idx=goals.findIndex(g=>g.id===id); if (idx!==-1) goals[idx]=updated
    renderGoalsGrid(); renderGoalsStats(); initGoalsChart()
  } catch(e) { toast("Error: "+e.message) }
}

async function deleteGoal(id) {
  try {
    await api("DELETE",`/api/goals/${id}`)
    goals=goals.filter(g=>g.id!==id)
    renderGoalsGrid(); renderGoalsStats(); initGoalsChart()
  } catch(e) { toast("Error: "+e.message) }
}

function renderGoalsStats() {
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v}
  set("g-total-v",goals.length); set("g-done-v",goals.filter(g=>g.progress>=100).length)
  set("g-progress-v",goals.length?Math.round(goals.reduce((s,g)=>s+g.progress,0)/goals.length)+"%":"0%")
  set("g-active-v",goals.filter(g=>g.progress<100&&g.progress>0).length)
}

function renderGoalsGrid() {
  const el=document.getElementById("vision-grid"); if (!el) return
  if (!goals.length) { el.innerHTML='<div style="color:var(--textmuted);font-size:13px;padding:24px;text-align:center;grid-column:1/-1;background:var(--card-bg);border-radius:var(--r);border:1px solid var(--border)">No goals yet. Add your first goal above! 🌟</div>'; return }
  const bgs=["var(--lavender)","var(--pink)","var(--mint)","var(--beige)","var(--sky)","var(--peach)"]
  el.innerHTML=goals.map((g,i)=>`
    <div class="vision-card" style="background:${bgs[i%bgs.length]}">
      <div class="vision-emoji">${g.emoji}</div>
      <div class="vision-title">${esc(g.title)}</div>
      <div class="vision-prog">${g.category}${g.target_date?" · "+fmtDate(g.target_date):""}</div>
      <div class="pb-wrap" style="margin-top:10px"><div class="pb" style="width:${g.progress}%;background:rgba(100,80,60,0.25)"></div></div>
      <div style="font-size:12px;color:var(--textmuted);margin-top:6px">${g.progress}% complete</div>
      <div style="display:flex;gap:6px;justify-content:center;margin-top:10px;flex-wrap:wrap">
        <input type="number" min="0" max="100" value="${g.progress}" style="width:60px;padding:4px 8px;border-radius:8px;border:1px solid rgba(200,175,155,0.4);font-size:12px;font-family:inherit;background:rgba(255,255,255,0.6)" onchange="updateGoalProg(${g.id},this.value)" title="Update %"/>
        <button onclick="deleteGoal(${g.id})" style="background:rgba(255,255,255,0.5);border:1px solid rgba(200,175,155,0.4);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--textmuted)">✕</button>
      </div>
    </div>`).join("")
}

// ════════════════════════════════════════════════════════════════
//  CHARTS
// ════════════════════════════════════════════════════════════════
function initCharts() {
  setTimeout(()=>{
    initHomeChart(); initHabChart(); initMoodChart(); initSleepChart()
    initFitnessChart(); initMacroChart(); initDsaChart(); initGoalsChart()
    restoreSleepInputs()
    const slDate=document.getElementById("sl-date"); if(slDate) slDate.value=today()
  },150)
}

function initHomeChart() {
  const labels=last7Labels(), dates=last7Dates()
  const tasksByDay = dates.map(
  d =>
    tasks.filter(
      t =>
        t.done &&
        t.log_date === d
    ).length
)
  const moodByDay=dates.map(d=>{const e=moodLog.find(m=>m.log_date===d);return e?e.mood_index+1:null})
  mkChart("homeChart",{type:"bar",data:{labels,datasets:[
    {label:"Tasks Done",data:tasksByDay,backgroundColor:"rgba(230,215,255,0.75)",borderRadius:8,borderSkipped:false},
    {label:"Mood Score",data:moodByDay, backgroundColor:"rgba(255,214,232,0.75)",borderRadius:8,borderSkipped:false}
  ]},options:{...COPTS,plugins:{...COPTS.plugins,legend:{display:true,labels:{color:"#7A6055",font:{family:"'Quicksand',sans-serif",size:11}}}}}})
}

function initHabChart() {
  const cats=["Health","Fitness","Learning","Mindfulness","Productivity","Social"]
  const catData=cats.map(cat=>{
    const total=habits.filter(h=>h.category===cat).length
    const done=habits.filter(h=>h.category===cat&&h.done).length
    return total>0?Math.round(done/total*100):0
  })
  mkChart("habChart",{type:"polarArea",data:{labels:cats,datasets:[{data:catData.some(v=>v>0)?catData:[10,10,10,10,10,10],backgroundColor:["rgba(200,240,224,0.6)","rgba(255,214,232,0.6)","rgba(230,215,255,0.6)","rgba(200,224,255,0.6)","rgba(245,230,218,0.6)","rgba(255,220,200,0.6)"],borderWidth:1,borderColor:"rgba(255,255,255,0.5)"}]},
    options:{...COPTS,scales:{r:{grid:{color:"rgba(200,180,160,0.1)"},ticks:{display:false}}},plugins:{...COPTS.plugins,legend:{display:true,position:"bottom",labels:{color:"#7A6055",font:{family:"'Quicksand',sans-serif",size:11}}}}}})
}

function initMoodChart() {
  const el=document.getElementById("moodChart"); if(!el) return
  const ctx=el.getContext("2d"), labels=last7Labels(), dates=last7Dates()
  const moodByDay=dates.map(d=>{const e=moodLog.find(m=>m.log_date===d);return e?e.mood_index+1:null})
  mkChart("moodChart",{type:"line",data:{labels,datasets:[{data:moodByDay,borderColor:"rgba(240,184,208,0.9)",backgroundColor:grad(ctx,"rgba(240,184,208,0.3)","rgba(240,184,208,0)"),borderWidth:2.5,fill:true,tension:0.5,pointBackgroundColor:"rgba(240,184,208,1)",pointRadius:5,spanGaps:true}]},options:COPTS})
}

function initSleepChart() {
  const el=document.getElementById("sleepChart"); if(!el) return
  const ctx=el.getContext("2d"), labels=last7Labels(), dates=last7Dates()
  const sleepByDay=dates.map(d=>{const e=sleepLog.find(s=>s.log_date===d);return e?parseFloat((e.mins/60).toFixed(1)):null})
  mkChart("sleepChart",{type:"line",data:{labels,datasets:[{data:sleepByDay,borderColor:"rgba(230,215,255,0.9)",backgroundColor:grad(ctx,"rgba(230,215,255,0.35)","rgba(230,215,255,0)"),borderWidth:2.5,fill:true,tension:0.4,pointBackgroundColor:"rgba(212,191,255,1)",pointRadius:5,spanGaps:true}]},options:{...COPTS,scales:{...COPTS.scales,y:{...COPTS.scales.y,suggestedMin:0,suggestedMax:10}}}})
}

function initFitnessChart() {
  const el=document.getElementById("fitnessChart"); if(!el) return
  const ctx=el.getContext("2d"), labels=last7Labels(), dates=last7Dates()
  const kcalByDay=dates.map(d=>fitnessLog.filter(f=>f.log_date===d).reduce((s,f)=>s+f.calories,0))
  mkChart("fitnessChart",{type:"line",data:{labels,datasets:[{data:kcalByDay,borderColor:"rgba(200,240,224,0.9)",backgroundColor:grad(ctx,"rgba(200,240,224,0.4)","rgba(200,240,224,0)"),borderWidth:2,fill:true,tension:0.4,pointBackgroundColor:"rgba(100,200,150,0.9)",pointRadius:4}]},options:COPTS})
}

function initMacroChart() {
  const t=today(), tm=nutritionLog.filter(m=>m.log_date===t)
  const p=tm.reduce((s,m)=>s+m.protein,0), c=tm.reduce((s,m)=>s+m.carbs,0), f=tm.reduce((s,m)=>s+m.fats,0)
  mkChart("macroChart",{type:"doughnut",data:{labels:["Protein","Carbs","Fats"],datasets:[{data:p+c+f>0?[p,c,f]:[1,1,1],backgroundColor:["rgba(200,240,224,0.8)","rgba(200,224,255,0.8)","rgba(255,230,200,0.8)"],borderWidth:0,hoverOffset:4}]},
    options:{...COPTS,cutout:"65%",plugins:{...COPTS.plugins,legend:{display:true,position:"bottom",labels:{color:"#7A6055",font:{family:"'Quicksand',sans-serif",size:11}}}},scales:{}}})
}

function initDsaChart() {
  const el=document.getElementById("dsaChart"); if(!el) return
  const ctx=el.getContext("2d"), labels=last7Labels(), dates=last7Dates()
  const dsaByDay=dates.map(d=>dsaLog.filter(l=>l.log_date===d).length)
  mkChart("dsaChart",{type:"bar",data:{labels,datasets:[{data:dsaByDay,backgroundColor:grad(ctx,"rgba(230,215,255,0.8)","rgba(212,191,255,0.3)"),borderRadius:8,borderSkipped:false}]},options:COPTS})
}

function initGoalsChart() {
  if (!goals.length) return
  const labels=goals.slice(0,6).map(g=>g.emoji+" "+g.title.slice(0,12))
  const data=goals.slice(0,6).map(g=>g.progress)
  mkChart("goalsChart",{type:"bar",data:{labels,datasets:[{data,backgroundColor:["rgba(230,215,255,0.7)","rgba(255,214,232,0.7)","rgba(200,240,224,0.7)","rgba(200,224,255,0.7)","rgba(245,230,218,0.7)","rgba(255,220,200,0.7)"],borderRadius:10,borderSkipped:false}]},
    options:{...COPTS,indexAxis:"y",scales:{x:{...COPTS.scales.x,max:100},y:{...COPTS.scales.y}}}})
}
// TASK DATE PICKER

const taskDatePicker =
  document.getElementById(
    "task-date-picker"
  )

if(taskDatePicker){

  taskDatePicker.value =
    selectedDate

  taskDatePicker.addEventListener(
    "change",
    (e)=>{

      selectedDate =
        e.target.value

      renderTasksPage()
      renderHomeTasks()
      renderHomeStats()
    }
  )
}
let currentMonth =
  new Date().getMonth()

let currentYear =
  new Date().getFullYear()
function renderCalendar(){

  const cal =
    document.getElementById("calendar")

  if(!cal) return
  document.getElementById(
  "calendar-month-title"
).textContent =

  new Date(
    currentYear,
    currentMonth
  ).toLocaleString(
    "default",
    {
      month:"long",
      year:"numeric"
    }
  )

  cal.innerHTML = ""

  const year =
  currentYear

const month =
  String(
    currentMonth + 1
  ).padStart(2,"0")
  const daysInMonth =
    new Date(
      year,
      currentMonth + 1,
      0
    ).getDate()

  for(let i=1;i<=daysInMonth;i++){

    const day =
      String(i).padStart(2,"0")

    const date =
      `${year}-${month}-${day}`

    const div =
      document.createElement("div")

    div.className =
      "calendar-day"
    const hasTasks =
  tasks.some(t => {

    const d =
      t.log_date ||
      (t.created_at || "")
        .split("T")[0]

    return d === date
  })

const hasWater =
  waterData[date]?.cups > 0

const hasMood =
  moodLog.some(
    m => m.log_date === date
  )

const hasDSA =
  dsaLog.some(
    d => d.log_date === date
  )

const activityCount =
  
  [
    hasTasks,
    hasWater,
    hasMood,
    hasDSA
  ].filter(Boolean).length

if(activityCount >= 1){

  div.classList.add(
    "active-day"
  )
}

if(activityCount >= 3){

  div.classList.add(
    "super-active-day"
  )
}

    div.innerHTML = i

    div.style.cursor = "pointer"

    div.addEventListener(
      "click",
      () => {

        console.log(date)

        showDayData(date)
      }
    )

    cal.appendChild(div)
  }
}
function prevMonth(){

  currentMonth--

  if(currentMonth < 0){

    currentMonth = 11
    currentYear--
  }

  renderCalendar()
}

function nextMonth(){

  currentMonth++

  if(currentMonth > 11){

    currentMonth = 0
    currentYear++
  }

  renderCalendar()
}
function showDayData(date){

  const title =
    document.getElementById(
      "calendar-date-title"
    )

  const stats =
    document.getElementById(
      "calendar-stats"
    )

  title.innerHTML =
    `📅 ${formatChatDate(date)}`

  const dayTasks =
    tasks.filter(t => {

      const d =
        t.log_date ||
        (t.created_at || "")
          .split("T")[0]

      return d === date
    })

  const completed =
    dayTasks.filter(
      t => t.done
    ).length

  const water =
    waterData[date]?.cups || 0

  const mood =
    moodLog.find(
      m => m.log_date === date
    )

  const dsa =
    dsaLog.filter(
      d => d.log_date === date
    ).length

  stats.innerHTML = `

    <div>✅ Tasks Completed:
      ${completed}
    </div>

    <div>💧 Water:
      ${water}/8 cups
    </div>

    <div>🌸 Mood:
      ${mood
        ? MOODS[mood.mood_index].l
        : "Not logged"}
    </div>

    <div>💻 DSA Solved:
      ${dsa}
    </div>
  `
}
renderCalendar()
const themeBtn =
  document.getElementById(
    "theme-toggle"
  )

if(localStorage.getItem("theme")
  === "dark"){

  document.body.classList.add(
    "dark-mode"
  )

  themeBtn.textContent =
    "☀️ Light Mode"
}

themeBtn?.addEventListener(
  "click",
  ()=>{

    document.body.classList.toggle(
      "dark-mode"
    )

    const dark =
      document.body.classList.contains(
        "dark-mode"
      )

    localStorage.setItem(
      "theme",
      dark ? "dark" : "light"
    )

    themeBtn.textContent =
      dark
        ? "☀️ Light Mode"
        : "🌙 Dark Mode"
  }
)
