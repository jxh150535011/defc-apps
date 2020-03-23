const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const commonConfig = require('./webpack.config.common');

module.exports = (isDev) => {
  const webpackConfig = commonConfig(isDev);
  if(isDev) {
    return webpackMerge(webpackConfig, {
      plugins: [
        // new webpack.NamedModulesPlugin(),
        // new webpack.HotModuleReplacementPlugin(),
      ],
    });
  }
  return webpackConfig;
};;
