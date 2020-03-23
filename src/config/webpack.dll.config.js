const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const terserPlugin = require('terser-webpack-plugin');
const commonConfig = require('./webpack.config.common');

module.exports = (isDev) => {
  const webpackConfig = commonConfig(isDev);
  return webpackConfig;
};