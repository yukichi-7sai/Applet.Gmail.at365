import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const modules = path.resolve(root, '../AppDock.at365/node_modules');
export default {
  root: path.join(root, 'renderer'), base: './',
  resolve: { alias: { 'react-dom': path.join(modules, 'react-dom'), react: path.join(modules, 'react') } },
  build: { outDir: path.join(root, 'dist'), emptyOutDir: true },
};
