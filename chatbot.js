// TOGGLE CHATBOT
const chatToggle =
  document.getElementById("chat-toggle")

const chatbot =
  document.getElementById("chatbot")

chatToggle.onclick = () => {

  console.log(
    "CHAT TOGGLE CLICKED"
  )

  if(
    chatbot.style.display ===
    "flex"
  ){

    chatbot.style.display =
      "none"

  }else{

    chatbot.style.display =
      "flex"

    chatbot.style.height =
      "450px"

    const body =
      document.getElementById(
        "chat-body"
      )

    if(body){

      body.style.display =
        "flex"
    }
  }
}

// SEND MESSAGE
function sendMessage() {

  const input =
    document.getElementById("chat-input")

  const messages =
    document.getElementById("chat-messages")

  const msg = input.value.trim()

  if(!msg) return

  addMessage("You", msg)

  const reply = botReply(msg)

  showTyping()

setTimeout(() => {

  removeTyping()

  addMessage("LifeOS", reply)
  const speech =
  new SpeechSynthesisUtterance(
    reply
  )

speech.rate = 1

speech.pitch = 1

speech.lang = "en-US"

window.speechSynthesis
  .speak(speech)

}, 1200)

  input.value = ""
}

// ADD MESSAGE TO UI
function addMessage(sender, text){

  const messages =
    document.getElementById("chat-messages")

  const div = document.createElement("div")

  div.style.marginBottom = "12px"

  div.innerHTML = `
    <strong>${sender}:</strong> ${text}
  `

  messages.appendChild(div)

  messages.scrollTop =
    messages.scrollHeight
  saveChat()
}
function showTyping(){

  const messages =
    document.getElementById("chat-messages")

  const div =
    document.createElement("div")

  div.id = "typing"

  div.innerHTML = `
    <strong>LifeOS:</strong>
    <span class="typing-dots">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  `

  messages.appendChild(div)

  messages.scrollTop =
    messages.scrollHeight
}

function removeTyping(){

  const typing =
    document.getElementById("typing")

  if(typing){
    typing.remove()
  }
}

