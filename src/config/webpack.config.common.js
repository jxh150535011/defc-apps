const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpackModuleOption = require('./webpackModuleOption');
const { root, cwd } = require('./env');

// webpack 动态加载器路径
const dynamicWebpackLoaderPath = path.resolve(__dirname, '../loaders/webpack.dynamic.loader.js');
const antdDir = path.resolve(require.resolve('antd'), '../../');
// loader 部分包 因为依赖问题 可能不存在执行环境目录下，所以统一改成路径下寻找

const WebpackTestPlugin = require('../plugins/webpack.test.plugin.js');

const createWebpackConfig = () => {
  return {
    mode: 'production',
    devtool: false,
    resolve: { // mainFields: ['browser', 'main', 'module']
      extensions: ['.js', '.jsx','.json', '.ts', '.tsx']
    },
    entry: {},
    output: {
      filename: '[name].[hash:4].js',
      chunkFilename: '[name].[hash:4].chunk.js',
    },
    optimization: {
      splitChunks: {
        minChunks: 2, // CommonsChunkPlugin被弃置，使用splitChunks替代
      },
    },
    module: {
      strictExportPresence: true, // 使缺少的导出出现错误而不是警告
      rules: [
        {
          test: /\.less$/,// |scss
          include:[
            antdDir
          ],
          use: [
            webpackModuleOption.modules['style-loader'],
            webpackModuleOption.modules['css-loader'],
            webpackModuleOption.modules['less-loader'],
            // ,'sass-loader' 'postcss-loader'
          ],
        },
        {
          test: /\.less$/,// |scss
          exclude:[
            antdDir
          ],
          use: [
            // {
            //   loader: webpackModuleOption.modules['file-loader'],
            //   options: {
            //     name: 'assets/[name].[ext]',
            //   },
            // },
            // webpackModuleOption.modules['extract-loader'],
            webpackModuleOption.modules['style-loader'],
            {
              loader: webpackModuleOption.modules['css-loader'],
              options: {
                  modules: true,
              },
            },
            webpackModuleOption.modules['less-loader'],
          ],
        },
        {
          test: /\.css$/,
          use: [
            // {
            //   loader: MiniCssExtractPlugin.loader,
            // },
            webpackModuleOption.modules['style-loader'],
            webpackModuleOption.modules['css-loader'],
          ]
        },
        {
          test: /\.js$/,// template 中的文件特殊处理
          exclude: [
            /node_modules|bower_components/,
            path.resolve(root, './template')
          ],
          use: {
            loader: webpackModuleOption.modules['babel-loader'],
            options: webpackModuleOption.babelLoaderOption,
          },
        },
        {
          test: /\.jsx$/,// 所有的jsx文件 都进行转换 不做依赖排除
          use: {
            loader: webpackModuleOption.modules['babel-loader'],
            options: webpackModuleOption.babelLoaderOption,
          },
        },
        {
          test: /\.(ts|tsx)$/,
          use: [
            {
              loader: webpackModuleOption.modules['babel-loader'],
              options: webpackModuleOption.babelLoaderOption,
            },{
              loader:  webpackModuleOption.modules['ts-loader'],
            }
          ]
        },
        {
          test: /([/\\]template[/\\]entry[/\\][^/\\]*?\.js)$/,
          include: path.resolve(root, './template'),
          use: {
            loader: webpackModuleOption.modules['babel-loader'],
            options: webpackModuleOption.babelLoaderOption,
          },
        },
        {
          test: /([/\\]template[/\\]loaders[/\\][^/\\]*?\.tpl)$/,
          include: path.resolve(root, './template'),
          use: [
            {
              loader: webpackModuleOption.modules['babel-loader'],
              options: webpackModuleOption.babelLoaderOption,
            },{
              loader:  dynamicWebpackLoaderPath,
            }
          ]
        },
        {
          test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
          exclude: /node_modules|bower_components/,
          use: webpackModuleOption.modules['file-loader'],
        },
        {
          test: /\.woff2?(\?v=\d+\.\d+\.\d+)?$/,
          exclude: /node_modules|bower_components/,
          use: `${webpackModuleOption.modules['url-loader']}?limit=10000&minetype=application/font-woff`,
        },
        {
          test: /\.(ttf|otf)(\?v=\d+\.\d+\.\d+)?$/,
          exclude: /node_modules|bower_components/,
          use: `${webpackModuleOption.modules['url-loader']}?limit=10000&minetype=application/octet-stream`,
        },
        {
          test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
          exclude: /node_modules|bower_components/,
          use: `${webpackModuleOption.modules['url-loader']}?limit=10000&minetype=image/svg+xml`,
        },
        {
          test: /\.(jpe?g|png|gif|svg)$/i,
          exclude: /node_modules|bower_components/,
          use: `${webpackModuleOption.modules['url-loader']}?limit=8192&name=[path][name].[hash:12].[ext]`,
        },
      ],
    },
    plugins: [
      new WebpackTestPlugin(),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV':JSON.stringify(process.env.NODE_ENV),
        'process.env.BABEL_ENV':JSON.stringify(process.env.BABEL_ENV)
      }),
      new webpack.BannerPlugin({
        banner: `hash:[hash], lastmodify:${new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString()}\r\n`,
      }),
      // new MiniCssExtractPlugin({
      //   filename: '[name].css',
      //   chunkFilename: '[id].css',
      // }),
    ],
    externals: []
    /**
    function(context, request, callback) {
      return callback();
      // console.log('\n',request');
      if(!/^@sync/.test(request)) {
        return callback();
      }
      return callback(null, 'commonjs ' + request);
    }
    */
  }
};
const webpackConfig = createWebpackConfig();
module.exports = (isDev, options = {}) => {
  if(isDev) {
    return webpackMerge(webpackConfig, {
      mode: 'development',
      devtool: 'inline-source-map',
    }, options);
  }
  return webpackMerge(webpackConfig, {
    optimization: {
      minimizer: [
        new TerserPlugin(),
        new OptimizeCSSAssetsPlugin({})
      ],
    },
  }, options);
}