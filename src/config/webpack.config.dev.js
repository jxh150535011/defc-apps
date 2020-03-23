const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const commonConfig = require('./webpack.config.common');

const webpackConfig = webpackMerge(commonConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {},
  output: {},

});
module.exports = webpackConfig;
