/* 绑定自定义域名到 GitHub Pages
 * 用法：node bind-domain.js learn-app.fuseakira.com
 * 前置：域名已注册，且已在 DNS 添加 CNAME 记录：  learn-app  ->  int-gunbot.github.io
 * 脚本会先检查解析是否生效，生效后才写入 CNAME 文件、同步仓库并开启 HTTPS。
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { execSync } = require('child_process');

const OWNER = 'INT-Gunbot';
const REPO = 'learn-app';
const ROOT = __dirname;
const TARGET = 'int-gunbot.github.io';
const domain = process.argv[2];

if (!domain) { console.log('用法：node bind-domain.js 你的域名'); process.exit(1); }

(async () => {
  console.log('检查 ' + domain + ' 的解析…');
  let cnames = [];
  try { cnames = await dns.resolve(domain, 'CNAME'); } catch (e) { /* 未解析 */ }
  const ok = cnames.some(c => c.replace(/\.$/, '').toLowerCase().includes(TARGET));
  if (!ok) {
    console.log('× 还没生效。请到你的域名商后台添加解析记录：');
    console.log('   类型  CNAME');
    console.log('   主机  ' + (domain.split('.')[0]));
    console.log('   目标  ' + TARGET);
    console.log('生效通常 1-30 分钟，之后重新运行本脚本。');
    process.exit(1);
  }
  console.log('√ 解析已生效：' + cnames.join(', '));

  fs.writeFileSync(path.join(ROOT, 'CNAME'), domain + '\n');
  execSync('node deploy-gh.js "绑定自定义域名 ' + domain + '"', { cwd: ROOT, stdio: 'inherit', shell: true });

  const cmd = `gh api -X PUT repos/${OWNER}/${REPO}/pages -f cname=${domain} -f https_enforced=true`;
  execSync(cmd, { stdio: 'inherit', shell: true });

  console.log('\n完成。访问 https://' + domain + ' （HTTPS 证书签发需几分钟到 1 小时）。');
  console.log('若提示证书未就绪，稍等后到 GitHub 仓库 Settings → Pages → Enforce HTTPS 再勾一次。');
})();
