/**
 * 暴露babel所有的引用关系
 */


const moduleNames = [
  'babel-loader', 'ts-loader', 'file-loader','url-loader', 'mini-css-extract-plugin', // , 'extract-loader' ,'extracted-loader',
  '@babel/preset-env', '@babel/preset-react',
  '@babel/plugin-proposal-decorators', '@babel/plugin-transform-runtime',
  '@babel/plugin-syntax-dynamic-import', '@babel/plugin-syntax-import-meta',
  '@babel/plugin-proposal-class-properties', '@babel/plugin-proposal-json-strings',
  '@babel/plugin-proposal-function-sent', '@babel/plugin-proposal-export-namespace-from',
  '@babel/plugin-proposal-numeric-separator', '@babel/plugin-proposal-throw-expressions',
  'style-loader', 'css-loader', 'less-loader',
];

const modules = moduleNames.reduce((memo, name) => {
  memo[name] = require.resolve(name);
  return memo;
}, {});

const babelLoaderOption = {
  // 等价于.babelrc 配置
  presets: [
    modules['@babel/preset-env'],
    modules['@babel/preset-react']
  ],
  plugins: [
    [
      modules['@babel/plugin-proposal-decorators'], { legacy: true }
    ],
    modules['@babel/plugin-transform-runtime'],
    modules['@babel/plugin-syntax-dynamic-import'],
    modules['@babel/plugin-syntax-import-meta'],
    [
      modules['@babel/plugin-proposal-class-properties'], { loose: true }
    ],
    modules['@babel/plugin-proposal-json-strings'],
    modules['@babel/plugin-proposal-function-sent'],
    modules['@babel/plugin-proposal-export-namespace-from'],
    modules['@babel/plugin-proposal-numeric-separator'],
    modules['@babel/plugin-proposal-throw-expressions'],
  ],
  cacheDirectory: true, // 启动缓存
};


module.exports = {
  babelLoader: {
    loader: modules['babel-loader'],
    options: babelLoaderOption,
  },
  babelLoaderOption,
  modules
}