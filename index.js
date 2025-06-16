const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const logger = require('./logger');
const validateTask = require('./validateTask');
const errorHandler = require('./errorHandler');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_PATH = path.join(__dirname, 'tasks.json');

app.use(cors());
app.use(express.json());
app.use(logger);

// קריאה מהקובץ
async function readTasks() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// כתיבה לקובץ
async function writeTasks(tasksArray) {
  await fs.writeFile(DATA_PATH, JSON.stringify(tasksArray, null, 2));
}

// ==============================
//           ROUTES
// ==============================

// GET /tasks – כל המשימות
app.get('/tasks', async (req, res, next) => {
  try {
    const tasks = await readTasks();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id – משימה בודדת
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /tasks – יצירת משימה
app.post('/tasks', validateTask, async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const newTask = {
      id: uuidv4(),
      title: req.body.title.trim(),
      description: req.body.description?.trim() || '',
      status: req.body.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    tasks.push(newTask);
    await writeTasks(tasks);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id – עדכון משימה
app.put('/tasks/:id', validateTask, async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const index = tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found' });

    tasks[index] = {
      ...tasks[index],
      title: req.body.title.trim(),
      description: req.body.description?.trim() || '',
      status: req.body.status,
      updatedAt: new Date().toISOString()
    };

    await writeTasks(tasks);
    res.json(tasks[index]);
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id – מחיקת משימה
app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const tasks = await readTasks();
    const newTasks = tasks.filter(t => t.id !== req.params.id);
    if (newTasks.length === tasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await writeTasks(newTasks);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ==============================
//       ERROR HANDLER
// ==============================

app.use(errorHandler);

// ==============================
//         START SERVER
// ==============================

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
