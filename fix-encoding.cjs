const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;
  c = c.replace(/â€”/g, '—');
  c = c.replace(/â€¢/g, '•');
  c = c.replace(/Â·/g, '·');
  c = c.replace(/â€¦/g, '…');
  c = c.replace(/Ã—/g, '×');
  if (c !== original) {
    fs.writeFileSync(f, c, 'utf8');
    console.log('Fixed', f);
  }
});
