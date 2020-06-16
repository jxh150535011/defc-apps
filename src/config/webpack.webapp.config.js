const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const bodyParser = require('body-parser');
const commonConfig = require('./webpack.config.common');
// const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 *  new MiniCssExtractPlugin({
      filename: '[name].[hash:4].css',
      chunkFilename: '[id].[hash:4].css'
    }),
 */

module.exports = (isDev) => {
  const webpackConfig = commonConfig(isDev, {
    plugins: [
      
    ]
  });
  if(isDev) {
    return webpackMerge(webpackConfig, {
      devServer: {
        watchOptions: {// 执行自动编译
          aggregateTimeout: 300,
          poll: true,
          ignored: /node_modules/, // 忽略的文件夹
        },
        /*
        before(app) {
          app.use(bodyParser.urlencoded({
            extended:true
          }));
          app.use(bodyParser.json());
        },
        */
        historyApiFallback: {// 失败返回index.html
          rewrites: [{
            from: /.*/g,
            to: './index.html'
          }]
        }, 
        progress: true,
        // hot: true,
        // hotOnly:true, // 只开启热替换 不会自动响应
        inline: true, // 入口页面热加载
        // contentBase: appConfig.PUBLIC_PATH,
        // watchContentBase: true, // 监听 contentBase 变化
        writeToDisk:true,// 输出到硬盘上
      },
      plugins: [
        // new webpack.NamedModulesPlugin(),
        // new webpack.HotModuleReplacementPlugin(),
      ],
    });
  }
  return webpackConfig;
};;

