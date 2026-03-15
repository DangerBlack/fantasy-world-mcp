#!/usr/bin/env node

/**
 * Complete a task and create git commit
 * Usage: node scripts/complete.js <task-id> "<commit message>"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const taskId = process.argv[2];
const commitMessage = process.argv[3];

if (!taskId || !commitMessage) {
  console.error('Usage: node scripts/complete.js <task-id> "<commit message>"');
  process.exit(1);
}

const tasksDir = path.join(__dirname, '..', 'tasks');
const taskFile = path.join(tasksDir, `${taskId}.task.json`);

if (!fs.existsSync(taskFile)) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));

// Check if there are uncommitted changes
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (!status) {
    console.error('No changes to commit. Make your changes first, then run complete.js');
    process.exit(1);
  }
} catch (e) {
  console.error('Error checking git status:', e.message);
  process.exit(1);
}

// Create commit
console.log('\n📝 Creating commit...\n');
try {
  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  
  const logOutput = execSync('git log -1 --format="%H"', { encoding: 'utf8' }).trim();
  const commitHash = logOutput;
  
  console.log(`\n✓ Commit created: ${commitHash.substring(0, 7)}`);
  
  // Update task
  task.status = 'completed';
  task.completed = new Date().toISOString().split('T')[0];
  task.commit = commitHash;
  
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2) + '\n');
  
  console.log(`\n✅ Task [${task.id}] ${task.title} marked as completed`);
  console.log(`   Commit: ${commitHash.substring(0, 7)}`);
  
} catch (e) {
  console.error('Error creating commit:', e.message);
  process.exit(1);
}
