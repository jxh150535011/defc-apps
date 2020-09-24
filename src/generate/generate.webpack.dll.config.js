const path = require('path');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const config = require('../config');
const packUtility = require('./pack.utility');
const WebpackLibPlugin = require('../plugins/webpack.lib.plugin.js');
const {BuildStateEnum, BuildTypeEnum} = require('../enum');
const webpackModuleOption = require('../config/webpackModuleOption');

const updateEntryLibrary = (library, webpackConfig, webpackOption) => {

  const {
    output,
    dir_node_modules, externals, buildType,context
  } = webpackOption;

  let libraryTarget = 'var';
  let filename = `[name].js`;// _[hash:4]
  return webpackMerge(webpackConfig,{
    context,
    output: {
      path: output,
      filename,
      library,
      libraryTarget
    },
    resolve: {
      modules: dir_node_modules
    },
    externals
  })
}


module.exports = async function (webpackOption) {

  const {
    name,// libraryName 前缀使用
    entry,output,
    chainOption,
    loaderOption,
    dllPackAssets = [], buildType
  } = webpackOption;

  // 增加name 防止 类名冲突
  let library = name ? `${name}`: `[name]_[hash:4]`;

  const { manifests } = packUtility.composeDllPackAsset(dllPackAssets);


  // umd 模式的依赖的 默认都会直接使用 var 形式注入
  let webpackConfig = config.webpackDllConfig(webpackOption.isDev);
  webpackConfig = updateEntryLibrary(library, webpackConfig, webpackOption);
  console.log(111, entry, webpackConfig.externals);
  const plugins = webpackConfig.plugins || []; // 设置 plugins dll
  webpackConfig.plugins = plugins.concat([
    ...manifests.map(file => {
      // const filename = path.basename(file, '.manifest.json');
      return new webpack.DllReferencePlugin({
        sourceType:'var',
        manifest: file
      })
    }),
  ]);

  if(buildType === BuildTypeEnum.LIB) {
    // 需要设置一个空置的 entry 用于替代
    webpackConfig.entry = {
      empty: config.clientEmptyPath
    };
    webpackConfig.plugins = webpackConfig.plugins.concat([
      new WebpackLibPlugin({ // 对Lib DLL 信息做整体信息输出
        entry
      }),
    ]);
  } else if(buildType === BuildTypeEnum.DLL) {
    webpackConfig.entry = entry;
    webpackConfig.plugins = webpackConfig.plugins.concat([
      new webpack.DllPlugin({
        name: library,
        path: path.join(output, '[name].manifest.json') // .[hash:4]
      }),
      new WebpackLibPlugin({}),
    ]);
  } else if(buildType === BuildTypeEnum.ENTRY){
    webpackConfig.entry = entry;
    webpackConfig.plugins = webpackConfig.plugins.concat([
      new WebpackLibPlugin({}),
    ]);
  } else {
    webpackConfig.entry = entry;
  }
  if(loaderOption) {
    webpackConfig = packUtility.upadateWebpackLoaderOption(webpackConfig, loaderOption) || webpackConfig;
  }
  if(chainOption) {
    webpackConfig = chainOption(webpackConfig, webpackOption.buildType, webpackModuleOption) || webpackConfig;
  }



  return webpackConfig;
}