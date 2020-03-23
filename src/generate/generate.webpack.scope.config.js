const path = require('path');
const url = require('url');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');

const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const config = require('../config');
const packUtility = require('./pack.utility');
const WebpackLibPlugin = require('../plugins/webpack.lib.plugin.js');
const WebpackScopeModulePlugin = require('../plugins/webpack.scope.module.plugin.js');
const {BuildStateEnum, BuildTypeEnum} = require('../enum');
const webpackModuleOption = require('../config/webpackModuleOption');




const updateDllPlugin = (webpackConfig, webpackOption) => {
  const { output, scopes = [], copyOption , deps = {}, manifests = [] } = webpackOption;
  let plugins = webpackConfig.plugins || [];
  
  plugins = plugins.concat([
    ...manifests.map(file => {
      return new webpack.DllReferencePlugin({
        sourceType:'var', // sourceType 的值  会根据  externals 的映射 来进行如何 加载
        manifest: file
      })
    }),
  ]);


  if(copyOption && copyOption.length) {
    // 拷贝所有的js 文件，都出于可访问状态
    plugins.push(new CopyWebpackPlugin(copyOption));
  }
  plugins.push(new WebpackScopeModulePlugin({deps})); // deps {[entry]:[files]}

  webpackConfig.plugins = plugins;
};

const updateDefaultWebpackOption = (webpackConfig, webpackOption) => {
  const {
    name,// libraryName 前缀使用
    publicPath,// 路径加载前缀地址
    alias,
    modules, output, entry, context,
    dir_node_modules, externals, buildType
  } = webpackOption;

  let filename = webpackOption.filename || `[name]_[hash:4].js`;

  // 给每个对象都设置类名 为将来全局加载唯一做分类
  let library = `__[name]_[hash:4]`;// 增加 __ 防止变量命名错误
  let libraryTarget = 'var';
  /**
   * amd 模式 默认会对 引用到的 library  初始化define 关联，具体应用的地方 会根据 DllReferencePlugin 来判断
   * 例如 引用了 jquery ,jquery 暴露 全局字段名称 jQuery 在 externals 设定，文件内容在lib_jquery中
   * 上述情况会创建 defind('jQuery')  ,应用的地方 会根据 externals 设定 引用
   */
  if(buildType === BuildTypeEnum.REGISTRY_MODULE) {
    filename = `[name].js`;
  }
  /*
  externals: [
    {
      'requirejs':'requirejs'
    },
    function(context, request, callback) {
      return callback();
    }
  ]
  */
  // umd 模式的依赖的 默认都会直接使用 var 形式注入
  return webpackMerge(webpackConfig, {
    context,
    output: {
      path: output,
      filename,
      library,
      libraryTarget,
      publicPath,
    },
    entry,
    resolve: {
      modules: dir_node_modules,
      alias
    },
    externals // return callback(null, 'commonjs ' + request);
  });
};

const updateCleanPlugin = (webpackConfig, webpackOption) => {
  const { output } = webpackOption;
  webpackConfig.plugins = [
    new CleanWebpackPlugin({
      output
    }),
  ].concat(webpackConfig.plugins || []);
}


module.exports = async function (webpackOption) {

  const {
    cleanOption,
    chainOption,
    loaderOption
  } = webpackOption;
  let webpackConfig = config.webpackScopeConfig(webpackOption.isDev);
  webpackConfig = updateDefaultWebpackOption(webpackConfig, webpackOption);

  if(cleanOption) {
    // 更新清空插件
    updateCleanPlugin(webpackConfig, webpackOption);
  }
  updateDllPlugin(webpackConfig, webpackOption);

  if(chainOption) {
    webpackConfig = chainOption(webpackConfig, webpackOption.buildType, webpackModuleOption) || webpackConfig;
  }
  if(loaderOption) {
    webpackConfig = packUtility.upadateWebpackLoaderOption(webpackConfig, loaderOption) || webpackConfig;
  }
  
  return webpackConfig;
}