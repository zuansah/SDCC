const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

code = code.replace(
  `          )}
        </div>

        {/* Operation Dropdown */}`,
  `          )}
        </div>
        )}

        {/* Operation Dropdown */}`
);

code = code.replace(
  `          )}
        </div>

        {/* Asset Management Dropdown */}`,
  `          )}
        </div>
        )}

        {/* Asset Management Dropdown */}`
);

code = code.replace(
  `          )}
        </div>

        {/* Lab Dropdown */}`,
  `          )}
        </div>
        )}

        {/* Lab Dropdown */}`
);

code = code.replace(
  `          )}
        </div>
        
        {isAllowed('new-ba')`,
  `          )}
        </div>
        )}
        
        {isAllowed('new-ba')`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
