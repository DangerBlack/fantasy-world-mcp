#!/usr/bin/env node

/**
 * List all tasks with their status
 */

const fs = require('fs');
const path = require('path');

const tasksDir = path.join(__dirname, '..', 'tasks');

function listTasks() {
  if (!fs.existsSync(tasksDir)) {
    console.log('No tasks directory found.');
    return;
  }

  const files = fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('.task.json'))
    .sort();

  if (files.length === 0) {
    console.log('No tasks found.');
    return;
  }

  console.log('\n📋 TASK LIST\n');
  console.log('═'.repeat(60));

  const tasks = files.map(file => {
    const content = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
    return { file, ...content };
  });

  // Group by status
  const byStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  if (byStatus.pending.length > 0) {
    console.log('\n⏳ PENDING\n');
    byStatus.pending.forEach(task => {
      console.log(`  [${task.id}] ${task.title}`);
      console.log(`      Priority: ${task.priority}`);
    });
  }

  if (byStatus.in_progress.length > 0) {
    console.log('\n🔧 IN PROGRESS\n');
    byStatus.in_progress.forEach(task => {
      console.log(`  [${task.id}] ${task.title}`);
    });
  }

  if (byStatus.completed.length > 0) {
    console.log('\n✅ COMPLETED\n');
    byStatus.completed.forEach(task => {
      console.log(`  [${task.id}] ${task.title}`);
      if (task.commit) {
        console.log(`      Commit: ${task.commit.substring(0, 7)}`);
      }
    });
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\nTotal: ${tasks.length} tasks (${byStatus.pending.length} pending, ${byStatus.in_progress.length} in progress, ${byStatus.completed.length} completed)\n`);
}

listTasks();
