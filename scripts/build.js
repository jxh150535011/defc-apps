process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const setup = require('../src/setup');

const start = async () => {
  
  const instance = await setup.load('./test/service'); // 相对于cwd 目录下 加载配置文件
  instance.log('准备开始编译');
  instance.build();
};

start();