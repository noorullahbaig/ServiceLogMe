const fs = require('fs');
let content = fs.readFileSync('tests/routing-v1-v2.test.tsx', 'utf8');
content = content.replace(/"\.\.\/src\/types"/g, '"@/lib/types"');
// We just need to make the typechecker happy by casting to ServiceNote.
// Let's replace the return types with `as Organization` and `as ServiceNote`
content = content.replace(/): Organization \{/g, '): Organization {');
content = content.replace(/return \{/g, 'return {');
fs.writeFileSync('tests/routing-v1-v2.test.tsx', content);
