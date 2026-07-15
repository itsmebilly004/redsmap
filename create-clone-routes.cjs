const fs = require('fs');
const path = require('path');

const routesToDuplicate = [
  'dashboard.tsx',
  'dashboard.index.tsx',
  'dashboard.analytics.tsx',
  'charts.tsx',
  'strategies.tsx',
  'strategy.$slug.tsx',
  'analysis.tsx',
  'trading-bots.tsx',
  'copy-trading.tsx'
];

const routesDir = path.join(__dirname, 'src', 'routes');

for (const route of routesToDuplicate) {
  const originalPath = path.join(routesDir, route);
  const newPath = path.join(routesDir, `clone2006.${route}`);
  
  if (fs.existsSync(originalPath)) {
    let content = fs.readFileSync(originalPath, 'utf8');
    
    // Replace the route path string in createFileRoute
    content = content.replace(/createFileRoute\((["'])\/(.*?)\1\)/g, 'createFileRoute($1/clone2006/$2$1)');
    
    // Write the new file
    fs.writeFileSync(newPath, content, 'utf8');
    console.log(`Created ${newPath}`);
  } else {
    console.warn(`File not found: ${originalPath}`);
  }
}
