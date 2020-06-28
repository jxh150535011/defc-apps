const url = require('url');
const path = require('path');
const webpack = require('webpack');
const webpackDevServer = require('webpack-dev-server');
const {BuildStateEnum, BuildTypeEnum} = require('../enum');
const config = require('../config');
const utility = require('../../common/utility');
const packUtility = require('./pack.utility');
const genrateWebpackWebappConfig = require('./generate.webpack.webapp.config');

class WebappPack {
  
  constructor(scopeConfig, setupConfig, dllPack, middleware) {
    this.scopeConfig = scopeConfig;
    this.setupConfig = setupConfig;
    this.dllPack = dllPack;
    this.middleware = middleware;
  }

  converToTemplates(template) {
    let templates = [];
    if (typeof template === 'string') {
      // 默认 filename: 'index.html',
      templates.push({
        template
      });
    } else if (typeof template === 'object'){
      templates = Object.keys(template).map(name => {
        const value = (typeof template[name] === 'string') ? {template: template[name]} : template[name];
        return {
          filename: `${name}.html`,
          ...value
        }
      })
    } else if (template instanceof Array){
      templates = template.map(value => {
        return (typeof value === 'string') ? {template: value} : value;
      });
    }
    return templates;
  }

  async getWebpackOption(options) {

    const setupConfig = this.setupConfig;
    const {
      dir_node_modules,
      setting,
    } = setupConfig;

    const webappConfig = setupConfig.webapp;
    const gatewayScopeOption = setupConfig.gateway;

    // 当前自身的 scopeConfig 配置
    const scopeConfig = this.scopeConfig;


    const { dllAssetsName } = setupConfig.setting;
    // 当前打包dll 文件资源
    const dllPackAsset = await this.dllPack.getAsset();
    const dllPackAssets = [dllPackAsset];

    const { manifests } = packUtility.composeDllPackAsset(dllPackAssets);

    const loaderOption = {
      ...setupConfig.loaderOption,
      ...gatewayScopeOption.loaderOption,
    };

    const alias = {
      ...gatewayScopeOption.alias,
      ...setupConfig.alias
    };

    const publicPath = (gatewayScopeOption.remote || '').replace(/\/+$/, '') + '/';// 远程服务器路径
    const gatewayPackAssetFiles = packUtility.getPackAssetFiles(dllPackAssets, [scopeConfig], (scope, pathanme) => {
      return url.resolve(publicPath, path.join(dllAssetsName,pathanme));
    });

    const htmlOption = {
      templates: this.converToTemplates(webappConfig.template),
      assets: gatewayPackAssetFiles[scopeConfig.name],
    };

    return {
      context: gatewayScopeOption.context,
      name: gatewayScopeOption.name,
      isDev: setupConfig.isDev,
      loaderOption,
      publicPath,
      entry: webappConfig.entry,
      output: webappConfig.output,
      alias,
      externals: gatewayScopeOption.externals,
      dir_node_modules,
      manifests,
      scopes: setupConfig.scopes || [], // 注入scopes
      htmlOption,
      ...options
    }
  }

  async config() {
    const setupConfig = this.setupConfig;
    const webappConfig = this.setupConfig.webapp;
    const { dllAssetsName } = setupConfig.setting;
    const { output } = webappConfig;

    const webpackOption = await this.getWebpackOption({
      buildType: BuildTypeEnum.WEBAPP,
    });
    
    const devOption = {
      port:webappConfig.port,
      host:webappConfig.host,
      contentBase:webappConfig.contentBase,
      middleware:this.middleware,
      devServer:webappConfig.devServer
    };

    /** 拷贝资源关系 */
    let copyOption = [ this.dllPack ].map(dllPack => {
      return {
        from: dllPack.output,
        to: path.join(webappConfig.output, dllAssetsName),
        test: /[.]js$/
      }
    });
    if(webappConfig.assets) {
      copyOption = copyOption.concat(Object.keys(webappConfig.assets).map(assetKey => {
        return {
          from: webappConfig.assets[assetKey],
          to: path.join(output, assetKey),
          test: /[.]js$/
        }
      }));
    }
    if(!webpackOption.isDev && devOption.contentBase) {
      // 非dev 模式下 将contentBase内容输出
      copyOption.push({
        from: devOption.contentBase,
        to: output
      });
    }

    
    // 开始打包编译
    const webpackConfig = await genrateWebpackWebappConfig({
      ...webpackOption,
      devOption,
      copyOption, // 资源地址项
      chainOption:setupConfig.chain
    });
    return webpackConfig;
  }
  async webpackDev(webpackConfig, fn = () => {}) {
    fn(BuildStateEnum.START);
    try {
      const { devServer } = webpackConfig;
      const {host, port} = devServer;
      webpackDevServer.addDevServerEntrypoints(webpackConfig, devServer);
      const compiler = webpack(webpackConfig);
      const devServerHandler = new webpackDevServer(compiler, devServer);
      return new Promise((resolve, reject) => {
        devServerHandler.listen(port, host, (error, handler) => {
          if(error) {
            fn(BuildStateEnum.ERROR, error);
            return resolve(false);
          }
          resolve(true);
        });
      });
    } catch(e) {
      fn(BuildStateEnum.ERROR, e);
      return false;
    }
  }
  async start(fn) {
    const webpackConfig = await this.config();
    /*
    const webpackConfig2 = require('../../config/webpack.config');
    webpackConfig.module.rules = webpackConfig2.module.rules;
    webpackConfig.plugins = webpackConfig2.plugins;
    webpackConfig.node = webpackConfig2.node;
    webpackConfig.output = webpackConfig2.output;
    webpackConfig.devServer = webpackConfig2.devServer;
    webpackConfig.resolve.extensions = webpackConfig2.resolve.extensions;
    webpackConfig.resolve.alias = webpackConfig2.resolve.alias;
    webpackConfig.resolve.modules = webpackConfig2.resolve.modules;
    console.log(webpackConfig.resolve.modules, webpackConfig2.resolve.modules);
    */

    return this.webpackDev(webpackConfig, (state, error) => {
      fn && fn({state, error});
    });
  }
  async build(fn) {
    const webpackConfig = await this.config();
    const compilation = await packUtility.webpackBuild(webpackConfig, (state, error) => {
      fn && fn({state, error});
    })
    return compilation;
  }
}
module.exports = WebappPack;