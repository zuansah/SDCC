const fs = require('fs');

let content = fs.readFileSync('src/components/BAForm.tsx', 'utf8');

// 1. Update handleChange to set startedAt
content = content.replace(
  "    setFormData((prev) => ({ ...prev, [name]: value }));",
  "    setFormData((prev) => ({\n      ...prev,\n      [name]: value,\n      startedAt: prev.startedAt || new Date().toISOString()\n    }));"
);

// 2. Update handleScan to set startedAt AFTER setting other data
const scanCodeOld = `          city: data.Kota || data.city || '',
          // Do not override id or other system fields
          id: prev.id,
          createdAt: prev.createdAt
        }));`;
const scanCodeNew = `          city: data.Kota || data.city || '',
          // Do not override id or other system fields
          id: prev.id,
          createdAt: prev.createdAt,
          startedAt: prev.startedAt || new Date().toISOString()
        }));`;
content = content.replace(scanCodeOld, scanCodeNew);

// 3. Update handleSubmit
const submitCodeOld = `    const isNew = !initialData?.id;
    const rawData = {
      ...formData,
      id: isNew ? generateId() : initialData.id,
      createdAt: isNew ? new Date().toISOString() : initialData.createdAt,
    };`;

const submitCodeNew = `    const isNew = !initialData?.id;
    
    let submittedAt = new Date().toISOString();
    let formDurationSeconds = formData.formDurationSeconds;
    
    if (formData.startedAt && !formDurationSeconds) {
      const start = new Date(formData.startedAt).getTime();
      const end = new Date(submittedAt).getTime();
      formDurationSeconds = Math.floor((end - start) / 1000);
    }

    const rawData = {
      ...formData,
      id: isNew ? generateId() : initialData.id,
      createdAt: isNew ? new Date().toISOString() : initialData.createdAt,
      submittedAt: formData.submittedAt || submittedAt,
      formDurationSeconds: formDurationSeconds,
    };`;

content = content.replace(submitCodeOld, submitCodeNew);

fs.writeFileSync('src/components/BAForm.tsx', content);
