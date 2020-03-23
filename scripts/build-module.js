process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const path = require('path');
const setup = require('../src/setup');

const root = path.join(__dirname, '../');

const start = async () => {
  const instance = await setup.load('./test/service'); // 相对于cwd 目录下 加载配置文件
  // 独立的build 某一个路由模块
  const scope = instance.scope('@scope');
  await scope.build({
    output: path.join(root, './dist/pages'),
    context: path.join(root, './test/service'),
    manifests: [
      path.join(root, './dist/cache/webapp/dll/client_core.manifest.json'),
      path.join(root, './dist/cache/webapp/dll/lib.manifest.json'),
      path.join(scope.output, './dll/lib.manifest.json')
    ],
    filename:'[name].js',
    entry: {
      demo: './src/demo.tsx'
    }
  });
};

start();