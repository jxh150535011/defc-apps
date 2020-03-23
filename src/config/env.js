const path = require('path');
const root = path.join(__dirname, '../../');// 当前架构内部 内部根目录
const cwd = process.cwd();// 应用执行目录位置
const meta = path.resolve(root, './package.json');

module.exports = {
  meta,
  version: meta.version + '-1.0.0',
  root,
  cwd,
  host: '127.0.0.1',
  port: 7001
}