const path = require('path');
const url = require('url');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const config = require('../config');
const packUtility = require('./pack.utility');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const WebpackHtmlDllPlugin = require('../plugins/webpack.html.dll.plugin.js');
const webpackModuleOption = require('../config/webpackModuleOption');

const upadateWebpackDevServer = (webpackConfig, webpackOption , devOption) => {
  const {scopes = []} = webpackOption;
  const {host, port, contentBase} = devOption || {};
  webpackConfig = webpackMerge(webpackConfig, {
    devServer:{
      host,
      port,
      contentBase:contentBase
    },
  });

  // 注入开发拦截 中间件
  packUtility.setDevServerMiddleware(webpackConfig, devOption.middleware);
  
  return webpackConfig;
}

/**
 * 更新webpack html plugin
 */
const updateWebpackHtmlPluginOption = (webpackConfig, webpackOption, htmlOption) => {
  const {output} = webpackOption;
  const {template, assets = []} = htmlOption || {};
  const proxyWebpackHtmlPluginTemplateParameters = (templateParameters, context) => {
    // templateParameters, context
    if(typeof templateParameters === 'function') {
      return function templateParametersGenerator(compilation, assets, options) {
        return {
          ...templateParameters(compilation, assets, options),
          ...context
        }
      }
    }
    return {
      ...templateParameters,
      ...context
    }
  }
  // 调整 HtmlWebpackPlugin 配置
  let htmlWebpackPlugin = (webpackConfig.plugins || []).find(p => p instanceof HtmlWebpackPlugin);
  if(!htmlWebpackPlugin) return;
  const htmlWebpackPluginOptions = htmlWebpackPlugin.options;
  htmlWebpackPluginOptions.templateParameters = proxyWebpackHtmlPluginTemplateParameters(htmlWebpackPluginOptions.templateParameters, {
    meta: {
      title:htmlWebpackPluginOptions.title
    }
  });
  if(template) {
    htmlWebpackPluginOptions.template = template;
  }

  // 添加自身相关的依赖内容
  if(assets.length) {
    webpackConfig.plugins = (webpackConfig.plugins || []).concat(
      new WebpackHtmlDllPlugin({// 补充需要插入的资源文件
        files: assets
      })
    );
  }
};


const updateCleanPlugin = (webpackConfig, webpackOption) => {
  const { output } = webpackOption;
  webpackConfig.plugins = [
    new CleanWebpackPlugin({
      output
    }),
  ].concat(webpackConfig.plugins || []);
}

const updateDllPlugin = (webpackConfig, webpackOption) => {

  const { manifests, output, copyOption } = webpackOption;

  let plugins = webpackConfig.plugins || [];

  plugins = plugins.concat([
    ...manifests.map(file => {
      // const filename = path.basename(file, '.manifest.json');
      return new webpack.DllReferencePlugin({
        manifest: file
      })
    })
  ])

  if(copyOption && copyOption.length) {
    // 拷贝所有的js 文件，都出于可访问状态
    plugins.push(new CopyWebpackPlugin(copyOption));
  }
  webpackConfig.plugins = plugins;
};

const updateDefaultWebpackOption = (webpackConfig, webpackOption) => {

  const {
    output, publicPath, entry, alias, dir_node_modules,
    context,
  } = webpackOption;

  webpackConfig = webpackMerge(webpackConfig, {
    context,
    output: {
      path: output,
      publicPath,
    },
    resolve: {
      alias,
      modules: dir_node_modules
    },
    entry,
  });

  return webpackConfig;
};


/**
 * webpackOption => web
 */
module.exports = async function (webpackOption) {
  const {
    // output, publicPath, entry, alias,
    // assets = [],
    // dir_node_modules, isDev, buildType,
    isDev,
    externals,
    devOption,
    htmlOption,
    chainOption,
    loaderOption
  } = webpackOption;

  let webpackConfig = config.webpackWebappConfig(isDev);

  webpackConfig = updateDefaultWebpackOption(webpackConfig, webpackOption);

  if(devOption) {
    // 如果是开发模式  则注入 中间件
    webpackConfig = upadateWebpackDevServer(webpackConfig, webpackOption, devOption);
  }

  // 更新清空插件
  updateCleanPlugin(webpackConfig, webpackOption);

  if(htmlOption) {
    // 调整 webpack html pulgin 配置
    updateWebpackHtmlPluginOption(webpackConfig, webpackOption, htmlOption);
  }

  // 配置dll config
  updateDllPlugin(webpackConfig, webpackOption);

  // 设置全局 externals
  webpackConfig.externals = (externals || []).concat(webpackConfig.externals || []);

  if(chainOption) {
    webpackConfig = chainOption(webpackConfig, webpackOption.buildType, webpackModuleOption) || webpackConfig;
  }
  if(loaderOption) {
    webpackConfig = packUtility.upadateWebpackLoaderOption(webpackConfig, loaderOption) || webpackConfig;
  }


  return webpackConfig;
}