/* 打包脚本：把 index.html + assets/* 内联成一个单文件 HTML
 * 用法：在本目录执行  node build.js
 * 产物：dist/learn-app-离线版.html（可直接双击打开、发微信、用手机浏览器打开）
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = path.join(root, 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 1. 内联 CSS
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

// 2. 内联 JS
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  return '<script>\n' + js + '\n</script>';
});

// 3. 移除 PWA manifest（单文件离线场景用不上，避免 404）
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');

const out = path.join(outDir, 'learn-app-离线版.html');
fs.writeFileSync(out, html, 'utf8');

const kb = fs.readFileSync(path.join(root, 'assets', 'data-english.js'), 'utf8') +
  fs.readFileSync(path.join(root, 'assets', 'data-pm.js'), 'utf8');
console.log('已生成：' + out);
console.log('体积：' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
console.log('内置卡片数：约 ' + (kb.split(/\n\s*\{ f:/).length - 1) + ' 张');
