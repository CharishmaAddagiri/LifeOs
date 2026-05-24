const express = require("express")
const bcrypt = require('bcrypt');
const path = require("path")
const cors    = require("cors")
const sqlite3 = require("sqlite3").verbose()
const app     = express()
app.use(express.static(__dirname))
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "login.html")
  )
})

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const db = new sqlite3.Database("./lifeos.db")

// ── Create all tables ─────────────────────────────────────────
db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    email      TEXT UNIQUE,
    password   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    title      TEXT,
    priority   TEXT DEFAULT 'med',
    category   TEXT DEFAULT '',
    due_date   TEXT DEFAULT '',
    log_date TEXT,
    done       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS habits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    name       TEXT,
    icon       TEXT DEFAULT '✨',
    category   TEXT DEFAULT 'Health',
    streak     INTEGER DEFAULT 0,
    done       INTEGER DEFAULT 0,
    last_done  TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS habit_logs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER,
    user_id  INTEGER,
    log_date TEXT,
    UNIQUE(habit_id, log_date)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS mood_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    log_date   TEXT,
    mood_index INTEGER,
    journal    TEXT DEFAULT '',
    gratitude  TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, log_date)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS water_logs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER,
    log_date TEXT,
    cups     INTEGER DEFAULT 0,
    goal     INTEGER DEFAULT 8,
    UNIQUE(user_id, log_date)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS sleep_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    log_date   TEXT,
    bedtime    TEXT DEFAULT '',
    wake_time  TEXT DEFAULT '',
    duration   TEXT DEFAULT '',
    mins       INTEGER DEFAULT 0,
    quality    INTEGER DEFAULT 5,
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, log_date)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS fitness_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    name       TEXT,
    type       TEXT DEFAULT '',
    duration   INTEGER DEFAULT 0,
    calories   INTEGER DEFAULT 0,
    notes      TEXT DEFAULT '',
    log_date   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS nutrition_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    meal_type  TEXT DEFAULT '',
    food       TEXT,
    calories   REAL DEFAULT 0,
    protein    REAL DEFAULT 0,
    carbs      REAL DEFAULT 0,
    fats       REAL DEFAULT 0,
    log_date   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS dsa_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    name       TEXT,
    topic      TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'Medium',
    platform   TEXT DEFAULT 'LeetCode',
    notes      TEXT DEFAULT '',
    log_date   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS dsa_topics (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name    TEXT,
    status  TEXT DEFAULT 'todo',
    UNIQUE(user_id, name)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    title       TEXT,
    emoji       TEXT DEFAULT '🌟',
    category    TEXT DEFAULT 'Personal',
    target_date TEXT DEFAULT '',
    progress    INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  )`)

})

// Seed default DSA topics for new user
const DEFAULT_TOPICS = [
  'Arrays','Strings','Hash Map','Two Pointers','Sliding Window',
  'Binary Search','Linked List','Stacks','Queues','Trees',
  'BST','Graphs','BFS/DFS','DP','Backtracking','Heap','Tries','Greedy'
]
function seedTopics(user_id) {
  DEFAULT_TOPICS.forEach(name => {
    db.run("INSERT OR IGNORE INTO dsa_topics (user_id, name) VALUES (?,?)", [user_id, name])
  })
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword],
      function (err) {
        if (err) {
          return res.status(400).json({ error: "User already exists" });
        }

        res.json({
          id: this.lastID,
          name,
          email
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: "User not found" });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.status(400).json({ error: "Invalid password" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email
      });
    }
  );
});

app.get("/api/me", (req, res) => {
  const user_id = req.query.user_id
  if (!user_id) return res.status(401).json({ error: "Not logged in." })
  db.get("SELECT id, name, email FROM users WHERE id=?", [user_id], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "User not found." })
    res.json(row)
  })
})

// ════════════════════════════════════════════════════════════
//  TASKS
// ════════════════════════════════════════════════════════════

app.get("/api/tasks/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM tasks WHERE user_id=? ORDER BY created_at DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows.map(r => ({ ...r, done: r.done === 1 })))
    }
  )
})

app.post("/api/tasks", (req, res) => {
  const {
  user_id,
  title,
  priority = "med",
  category = "",
  due_date = "",
  log_date = ""
} = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." })
  db.run(
    "INSERT INTO tasks (user_id,title,priority,category,due_date,log_date) VALUES (?,?,?,?,?,?)",
     [
      user_id,
      title.trim(),
      priority,
      category.trim(),
      due_date,
      log_date
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM tasks WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json({ ...row, done: false })
      })
    }
  )
})

app.put("/api/tasks/:id", (req, res) => {
  const { title, priority, category, due_date, done } = req.body
  db.get("SELECT * FROM tasks WHERE id=?", [req.params.id], (err, task) => {
    if (!task) return res.status(404).json({ error: "Task not found." })
    const t = title    !== undefined ? title.trim()   : task.title
    const p = priority !== undefined ? priority        : task.priority
    const c = category !== undefined ? category.trim() : task.category
    const d = due_date  !== undefined ? due_date        : task.due_date
    const dn= done      !== undefined ? (done ? 1 : 0)  : task.done
    db.run(
      "UPDATE tasks SET title=?,priority=?,category=?,due_date=?,done=? WHERE id=?",
      [t, p, c, d, dn, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message })
        db.get("SELECT * FROM tasks WHERE id=?", [req.params.id], (err, row) => {
          res.json({ ...row, done: row.done === 1 })
        })
      }
    )
  })
})

app.delete("/api/tasks/:id", (req, res) => {
  db.run("DELETE FROM tasks WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  HABITS
// ════════════════════════════════════════════════════════════

app.get("/api/habits/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM habits WHERE user_id=? ORDER BY created_at ASC",
    [req.params.user_id],
    (err, habits) => {
      if (err) return res.status(500).json({ error: err.message })
      db.all(
        "SELECT habit_id, log_date FROM habit_logs WHERE user_id=?",
        [req.params.user_id],
        (err, logs) => {
          const logMap = {}
          logs.forEach(l => {
            if (!logMap[l.habit_id]) logMap[l.habit_id] = []
            logMap[l.habit_id].push(l.log_date)
          })
          res.json(habits.map(h => ({ ...h, done: h.done === 1, log: logMap[h.id] || [] })))
        }
      )
    }
  )
})

app.post("/api/habits", (req, res) => {
  const { user_id, name, icon = "✨", category = "Health" } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." })
  db.run(
    "INSERT INTO habits (user_id,name,icon,category) VALUES (?,?,?,?)",
    [user_id, name.trim(), icon, category],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM habits WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json({ ...row, done: false, log: [] })
      })
    }
  )
})

app.put("/api/habits/:id/toggle", (req, res) => {
  const { user_id, date } = req.body
  db.get("SELECT * FROM habits WHERE id=?", [req.params.id], (err, habit) => {
    if (!habit) return res.status(404).json({ error: "Habit not found." })
    db.get(
      "SELECT id FROM habit_logs WHERE habit_id=? AND log_date=?",
      [req.params.id, date],
      (err, existing) => {
        if (existing) {
          db.run("DELETE FROM habit_logs WHERE habit_id=? AND log_date=?", [req.params.id, date])
          const newStreak = Math.max(0, habit.streak - 1)
          db.run("UPDATE habits SET done=0, streak=? WHERE id=?", [newStreak, req.params.id], () => {
            db.all("SELECT log_date FROM habit_logs WHERE habit_id=?", [req.params.id], (err, logs) => {
              db.get("SELECT * FROM habits WHERE id=?", [req.params.id], (err, updated) => {
                res.json({ ...updated, done: false, log: logs.map(l => l.log_date) })
              })
            })
          })
        } else {
          db.run("INSERT OR IGNORE INTO habit_logs (habit_id,user_id,log_date) VALUES (?,?,?)", [req.params.id, user_id, date])
          const newStreak = habit.streak + 1
          db.run("UPDATE habits SET done=1, last_done=?, streak=? WHERE id=?", [date, newStreak, req.params.id], () => {
            db.all("SELECT log_date FROM habit_logs WHERE habit_id=?", [req.params.id], (err, logs) => {
              db.get("SELECT * FROM habits WHERE id=?", [req.params.id], (err, updated) => {
                res.json({ ...updated, done: true, log: logs.map(l => l.log_date) })
              })
            })
          })
        }
      }
    )
  })
})

app.delete("/api/habits/:id", (req, res) => {
  db.run("DELETE FROM habits WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    db.run("DELETE FROM habit_logs WHERE habit_id=?", [req.params.id])
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  MOOD
// ════════════════════════════════════════════════════════════

app.get("/api/mood/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM mood_logs WHERE user_id=? ORDER BY log_date DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/mood", (req, res) => {
  const { user_id, log_date, mood_index, journal = "", gratitude = "" } = req.body
  db.run(
    `INSERT INTO mood_logs (user_id,log_date,mood_index,journal,gratitude) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id,log_date) DO UPDATE SET mood_index=excluded.mood_index,
     journal=excluded.journal,gratitude=excluded.gratitude`,
    [user_id, log_date, mood_index, journal, gratitude],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM mood_logs WHERE user_id=? AND log_date=?", [user_id, log_date], (err, row) => {
        res.json(row)
      })
    }
  )
})

app.delete("/api/mood/:id", (req, res) => {
  db.run("DELETE FROM mood_logs WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  WATER
// ════════════════════════════════════════════════════════════

app.get("/api/water/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM water_logs WHERE user_id=? ORDER BY log_date DESC LIMIT 30",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/water", (req, res) => {
  const { user_id, log_date, cups, goal = 8 } = req.body
  db.run(
    `INSERT INTO water_logs (user_id,log_date,cups,goal) VALUES (?,?,?,?)
     ON CONFLICT(user_id,log_date) DO UPDATE SET cups=excluded.cups, goal=excluded.goal`,
    [user_id, log_date, cups, goal],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM water_logs WHERE user_id=? AND log_date=?", [user_id, log_date], (err, row) => {
        res.json(row)
      })
    }
  )
})

// ════════════════════════════════════════════════════════════
//  SLEEP
// ════════════════════════════════════════════════════════════

app.get("/api/sleep/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM sleep_logs WHERE user_id=? ORDER BY log_date DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/sleep", (req, res) => {
  const { user_id, log_date, bedtime, wake_time, duration, mins, quality, notes = "" } = req.body
  db.run(
    `INSERT INTO sleep_logs (user_id,log_date,bedtime,wake_time,duration,mins,quality,notes) VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id,log_date) DO UPDATE SET bedtime=excluded.bedtime,wake_time=excluded.wake_time,
     duration=excluded.duration,mins=excluded.mins,quality=excluded.quality,notes=excluded.notes`,
    [user_id, log_date, bedtime, wake_time, duration, mins, quality, notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM sleep_logs WHERE user_id=? AND log_date=?", [user_id, log_date], (err, row) => {
        res.json(row)
      })
    }
  )
})

app.delete("/api/sleep/:id", (req, res) => {
  db.run("DELETE FROM sleep_logs WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  FITNESS
// ════════════════════════════════════════════════════════════

app.get("/api/fitness/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM fitness_logs WHERE user_id=? ORDER BY created_at DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/fitness", (req, res) => {
  const { user_id, name, type = "", duration = 0, calories = 0, notes = "", log_date } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." })
  db.run(
    "INSERT INTO fitness_logs (user_id,name,type,duration,calories,notes,log_date) VALUES (?,?,?,?,?,?,?)",
    [user_id, name.trim(), type, duration, calories, notes, log_date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM fitness_logs WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json(row)
      })
    }
  )
})

app.delete("/api/fitness/:id", (req, res) => {
  db.run("DELETE FROM fitness_logs WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  NUTRITION
// ════════════════════════════════════════════════════════════

app.get("/api/nutrition/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM nutrition_logs WHERE user_id=? ORDER BY created_at DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/nutrition", (req, res) => {
  const { user_id, meal_type = "", food, calories = 0, protein = 0, carbs = 0, fats = 0, log_date } = req.body
  if (!food || !food.trim()) return res.status(400).json({ error: "Food is required." })
  db.run(
    "INSERT INTO nutrition_logs (user_id,meal_type,food,calories,protein,carbs,fats,log_date) VALUES (?,?,?,?,?,?,?,?)",
    [user_id, meal_type, food.trim(), calories, protein, carbs, fats, log_date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM nutrition_logs WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json(row)
      })
    }
  )
})

app.delete("/api/nutrition/:id", (req, res) => {
  db.run("DELETE FROM nutrition_logs WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ════════════════════════════════════════════════════════════
//  DSA
// ════════════════════════════════════════════════════════════

app.get("/api/dsa/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM dsa_logs WHERE user_id=? ORDER BY created_at DESC",
    [req.params.user_id],
    (err, logs) => {
      if (err) return res.status(500).json({ error: err.message })
      db.all(
        "SELECT * FROM dsa_topics WHERE user_id=? ORDER BY id ASC",
        [req.params.user_id],
        (err, topics) => {
          res.json({ logs, topics })
        }
      )
    }
  )
})

app.post("/api/dsa", (req, res) => {
  const { user_id, name, topic = "", difficulty = "Medium", platform = "LeetCode", notes = "", log_date } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." })
  db.run(
    "INSERT INTO dsa_logs (user_id,name,topic,difficulty,platform,notes,log_date) VALUES (?,?,?,?,?,?,?)",
    [user_id, name.trim(), topic, difficulty, platform, notes, log_date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM dsa_logs WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json(row)
      })
    }
  )
})

app.delete("/api/dsa/:id", (req, res) => {
  db.run("DELETE FROM dsa_logs WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

app.put("/api/dsa/topics/:id", (req, res) => {
  const { status } = req.body
  db.run("UPDATE dsa_topics SET status=? WHERE id=?", [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    db.get("SELECT * FROM dsa_topics WHERE id=?", [req.params.id], (err, row) => {
      res.json(row)
    })
  })
})

// ════════════════════════════════════════════════════════════
//  GOALS
// ════════════════════════════════════════════════════════════

app.get("/api/goals/:user_id", (req, res) => {
  db.all(
    "SELECT * FROM goals WHERE user_id=? ORDER BY created_at DESC",
    [req.params.user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

app.post("/api/goals", (req, res) => {
  const { user_id, title, emoji = "🌟", category = "Personal", target_date = "", progress = 0 } = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required." })
  db.run(
    "INSERT INTO goals (user_id,title,emoji,category,target_date,progress) VALUES (?,?,?,?,?,?)",
    [user_id, title.trim(), emoji, category, target_date, progress],
    function(err) {
      if (err) return res.status(500).json({ error: err.message })
      db.get("SELECT * FROM goals WHERE id=?", [this.lastID], (err, row) => {
        res.status(201).json(row)
      })
    }
  )
})

app.put("/api/goals/:id", (req, res) => {
  const { progress } = req.body
  db.run("UPDATE goals SET progress=? WHERE id=?", [progress, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    db.get("SELECT * FROM goals WHERE id=?", [req.params.id], (err, row) => {
      res.json(row)
    })
  })
})

app.delete("/api/goals/:id", (req, res) => {
  db.run("DELETE FROM goals WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ message: "Deleted." })
  })
})

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`\n✦ LifeOS running → http://localhost:${PORT}\n`))
