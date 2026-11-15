// Export the local guide with Chromium's tagged-PDF and outline support.
// Dependencies: npm install playwright; npx playwright install chromium
// Python dependency: python3 -m pip install pypdf
// Run: node scripts/print_field_guide.mjs
// Optional overrides: PLAYWRIGHT_MODULE (package name or absolute module path),
// CHROME_EXECUTABLE (installed browser), PYTHON_EXECUTABLE (default python3).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await mkdtemp(path.join(tmpdir(),'metcalf-field-guide-'));
const printInput=path.join(temporary,'print.html');
const python=process.env.PYTHON_EXECUTABLE || 'python3';
function generate(...args){
  const result=spawnSync(python,[path.join(root,'scripts/build_field_guide.py'),...args],{encoding:'utf8'});
  if(result.error || result.status!==0) throw new Error(result.error?.message || result.stderr || 'Guide generation failed');
}
let browser;
try {
  generate('--print-only','--print-output',printInput);
  browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {}),headless:true});
  const page=await browser.newPage();
  await page.goto(pathToFileURL(printInput).href);
  await page.emulateMedia({media:'print'});
  await page.pdf({path:path.join(root,'stack-field-guide.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
  generate('--finalize-pdf');
  console.log('Exported stack-field-guide.pdf with tags and outlines.');
} finally {if(browser) await browser.close();await rm(temporary,{recursive:true,force:true});}
