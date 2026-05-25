import * as fs from 'fs';
import * as path from 'path';

const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const replacements = [
  // Backgrounds
  { regex: /bg-\[#0a0f1c\]/g, replacement: 'bg-[#f8fafc]' },
  { regex: /bg-\[#0f172a\]/g, replacement: 'bg-white' },
  { regex: /bg-black\/90/g, replacement: 'bg-white/90' },
  { regex: /bg-black\/80/g, replacement: 'bg-white/80' },
  { regex: /bg-black\/60/g, replacement: 'bg-white/60' },
  { regex: /bg-black\/40/g, replacement: 'bg-white/80' },
  { regex: /bg-black\/10/g, replacement: 'bg-gray-100' },
  { regex: /bg-black/g, replacement: 'bg-white' },
  { regex: /bg-white\/2/g, replacement: 'bg-gray-50' },
  { regex: /bg-white\/3/g, replacement: 'bg-gray-50' },
  { regex: /bg-white\/4/g, replacement: 'bg-gray-100' },
  { regex: /bg-white\/5/g, replacement: 'bg-gray-50' },
  { regex: /bg-white\/10/g, replacement: 'bg-gray-100' },
  { regex: /bg-white\/15/g, replacement: 'bg-gray-200' },
  { regex: /bg-white\/20/g, replacement: 'bg-gray-200' },
  
  // Text
  { regex: /text-white\/20/g, replacement: 'text-gray-300' },
  { regex: /text-white\/30/g, replacement: 'text-gray-400' },
  { regex: /text-white\/40/g, replacement: 'text-gray-400' },
  { regex: /text-white\/50/g, replacement: 'text-gray-500' },
  { regex: /text-white\/60/g, replacement: 'text-gray-500' },
  { regex: /text-white\/70/g, replacement: 'text-gray-600' },
  { regex: /text-white\/80/g, replacement: 'text-gray-700' },
  { regex: /text-white\/90/g, replacement: 'text-gray-800' },
  { regex: /text-white/g, replacement: 'text-gray-900' },
  
  // Hover & Active Backgrounds
  { regex: /hover:bg-white\/4/g, replacement: 'hover:bg-gray-100' },
  { regex: /hover:bg-white\/5/g, replacement: 'hover:bg-gray-100' },
  { regex: /hover:bg-white\/8/g, replacement: 'hover:bg-gray-200' },
  { regex: /hover:bg-white\/10/g, replacement: 'hover:bg-gray-200' },
  { regex: /hover:bg-white\/20/g, replacement: 'hover:bg-gray-200' },
  { regex: /active:bg-white\/6/g, replacement: 'active:bg-gray-200' },
  { regex: /active:bg-white\/8/g, replacement: 'active:bg-gray-200' },

  // Borders
  { regex: /border-white\/5/g, replacement: 'border-gray-100' },
  { regex: /border-white\/10/g, replacement: 'border-gray-200' },
  { regex: /border-white\/20/g, replacement: 'border-gray-200' },
  { regex: /border-white\/30/g, replacement: 'border-gray-300' },
  { regex: /border-white\/40/g, replacement: 'border-gray-300' },
  { regex: /border-white\/50/g, replacement: 'border-gray-400' },
  { regex: /border-white/g, replacement: 'border-gray-200' },
  { regex: /border-black/g, replacement: 'border-white' },
];

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  for (const { regex, replacement } of replacements) {
    content = content.replace(regex, replacement);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