// BOT REPLIES
function botReply(msg){

  msg = msg.toLowerCase()

  // ===== TASK QUESTIONS =====

  if(
    msg.includes("task") ||
    msg.includes("tasks")
  ){

    const date =
      extractDate(msg)

   

    const taskList =
  tasks.filter(t => {

    const d =
      t.log_date ||
      (t.created_at || "")
        .split("T")[0]

    return d === date
  })
  console.log(tasks)
    const completed =
  taskList.filter(
    t => t.done
  )

if(!completed.length){

  return `
You completed 0 tasks on
${formatChatDate(date)} ✅
`
}

const names =
  completed
    .map(
      t => `✅ ${t.title}`
    )
    .join("\n")

return `
You completed
${completed.length} tasks on
${formatChatDate(date)} ✅

${names}
`
  }

  // ===== WATER QUESTIONS =====

  if(
    msg.includes("water") ||
    msg.includes("cups")
  ){

    const date =
      extractDate(msg)

    const cups =
      waterData[date]?.cups || 0

    return `
You drank ${cups}
cups of water on
${formatChatDate(date)} 💧
`
  }

  // ===== MOOD QUESTIONS =====

  if(msg.includes("mood")){

    const date =
      extractDate(msg)

    const mood =
      moodLog.find(
        m => m.log_date === date
      )

    if(!mood){

      return `
No mood logged on
${formatChatDate(date)} 🌸
`
    }

    return `
Your mood on
${formatChatDate(date)}
was ${MOODS[mood.mood_index].l} 🌸
`
  }

  // ===== DSA QUESTIONS =====

  if(
    msg.includes("dsa") ||
    msg.includes("problem")
  ){

    const date =
      extractDate(msg)

    const solved =
      dsaLog.filter(
        d => d.log_date === date
      ).length

    return `
You solved ${solved}
DSA problems on
${formatChatDate(date)} 💻
`
  }

  return `
I can help with:

✅ Tasks
💧 Water
🌸 Mood
💻 DSA

Example:
"How many tasks did I do on 12 April 2026?"
`
}
function extractDate(msg){

  const months = {
    january:"01",
    february:"02",
    march:"03",
    april:"04",
    may:"05",
    june:"06",
    july:"07",
    august:"08",
    september:"09",
    october:"10",
    november:"11",
    december:"12"
  }

  const match = msg.match(/(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i)

  if(match){

    const day =
      match[1]
        .padStart(2,"0")

    const month =
  months[
    match[3].toLowerCase()
  ]

const year =
  match[4]

    return `${year}-${month}-${day}`
  }

  return today()
}
function formatChatDate(date){

  return new Date(date)
    .toLocaleDateString(
      "en-IN",
      {
        day:"numeric",
        month:"short",
        year:"numeric"
      }
    )
}
// DRAG CHATBOT



// DRAG CHATBOT

const chatHeader =
  document.getElementById(
    "chat-header"
  )

if(chatHeader){

  let isDragging = false

  let offsetX = 0
  let offsetY = 0

  chatHeader.addEventListener(
    "mousedown",
    (e)=>{

      isDragging = true

      offsetX =
        e.clientX -
        chatbot.offsetLeft

      offsetY =
        e.clientY -
        chatbot.offsetTop
    }
  )

  document.addEventListener(
    "mousemove",
    (e)=>{

      if(!isDragging) return

      chatbot.style.left =
        (e.clientX - offsetX)
        + "px"

      chatbot.style.top =
        (e.clientY - offsetY)
        + "px"

      chatbot.style.bottom =
        "auto"

      chatbot.style.right =
        "auto"
    }
  )

  document.addEventListener(
    "mouseup",
    ()=>{

      isDragging = false
    }
  )
}
function loadSuggestions(){

  const box =
    document.getElementById(
      "smart-suggestions"
    )

  if(!box) return

  box.innerHTML = ""

  const suggestions = []

  // TASKS
  const pending =
    tasks.filter(t => !t.done).length

  if(pending > 0){

    suggestions.push(
      `📋 You still have ${pending} pending tasks`
    )
  }

  // WATER
  const water =
    waterData[today()]?.cups || 0

  if(water < waterGoal){

    suggestions.push(
      `💧 Drink ${waterGoal - water} more cups`
    )
  }

  // MOOD
  const mood =
    moodLog.find(
      m => m.log_date === today()
    )

  if(!mood){

    suggestions.push(
      `🌸 Log your mood today`
    )
  }

  // DSA
  const dsaToday =
    dsaLog.filter(
      d => d.log_date === today()
    ).length

  if(dsaToday === 0){

    suggestions.push(
      `💻 Solve at least 1 DSA problem`
    )
  }

  // PRODUCTIVITY
  if(
    pending === 0 &&
    water >= waterGoal
  ){

    suggestions.push(
      `🚀 Amazing productivity today`
    )
  }

  if(suggestions.length){

  const div =
    document.createElement("div")

  div.className = "suggestion"

  div.textContent =
    suggestions[0]

  box.appendChild(div)
}
}
loadSuggestions()
function generateSummary(){

  // TASKS
  const completedTasks =
    tasks.filter(t => t.done).length

  const totalTasks =
    tasks.length

  // WATER
  const water =
    waterData[today()]?.cups || 0

  // HABITS
  const habitsDone =
    habits.filter(h => h.done).length

  // MOOD
  const mood =
    moodLog.find(
      m => m.log_date === today()
    )

  // DSA
  const dsaToday =
    dsaLog.filter(
      d => d.log_date === today()
    ).length

  // FITNESS
  const workouts =
    fitnessLog.filter(
      f => f.log_date === today()
    ).length

  // NUTRITION
  const todayMeals =
    nutritionLog.filter(
      n => n.log_date === today()
    )

  const calories =
    todayMeals.reduce(
      (sum, meal) => sum + meal.calories,
      0
    )

  // SLEEP
  const latestSleep =
    sleepLog[0]

  let summary = `
📊 DAILY SUMMARY

✅ Tasks:
${completedTasks}/${totalTasks}

💧 Water:
${water}/${waterGoal} cups

🔥 Habits:
${habitsDone}/${habits.length}

💻 DSA:
${dsaToday} problems solved

💪 Fitness:
${workouts} workouts

🥗 Calories:
${Math.round(calories)}

😴 Sleep:
${latestSleep
  ? latestSleep.duration
  : "No data"}

🌸 Mood:
${mood
  ? MOODS[mood.mood_index].l
  : "Not logged"}
`

  // PRODUCTIVITY MESSAGE
  const productivity =
    completedTasks +
    habitsDone +
    dsaToday

  if(productivity >= 10){

    summary += `
🚀 Amazing productivity today!
`
  }

  else if(productivity >= 5){

    summary += `
✨ Good progress today!
`
  }

  else{

    summary += `
💪 Let's do a little more today!
`
  }

  addMessage("LifeOS", summary)
}
document
  .getElementById("summary-btn")
  .onclick = generateSummary


document.getElementById(
  "close-chat"
)?.addEventListener(
  "click",
  ()=>{

    chatbot.style.display =
      "none"
  }
)
// ===== CHATBOT BUTTONS =====

const minBtn =
  document.getElementById(
    "min-chat"
  )

const closeBtn =
  document.getElementById(
    "close-chat"
  )

const chatBody =
  document.getElementById(
    "chat-body"
  )

let minimized = false

// MINIMIZE
minBtn?.addEventListener(
  "click",
  ()=>{

    minimized = !minimized

    if(minimized){

      chatBody.style.display =
        "none"

      chatbot.style.height =
        "auto"

    }else{

      chatBody.style.display =
        "flex"

      chatbot.style.height =
        "450px"
    }
  }
)

// CLOSE
closeBtn?.addEventListener(
  "click",
  ()=>{

    chatbot.style.display =
      "none"
  }
)
// ===== VOICE ASSISTANT =====

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition

if(SpeechRecognition){

  const recognition =
    new SpeechRecognition()

  recognition.lang = "en-US"

  recognition.continuous = false

  recognition.interimResults = false

  document.getElementById(
    "voice-btn"
  )?.addEventListener(
    "click",
    ()=>{

      console.log(
        "VOICE BUTTON CLICKED"
      )

      recognition.start()

      alert(
        "Listening... 🎤"
      )
    }
  )

  recognition.onresult =
    function(event){

      const text =
        event.results[0][0]
          .transcript

      console.log(
        "VOICE:",
        text
      )

      document.getElementById(
        "chat-input"
      ).value = text

      sendMessage()
    }

  recognition.onerror =
    function(event){

      console.log(
        "VOICE ERROR:",
        event.error
      )

      alert(
        "Mic Error: " +
        event.error
      )
    }

}else{

  alert(
    "Speech Recognition not supported in this browser"
  )
}
function saveChat(){

  const messages =
    document.getElementById(
      "chat-messages"
    )

  localStorage.setItem(
    "lifeos_chat",
    messages.innerHTML
  )
}
function loadChat(){

  const saved =
    localStorage.getItem(
      "lifeos_chat"
    )

  if(saved){

    document.getElementById(
      "chat-messages"
    ).innerHTML = saved
  }
}
loadChat()