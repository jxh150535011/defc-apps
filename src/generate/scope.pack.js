const path = require('path');
const url = require('url');
const webpack = require('webpack');
const webpackDevServer = require('webpack-dev-server');
const {BuildStateEnum, BuildTypeEnum, PackTypeEnum} = require('../enum');
const config = require('../config');
const packUtility = require('./pack.utility');
const utility = require('../../common/utility');
const genrateWebpackScopeConfig = require('./generate.webpack.scope.config');


class ScopePack {
  constructor(scopeOption, setupConfig, dllPackAssets) {
    this.name = scopeOption.name;
    this.scopeOption = scopeOption;
    this.setupConfig = setupConfig;
    this.dllPackAssets = dllPackAssets;
  }
  async getWebpackOption(entry, options) {

    const scopeOption = this.scopeOption;
    const setupConfig = this.setupConfig;

    const { registryRouterName, dllAssetsName } = setupConfig.setting;

    const {
      dir_node_modules,
    } = setupConfig;

    const loaderOption = {
      ...setupConfig.loaderOption,
      ...scopeOption.loaderOption,
    };
    
    const alias = {
      ...scopeOption.alias,
      ...setupConfig.alias
    };

    const scopes = [ scopeOption ];

    const { manifests = [] } = packUtility.composeDllPackAsset(this.dllPackAssets);
    const publicPath = (scopeOption.remote || '').replace(/\/+$/, '') + '/';// 远程服务器路径
    const packAssetFiles = packUtility.getPackAssetFiles(this.dllPackAssets, scopes, (scope, pathanme) => {
      // return scope.name + '/' + path.join(dllAssetsName, pathanme);
      return url.resolve(publicPath, path.join(dllAssetsName, pathanme));
    });

    return {
      context: scopeOption.context,
      isDev: setupConfig.isDev,
      name: scopeOption.name,
      loaderOption,
      publicPath,
      entry,
      output: scopeOption.output,
      alias,
      externals: scopeOption.externals,
      dir_node_modules,
      manifests, // 打包文件依赖关系
      deps:{ // 具体入口依赖加载关系
        [registryRouterName]: packAssetFiles[scopeOption.name]
      },
      scopes,
      ...options
    }
  }
  /**
   * 创建初始化 entry 信息
   */
  createRouterEntry(scopeOption) {
    const { registry } = scopeOption;
    if (!registry) return null;
    const routes = scopeOption.routes.map(route => {
      return {
        path: route.pathname,
        id: route.id || route.name// 暂时保留路由名称 原封不动的返回
      }
    });

    const loaderParams = {
      name: scopeOption.name,
      id: scopeOption.id,
      routes: encodeURIComponent(JSON.stringify(routes))
    };
    const entry = {
      [registry]: config.clientRouterTemplateLoaderPath + '?' + Object.keys(loaderParams).map(key => `${key}=${loaderParams[key]}`).join('&')
    }

    return entry;
  }
  /**
   * 开始编译网关代码
   * @param {*} fn 
   */
  async buildRouter(fn) {
    const scopeOption = this.scopeOption;
    const setupConfig = this.setupConfig;
    const { dllAssetsName } = setupConfig.setting;
    const entry = this.createRouterEntry(scopeOption);
    if (!entry) return ; // 没有产生entry 不进行编译router
    const webpackOption = await this.getWebpackOption(entry, {
      buildType: BuildTypeEnum.REGISTRY_MODULE
    });

    let copyOption = this.dllPackAssets.filter(p => p.name === scopeOption.name).map(dllPack => {
      return {
        from: dllPack.output,
        to: path.join(scopeOption.output, dllAssetsName),
        test: /[.]js$/
      }
    });
    const assets = scopeOption.assets;
    if(assets) {
      copyOption = copyOption.concat(Object.keys(assets).map(assetKey => {
        return {
          from: assets[assetKey],
          to: path.join(scopeOption.output, assetKey),
          test: /[.]js$/
        }
      }));
    }

    let webpackConfig = await genrateWebpackScopeConfig({
      ...webpackOption,
      copyOption,
      cleanOption:true,
      chainOption:setupConfig.chain
    });
    const buildName = '路由';
    return packUtility.webpackBuild(webpackConfig, (state, error) => {
      return fn && fn({state, error, scopeName: this.name, buildName, buildType: BuildTypeEnum.REGISTRY_MODULE, packType: PackTypeEnum.SCOPE});
    });
  }
  /**
   * 对指定的路由规则 进行编译
   * @param {*} routes 
   */
  async build(routeOption = {}, fn) {

    const {
      output,
      manifests = [],
      entry,
      filename,
      loaderOption
    } = routeOption;

    const setupConfig = this.setupConfig;

    /*
    const entry = {};
    routes.forEach(route => {
      entry[route.name] = route.file;
    });
    */
    let webpackOption = await this.getWebpackOption(entry, {
      buildType: BuildTypeEnum.MODULE
    });

    webpackOption = utility.merge(webpackOption, {
      output: output || webpackOption.output,
      loaderOption,
      manifests,
      filename
    });

    let webpackConfig = await genrateWebpackScopeConfig({
      ...webpackOption,
      chainOption:setupConfig.chain
    });
    
    let error;
    const buildName = packUtility.getBuildName(entry);
    const compilation = await packUtility.webpackBuild(webpackConfig, (state, err) => {
      error = err;
      fn && fn({state, error, scopeName: this.name, buildName, buildType: BuildTypeEnum.MODULE, packType: PackTypeEnum.SCOPE})
    });
    if(compilation === false) {
      return {
        error
      };
    }
    const entrys = await packUtility.loadEntryFile(compilation, Object.keys(entry));
    return {
      data: entrys
    }
  }
}
module.exports = ScopePack;