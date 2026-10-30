/* 部署脚本：把当前目录的静态文件同步到 GitHub 仓库，Pages 会自动重新上线
 * 用法：node deploy-gh.js "提交说明"
 * 说明：本机 git 的 https 通道可能被代理拦截，所以这里改用 GitHub API（gh 命令）提交。
 *      默认不上传 dist/（离线单文件版只在本机用）。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const OWNER = 'INT-Gunbot';
const REPO = 'learn-app';
const BRANCH = 'main';
const ROOT = __dirname;
const EXCLUDE = [/^dist\//, /^\.git\//, /^node_modules\//];

const message = process.argv[2] || '更新应用';

function walk(dir, base) {
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    if (['.git', 'node_modules'].includes(name)) continue;
    const full = path.join(dir, name);
    const rel = (base ? base + '/' : '') + name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const files = walk(ROOT, '').filter(f => !EXCLUDE.some(re => re.test(f)));
const gh = (endpoint, method, body) => {
  const cmd = `gh api repos/${OWNER}/${REPO}/${endpoint} -X ${method}` + (body ? ' --input -' : '');
  const out = execSync(cmd, { input: body ? JSON.stringify(body) : '', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true });
  return out ? JSON.parse(out) : {};
};

// 1. 远端文件 hash
const remoteTree = gh(`git/trees/${BRANCH}?recursive=1`, 'GET');
const remote = {};
(remoteTree.tree || []).forEach(t => { if (t.type === 'blob') remote[t.path] = t.sha; });

// 2. 找出变更（git blob sha1 算法）
const changes = [];
files.forEach(f => {
  const buf = fs.readFileSync(path.join(ROOT, f));
  const sha = crypto.createHash('sha1').update(Buffer.from('blob ' + buf.length + '\0')).update(buf).digest('hex');
  if (remote[f] !== sha) changes.push({ path: f, content: buf.toString('utf8'), sha });
});

if (!changes.length) { console.log('没有文件变化，无需同步。'); process.exit(0); }
console.log('变更文件：' + changes.map(c => c.path).join(', '));

// 3. 建 tree
const tree = gh('git/trees', 'POST', {
  base_tree: remoteTree.sha,
  tree: changes.map(c => ({ path: c.path, mode: '100644', type: 'blob', content: c.content }))
});

// 4. 建 commit
const parent = gh(`git/refs/heads/${BRANCH}`, 'GET').object.sha;
const commit = gh('git/commits', 'POST', { message, tree: tree.sha, parents: [parent] });

// 5. 移动分支指针
gh(`git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha });

console.log('已同步到 https://github.com/' + OWNER + '/' + REPO + ' （' + commit.sha.slice(0, 7) + '）');
console.log('Pages 会在 1-2 分钟内重新部署');
