const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
// const uglifyJsPlugin = require('uglifyjs-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const commonConfig = require('./webpack.config.common.js');

const webpacConfig = webpackMerge(commonConfig, {
  optimization: {
    minimizer: [
      new TerserPlugin(),
      new OptimizeCSSAssetsPlugin({})
    ],
    splitChunks: {
      minChunks:2
    },
  },
});
module.exports = webpacConfig;