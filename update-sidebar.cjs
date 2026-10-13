const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Wrap Fulfillment items
code = code.replace(
  `{[
                { id: 'projects', label: 'Project List', icon: List },
                { id: 'project_management', label: 'PM', icon: Briefcase },
                { id: 'orders', label: 'Order Status', icon: ShoppingCart },
                { id: 'tracking', label: 'Tracking Asset', icon: MapPin },
              ].map((item) => (`,
  `{[
                { id: 'projects', label: 'Project List', icon: List },
                { id: 'project_management', label: 'PM', icon: Briefcase },
                { id: 'orders', label: 'Order Status', icon: ShoppingCart },
                { id: 'tracking', label: 'Tracking Asset', icon: MapPin },
              ].filter(item => isAllowed(item.id)).map((item) => (`
);

// Wrap Operation items
code = code.replace(
  `{[
                { id: 'monitoring', label: 'Monitoring', icon: Monitor },
                { id: 'ticket', label: 'Ticket', icon: Ticket },
                { id: 'controller', label: 'Controller', icon: Cpu },
                { id: 'license', label: 'License', icon: Key },
              ].map((item) => (`,
  `{[
                { id: 'monitoring', label: 'Monitoring', icon: Monitor },
                { id: 'ticket', label: 'Ticket', icon: Ticket },
                { id: 'controller', label: 'Controller', icon: Cpu },
                { id: 'license', label: 'License', icon: Key },
              ].filter(item => isAllowed(item.id)).map((item) => (`
);

// Wrap Asset Management items
code = code.replace(
  `{[
                { id: 'inventory', label: 'Inventory', icon: Layers },
                { id: 'tracing', label: 'Tracing', icon: Search },
                { id: 'identification', label: 'Identification', icon: CheckCircle },
              ].map((item) => (`,
  `{[
                { id: 'inventory', label: 'Inventory', icon: Layers },
                { id: 'tracing', label: 'Tracing', icon: Search },
                { id: 'identification', label: 'Identification', icon: CheckCircle },
              ].filter(item => isAllowed(item.id)).map((item) => (`
);

// Wrap Lab items
code = code.replace(
  `{[
                { id: 'mass-testing-uat', label: 'Mass Testing UAT', icon: CheckCircle },
                { id: 'open-sdwan', label: 'Open SDWAN', icon: Network },
                { id: 'automation', label: 'Automation', icon: Cog },
                { id: 'api', label: 'API', icon: Webhook },
              ].map((item) => (`,
  `{[
                { id: 'mass-testing-uat', label: 'Mass Testing UAT', icon: CheckCircle },
                { id: 'open-sdwan', label: 'Open SDWAN', icon: Network },
                { id: 'automation', label: 'Automation', icon: Cog },
                { id: 'api', label: 'API', icon: Webhook },
              ].filter(item => isAllowed(item.id)).map((item) => (`
);

// Hide 'Create New BA' button based on 'new-ba' view check
code = code.replace(
  `        <button
          onClick={onCreateNew}`,
  `        {isAllowed('new-ba') && (
        <button
          onClick={onCreateNew}`
);
code = code.replace(
  `          Create New BA
        </button>`,
  `          Create New BA
        </button>
        )}`
);

// Hide entire parent dropdowns if none are allowed
const replaceFulfillment = `        {/* Fulfillment Dropdown */}
        <div>`;
const newFulfillment = `        {/* Fulfillment Dropdown */}
        {['projects', 'project_management', 'orders', 'tracking'].some(id => isAllowed(id)) && (
        <div>`;
code = code.replace(replaceFulfillment, newFulfillment);
code = code.replace(
  `              ))}
            </div>
          )}
        </div>
        {/* Operation Dropdown */}`,
  `              ))}
            </div>
          )}
        </div>
        )}
        {/* Operation Dropdown */}`
);

const replaceOperation = `        {/* Operation Dropdown */}
        <div>`;
const newOperation = `        {/* Operation Dropdown */}
        {['monitoring', 'ticket', 'controller', 'license'].some(id => isAllowed(id)) && (
        <div>`;
code = code.replace(replaceOperation, newOperation);
code = code.replace(
  `              ))}
            </div>
          )}
        </div>
        {/* Asset Management Dropdown */}`,
  `              ))}
            </div>
          )}
        </div>
        )}
        {/* Asset Management Dropdown */}`
);

const replaceAsset = `        {/* Asset Management Dropdown */}
        <div>`;
const newAsset = `        {/* Asset Management Dropdown */}
        {['inventory', 'tracing', 'identification'].some(id => isAllowed(id)) && (
        <div>`;
code = code.replace(replaceAsset, newAsset);
code = code.replace(
  `              ))}
            </div>
          )}
        </div>
        {/* Lab Dropdown */}`,
  `              ))}
            </div>
          )}
        </div>
        )}
        {/* Lab Dropdown */}`
);

const replaceLab = `        {/* Lab Dropdown */}
        <div>`;
const newLab = `        {/* Lab Dropdown */}
        {['mass-testing-uat', 'open-sdwan', 'automation', 'api'].some(id => isAllowed(id)) && (
        <div>`;
code = code.replace(replaceLab, newLab);
code = code.replace(
  `              ))}
            </div>
          )}
        </div>
        
        {isAllowed('new-ba')`,
  `              ))}
            </div>
          )}
        </div>
        )}
        
        {isAllowed('new-ba')`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
