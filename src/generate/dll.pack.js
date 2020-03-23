const path = require('path');
const webpack = require('webpack');
const utility = require('../common/utility');
const WebpackLibPlugin = require('../plugins/webpack.lib.plugin.js');
const genrateWebpackDllConfig = require('./generate.webpack.dll.config');
const packUtility = require('./pack.utility');
const {BuildStateEnum, BuildTypeEnum} = require('../enum');


/**
 * dll 打包管理类
 */
class DllPack {
  /**
   * {output, webpackGroups : [{ id type modules manifests }], name} 
   * @param {*} dllConfig ,
   * @param {*} settingOption , {externals, dir_node_modules}
   */
  constructor(dllConfig, settingOption, dllPackAssets) {
    this.settingOption = settingOption;
    this.cacheFileName = 'pack.manifest.json.config';
    this.cacheFile = path.join(dllConfig.output, this.cacheFileName);
    this.output = dllConfig.output;
    this.name = dllConfig.name || '';
    this.dllPackAssets = dllPackAssets || [];
    this.webpackGroups = dllConfig.webpackGroups || [];// 打包管理分组
    // 打包分组id 既是 id 标示，又是排序
    this.webpackGroupsVersion = new Map(this.webpackGroups.map(group => {
      return [group.id, group.version];
    }));
    this._equal = (webpackGroup) => {
      if(!webpackGroup) return false;
      const version = this.webpackGroupsVersion.get(webpackGroup.id);
      return webpackGroup.version === version;
    }
  }
  /**
   * 获取配置信息
   */
  async getManifest() {
    if( this.data && !this.data.error ) return this.data;
    this.data = {
      name: this.name || null,
      webpackGroups: [],
    };
    const content = await utility.readFileAsync(this.cacheFile);
    try {
      if(content) {
        Object.assign(this.data, JSON.parse(content), this.name ? {
          name: this.name
        }: {})
      }
    } catch(e) {
      this.data.error = e;
      console.log(`load ${configName} error`, e); 
    }
    this.data.webpackGroups = (this.data.webpackGroups || []).filter(p => !!p);
    return this.data;
  }
  async setManifest(manifest) {
    return utility.writeFileAsync(this.cacheFile,JSON.stringify({
      ...manifest,
    },null, 2));
  }
  async isEqual(id) {
    const manifest = await this.getManifest();
    if(id === null || id === undefined) {
      // 按照一个分组不匹配 直接返回
      if(manifest.webpackGroups.find(webpackGroup => !this._equal(webpackGroup))) return false;
      return true;
    }
    return this._equal(manifest.webpackGroups.find(p => p.id === id));
  }
  /**
   * 获取资源项
   */
  async getAsset(id) {
    const manifest = await this.getManifest();
    // webpack 打包分组 筛选出版本号一致的记录
    let webpackGroups = (manifest.webpackGroups || []).filter(this._equal);// 所有版本已经一致的记录
    if(id !== undefined && id !== null) {// 筛选出小于当前id 的依赖
      webpackGroups = webpackGroups.filter(p => p.id < id);
    }
    const files = webpackGroups.reduce((memo,webpackGroup) => {
      memo = memo.concat(webpackGroup.files || []);
      return memo;
    }, []);

    const manifests = webpackGroups.reduce((memo,webpackGroup) => {
      memo = memo.concat(webpackGroup.manifests || []);
      return memo;
    }, []);

    return {
      name: manifest.name,
      output: this.output,
      files,
      manifests
    }
  }
  /**
   * 保存这次打包结果
   * @param {*} id 
   * @param {*} compilation 
   */
  async cache(id, compilation) {
    // 解析编译内容 syntaxCompilation 依托于 webpack
    const webpackGroup = this.webpackGroups.find(p => p.id === id);
    if(!webpackGroup) return;
    const chunks = await WebpackLibPlugin.syntaxCompilation(compilation);
    const {modules = []} = webpackGroup;
    // webpackGroup 因为只支持多组entry 同时打包，因此对于打包的结果依序 会根据 modules 中的参数 给予设定
    
    const sortNames = modules.map(p => p.name);
    // 所有的资源文件
    const assets = chunks.map(chunk => {
      const i = sortNames.indexOf(chunk.name);
      return {
        index: i > -1 ? i : Infinity,
        files: chunk.files,
        manifest: chunk.manifest
      };
    });
    assets.sort((a, b) => a.index - b.index);
    const files = assets.reduce((memo,item) => {
      return memo.concat(item.files || [])
    }, []);
    
    const group = {
      version:webpackGroup.version,
      id,
      files,
      manifests: [...new Set(assets.map(p => p.manifest).filter(p => !!p))]
    };
    // 进行更新保存group
    const manifest = await this.getManifest();
    manifest.webpackGroups = manifest.webpackGroups.filter(p => p.id !== id);
    manifest.webpackGroups.push(group);
    manifest.webpackGroups.sort(function(a,b){
      return a.id - b.id;
    })
    await this.setManifest(manifest);
  }
  getWebpackOption(webpackGroup, dllPackAssets, options) {
    const {
      externals,
      dir_node_modules,
      chainOption,
      loaderOption,
    } = this.settingOption || {};

    return {
      entry: packUtility.modulesToEntry(webpackGroup.modules),
      ...webpackGroup,
      externals,
      dllPackAssets,
      dir_node_modules,
      chainOption,
      loaderOption,
      ...options
    }
  }
  async build(fn) {
    const webpackGroups = this.webpackGroups;
    for(let i = 0, len = webpackGroups.length; i < len ;i++) {
      const { id, type } = webpackGroups[i];// 生成dll config
      const webpackGroupId = id;
      const buildName = packUtility.getBuildName(webpackGroups[i].modules.map(p => p.name));
      if(await this.isEqual(id)) {
        fn && fn({webpackGroupId, buildName, state:BuildStateEnum.CACHE});
        continue;
      }
      let webpackConfig = null;
      
      if(type === BuildTypeEnum.DLL || type === BuildTypeEnum.LIB || type === BuildTypeEnum.ENTRY) {
        const dllPackAsset = await this.getAsset(id); // 获取已经有的资源项
        const webpackOption = this.getWebpackOption(webpackGroups[i] , this.dllPackAssets.concat([ dllPackAsset ]), { buildType:type });
        webpackConfig = await genrateWebpackDllConfig(webpackOption);
      }
      if(!webpackConfig) continue;
      const compilation = await packUtility.webpackBuild(webpackConfig, (state, error) => {
        fn && fn({webpackGroupId, buildName, state, error});
      });
      if(compilation === false) return;
      // 针对当前打包结果 进行保存
      await this.cache(webpackGroupId, compilation);
    }
  }
  static BuildStateEnum = BuildStateEnum
}

module.exports = DllPack;