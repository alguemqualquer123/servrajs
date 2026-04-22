/**
 * Script to add .js extensions to all imports in compiled JS files
 */
import fs from 'fs';
import path from 'path';

const distDir = './dist';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  const replacePath = (fullMatch, quote, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return fullMatch;
    }
    if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
      return fullMatch;
    }
    modified = true;
    return fullMatch.replace(`${quote}${importPath}${quote}`, `${quote}${importPath}.js${quote}`);
  };

  content = content.replace(/from\s+(['"])(\.[^'"]+)\1/g, replacePath);
  content = content.replace(/import\s*\(\s*(['"])(\.[^'"]+)\1\s*\)/g, replacePath);

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ Added extensions to: ${path.relative(distDir, filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js')) {
      processFile(filePath);
    }
  }
}

console.log('\n📦 Adding .js extensions to imports...\n');
walkDir(distDir);
console.log('\n✅ Done!\n');
