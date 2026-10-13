const fs = require('fs');
let content = fs.readFileSync('src/components/MonitoringView.tsx', 'utf8');

content = content.replace(
  /const storage = getStorage\(\);\n\s*const load = async <T,>\(path: string\): Promise<T> =>\n\s*JSON.parse\(new TextDecoder\(\).decode\(await getBytes\(ref\(storage, path\)\)\)\);\n\n\s*const \[fetchedEdges, fetchedMeta\] = await Promise.all\(\[\n\s*load<Edge\[\]>\("fleet\/map.json"\),\n\s*load<Meta>\("fleet\/map-meta.json"\),\n\s*\]\);/,
  `const mapDataModule = await import('../../fleet/map.json');
          const mapMetaModule = await import('../../fleet/map-meta.json');
          const fetchedEdges = mapDataModule.default || mapDataModule;
          const fetchedMeta = mapMetaModule.default || mapMetaModule;`
);

// We also need to remove the firebase/storage imports to keep it clean.
content = content.replace(
  `import { getStorage, ref, getBytes } from "firebase/storage";\n`,
  ``
);

fs.writeFileSync('src/components/MonitoringView.tsx', content);
