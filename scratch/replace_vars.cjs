const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/lib/deriv.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace remaining DERIV_CLIENT_ID and DERIV_APP_ID instances
content = content.replace(/\bDERIV_CLIENT_ID\b/g, "getDerivOauthClientId()");
content = content.replace(/\bDERIV_APP_ID\b/g, "getDerivOauthClientId()");

fs.writeFileSync(file, content);
console.log("Replaced successfully");
