const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `<ProjectManagementDashboard 
            bas={bas}`,
  `<ProjectManagementDashboard 
            userData={userData}
            bas={bas}`
);

fs.writeFileSync('src/App.tsx', code);
