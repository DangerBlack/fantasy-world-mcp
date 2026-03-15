import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fixImports(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = readFileSync(fullPath, 'utf-8');
      const fileDir = dirname(fullPath);
      
      // Replace all relative imports to add proper extensions
      content = content.replace(
        /(from ['"])(\.\/|\.\.\/)([^'"]+)(['"])/g,
        (match, prefix, dotSlash, importPath, quote) => {
          // Already has .js extension
          if (importPath.endsWith('.js')) {
            // Check if this is actually a directory import incorrectly written as .js
            const targetPath = join(fileDir, importPath.replace('.js', ''));
            try {
              readdirSync(targetPath, { withFileTypes: true });
              // It's a directory, fix it to /index.js
              return prefix + dotSlash + importPath.replace('.js', '/index.js') + quote;
            } catch (e) {
              // It's a file, keep as is
              return match;
            }
          }
          
          // No extension - check if directory or file
          const fullImport = dotSlash + importPath;
          const targetPath = join(fileDir, fullImport);
          try {
            readdirSync(targetPath, { withFileTypes: true });
            // It's a directory
            return prefix + dotSlash + importPath + '/index.js' + quote;
          } catch (e) {
            // Not a directory, must be a file
            return prefix + dotSlash + importPath + '.js' + quote;
          }
        }
      );
      
      writeFileSync(fullPath, content);
    }
  }
}

fixImports(join(__dirname, 'dist'));
