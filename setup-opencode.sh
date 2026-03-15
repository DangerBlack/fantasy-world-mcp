#!/bin/bash
# Opencode MCP configuration helper
# Run this to set up world-evolution for opencode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config/opencode"
CONFIG_FILE="$CONFIG_DIR/mcp.yaml"

echo "Setting up World Evolution MCP for opencode..."

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    echo "Found existing $CONFIG_FILE"
    echo "Adding world-evolution server..."
    
    # Check if world-evolution already exists
    if grep -q "world-evolution" "$CONFIG_FILE"; then
        echo "world-evolution already configured!"
        exit 0
    fi
    
    # Append the new server config
    cat >> "$CONFIG_FILE" << 'EOF'

# World Evolution Server (added by setup script)
  world-evolution:
    command: node
    args:
      - dist/index.js
    cwd: /path/to/your/dnd_think
EOF
    
    echo "✓ Added world-evolution to $CONFIG_FILE"
    echo ""
    echo "IMPORTANT: Edit $CONFIG_FILE and replace '/path/to/your/dnd_think'"
    echo "with the actual path to this project: $SCRIPT_DIR"
else
    echo "Creating new $CONFIG_FILE..."
    
    cat > "$CONFIG_FILE" << EOF
mcpServers:
  world-evolution:
    command: node
    args:
      - dist/index.js
    cwd: $SCRIPT_DIR
EOF
    
    echo "✓ Created $CONFIG_FILE"
fi

echo ""
echo "Next steps:"
echo "1. Build the project: cd $SCRIPT_DIR && npm run build"
echo "2. Restart opencode"
echo "3. Test by asking your AI to 'create a fantasy world starting with a cave'"
echo ""
echo "Configuration file: $CONFIG_FILE"
