import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function fixImports(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = readFileSync(fullPath, 'utf-8');
      
      // Replace all relative imports to add proper extensions
      content = content.replace(
        /(from ['"])(\.\/|\.\.\/)([^'"]+)(['"])/g,
        (match, prefix, dotSlash, path, quote) => {
          // Already has .js
          if (path.endsWith('.js')) return match;
          // Is an index import
          if (path.endsWith('/index')) return prefix + dotSlash + path + '/index.js' + quote;
          // Directory import - needs /index.js
          if (!path.includes('/')) return prefix + dotSlash + path + '/index.js' + quote;
          // File import - needs .js
          return prefix + dotSlash + path + '.js' + quote;
        }
      );
      
      writeFileSync(fullPath, content);
    }
  }
}

fixImports('dist');
