#!/usr/bin/env node

/**
 * Transition task to new status
 * Usage: node scripts/transition.js <task-id> <status>
 * Status: pending, in_progress, completed
 */

const fs = require('fs');
const path = require('path');

const taskId = process.argv[2];
const newStatus = process.argv[3];

if (!taskId || !newStatus) {
  console.error('Usage: node scripts/transition.js <task-id> <status>');
  console.error('Status: pending, in_progress, completed');
  process.exit(1);
}

const validStatuses = ['pending', 'in_progress', 'completed'];
if (!validStatuses.includes(newStatus)) {
  console.error(`Invalid status: ${newStatus}`);
  console.error(`Valid statuses: ${validStatuses.join(', ')}`);
  process.exit(1);
}

const tasksDir = path.join(__dirname, '..', 'tasks');
const taskFile = path.join(tasksDir, `${taskId}.task.json`);

if (!fs.existsSync(taskFile)) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
const oldStatus = task.status;

task.status = newStatus;

if (newStatus === 'in_progress' && oldStatus === 'pending') {
  task.started = new Date().toISOString().split('T')[0];
}

fs.writeFileSync(taskFile, JSON.stringify(task, null, 2) + '\n');

console.log(`✓ Task [${task.id}] ${task.title}`);
console.log(`  Status: ${oldStatus} → ${newStatus}`);

if (newStatus === 'in_progress') {
  console.log('\n🔧 Now working on this task...');
}
