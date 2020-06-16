const path = require('path');

const packageWebpackLoaderPath = require.resolve('../loaders/webpack.package.loader.js');
const tsconfigPath = path.join(__dirname, './tsconfig.json');

const libraryAntdStyleOption = {
  libraryName: 'antd',
  libraryDirectory: 'es',
  style: true, // `style: true` 会加载 less 文件
}

module.exports = {
  output: path.join(__dirname, '../../dist'),
  libs: [
    'react',
    'react-dom',
    'react-router',
    'react-router-dom',
    'redux',
    'react-use',
    'antd'
  ],
  webapp: {
    context: path.join(__dirname, '../gateway'),
    entry: {
      index: './src/index.jsx',
      sandbox: './src/sandbox.jsx'
    },
    template: {
      index: './src/index.html',
      sandbox: {
        template: './src/sandbox.html'
      }
    },
    contentBase: path.join(__dirname, '../public'),
    assets: {
      '/static': path.join(__dirname, '../static')
    }
  },
  registry: { // 注册到网关 registry
    '@scope': `http://abc.com/abc`
  },
  loaderOption: {
    'ts-loader':{
      context: path.dirname(tsconfigPath),
      configFile: tsconfigPath,
      /*
      getCustomTransformers: () => ({
        before: [tsImportPlugin(libraryAntdStyleOption)]
      })
      */
    },
    'less-loader':{
      javascriptEnabled: true
    },
    'babel-loader': {
      plugins: [
        [
          // babel-plugin-import
          'import', libraryAntdStyleOption
        ]
      ]
    },
  },
  process: { // 执行
    '@scope': {
      context: __dirname,
      libs: [ 'react' ],
      assets: {
        '/pages': path.join(__dirname, '../../dist/pages')
      },
      routes: [
        ['/pages/index', './src/index.jsx'],
        ['/pages/about', './src/about.jsx'],
        ['/pages/typescript', './src/typescript.tsx'],
        ['/pages/package.json', '../../package.json']
      ],
    }
  },
  chain(webpackConfig, buildType) {
    // setup.BuildTypeEnum MODULE WEBAPP DLL
    if(!webpackConfig.module) webpackConfig.module = {};
    if(!webpackConfig.module.rules) webpackConfig.module.rules = [];
    // 对package 进行解析
    webpackConfig.module.rules = [
      {
        test: /package\.json$/,
        exclude: /node_modules|bower_components/,
        use: {
          loader: packageWebpackLoaderPath
        },
      },
      {
        test: /\.(md|txt)$/,
        exclude: /node_modules|bower_components/,
        use: [
          {
            loader: "raw-loader",
          },
        ],
      },
    ].concat(webpackConfig.module.rules);
    return webpackConfig;
  },
}