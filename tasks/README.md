# Task System

Questo sistema permette di gestire lo sviluppo del simulatore come una lista di task scritti su file.

## Struttura

Ogni task è un file JSON in questa cartella:
```
tasks/
├── 001-load-world-tool.task.json
├── 002-hero-system.task.json
└── ...
```

## Stati del task

- `pending` - Task da fare
- `in_progress` - Task in corso
- `completed` - Task completato (con commit linkato)

## Comandi

```bash
# Listare tutti i task
node scripts/list-tasks.js

# Mostrare un task specifico
node scripts/view-task.js <task-id>

# Segnare come in progress
node scripts/transition.js <task-id> in_progress

# Completare task e creare commit
node scripts/complete.js <task-id> "<commit message>"
```

## Formato del file

```json
{
  "id": "001",
  "title": "Implement loadWorld tool",
  "description": "Add tool to restore worlds from saved JSON data",
  "priority": "high",
  "status": "pending",
  "created": "2026-03-15",
  "completed": null,
  "commit": null,
  "notes": []
}
```

## Workflow

1. Crea un task file per ogni feature/bug
2. `transition <id> in_progress` - inizia a lavorare
3. Implementa, testa, committa
4. `complete <id> "message"` - marca come completato con link al commit
5. Ripeti
