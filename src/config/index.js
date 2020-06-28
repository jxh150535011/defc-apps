const path = require('path');
const md5 = require('md5');
const utility = require('../../common/utility');
// version 影响生成版本规则
const { root, cwd, host, port, version, meta } = require('./env');

const {BuildStateEnum, BuildTypeEnum} = require('../enum');

// node_modules/requirejs/bin/r.js 切换到对应的require.js web版本
const requirejsPath = path.resolve(require.resolve('requirejs'), '../../require.js');
// 核心 包含 加载器
const clientCorePath = path.resolve(root, './template/entry/core.js');
const clientEmptyPath = path.resolve(root, './template/entry/empty.js');

const clientCoreTemplateLoaderPath = path.resolve(root, './template/loaders/core.tpl');
// 服务注册 模板 路径
const clientScopeTemplateLoaderPath = path.resolve(root, './template/loaders/scope.tpl');
// 路由注册 模板 路径
const clientRouterTemplateLoaderPath = path.resolve(root, './template/loaders/router.tpl');

module.exports = {
  root, cwd, meta,
  BuildTypeEnum,
  webpackDllConfig: require('./webpack.dll.config'),
  webpackScopeConfig: require('./webpack.scope.config'),
  webpackWebappConfig: require('./webpack.webapp.config'),
  clientCorePath,
  clientEmptyPath,
  clientScopeTemplateLoaderPath,
  clientRouterTemplateLoaderPath,
  // 需要对外暴露的路径 最好经过 relativePath 进行处理 ，防止暴露全局路径
  relativePath(url) {
    return path.relative(cwd, url);
  },

  /**
   * 
   * configOptions = {
   *  output,
   *  webapp:{
   *    template,
   *    entry
   *  },
   *  dlls,
   *  modules,
   *  dir_node_modules,
   * }
   * 增加
   * setupConfig = {
   *  dll:{
   *    output,
   *    webpackGroups, {type:dll,name,modules}
   *  },
   *  webapp: {
   *    output
   *  },
   *  externals: [],// 依赖排除函数
   * }
   * 
   */
  init(configOptions) {


    const {
      host = '127.0.0.1',
      port = 7001
    } = configOptions.webapp || {};
    
    const dllAssetsName = 'dll';
    const webappAssetsName = 'webapp';
    const gatewayScopeName = '__gateway_scope';// 网关保留字 scope内部表示
    const moduleAssetsName = 'modules';
    const cacheAssetsName = 'cache';
    const registryRouterName = 'router'; // 默认注册入口的名称

    const gatewayHost = `http://${host}${port === 80 ? '' : (':' + port)}`;
    
    // 缓存输出位
    const setupConfig = {
      alias: {},
      output: configOptions.output,
      setting: {// 内置配置项
        gatewayHost,
        gatewayServiceHost: `${gatewayHost}/__process_gateway_service`, // 网关拦截路由
        dllAssetsName,
        gatewayScopeName,
        cacheAssetsName,
        webappAssetsName,
        moduleAssetsName,
        registryRouterName,
      },
      isDev: configOptions.env === 'development' || process.env.NODE_ENV === 'development',
      cache:{
        output: path.join(configOptions.output, cacheAssetsName) // 缓存位置
      },
      scopes: [],// [ { id, name, remote webpackGroups: [] } ]
      dll:{}, // { webpackGroups: {name, modules} , output assetsName }
      webapp: {
        host,
        port,
        entry: path.join(root, './template/webapp/index.jsx'),
        template: path.join(root, './template/webapp/index.html'),
        alias: {},
        output: path.join(configOptions.output, webappAssetsName),
        publicPath: '',
        contentBase: false, // 设置相对 cwd 执行目录的 对外暴露的可直接访问空间 false 禁用
        assets: {
          // 注入默认service worker
          '/service-worker.js': path.join(root, './template/assets/service-worker.js')
        },
      },
      dir_node_modules: [// 默认优先级 模块加载位
        path.resolve(root, './node_modules'),
      ],
      /**
        function(context, request, callback) {
          return callback();
        }
       */
    };
    
    const config = utility.merge(setupConfig, configOptions);
    // merge 不支持数组 对象融合 针对 externals 额外执行合并操作
    config.externals = utility.mergeToArray([
      {
        'requirejs':'requirejs'
      }
    ], config.externals);
    config.scopes = this.initScopeOptions(config);
    config.gateway = this.initGatewayOptions(config);

    const alias = config.alias;
    // 生成内置 别名
    config.scopes.forEach(scope => {
      // # 非常重要 不要丢弃，用于分割import('@scope/pathname') 的情况
      // &remote=${encodeURIComponent(scope.remote)} 暂时用不着 可以先不传递
      alias[scope.name] = `${clientScopeTemplateLoaderPath}?scope=${encodeURIComponent(scope.name)}#`;
    });
    config.alias = alias;
    return config;
  },
  initGatewayOptions(setupConfig) {
    const { webapp, setting, externals } = setupConfig;
    const { gatewayHost, gatewayScopeName } = setting;
    const context = webapp.context || cwd;

    const libs = [].concat(setupConfig.libs || []).concat(webapp.libs || []);
    const scope = { // gateway 网关 一个特殊的scope
      id:0,
      libs,
      externals: utility.mergeToArray(externals, webapp.externals),
      alias:webapp.alias,
      name: gatewayScopeName,
      remote: webapp.remote || '/', // gatewayHost
      context
    };
    scope.dllOption =  this.initGateWayDllOption(setupConfig, scope)// 重新生成dlls 分组 
    return scope;
  },
  initGateWayDllOption(setupConfig, scope) {
    const {setting, cache} = setupConfig;
    const { dllAssetsName, webappAssetsName } = setting;

    const modules = this.defaultDllModules(setupConfig).concat(
      this.entryToModules(scope.libs)
    );
    return this.createDllOption({
      context: scope.context,
      externals: scope.externals,
      name: scope.name,
      output: path.join(cache.output, webappAssetsName, dllAssetsName)
    }, modules);
  },
  initScopeOptions(setupConfig) {
    const {setting, isDev, externals} = setupConfig;
    const { gatewayServiceHost, moduleAssetsName, registryRouterName } = setting;
    const registryScope = setupConfig.registry || {};
    const processScope = setupConfig.process || {};

    const merge = (...args) => {
      return args.reduce((memo, scopeCollection) => {
        return Object.keys(scopeCollection).reduce((memo, name) => {
          const scope = typeof scopeCollection[name] === 'string' ? { remote: scopeCollection[name] } : scopeCollection[name];
          memo[name] = {
            ...memo[name],
            ...scope
          };
          return memo;
        }, memo);
      }, {})
    }
    const collection = merge(registryScope, processScope);
    const scopes = Object.keys(collection).map((name) => {
      const scope = collection[name];
      scope.id = md5(name);// requirejs config paths 对特殊字符路由不友好
      scope.name = name;

      if(isDev && processScope[name]) {// 对remote 进行替换
        scope.remote = `${gatewayServiceHost}/${scope.id}`
      }
      // 检查注册器 如果允许注册 并且
      if (scope.registry !== false) {
        // 如果注册器 没有明确拒绝 并且未指定默认值 使用 registryRouterName ,否则 使用注册器默认的路由
        scope.registry = (!scope.registry || scope.registry === true) ? registryRouterName : scope.registry;
      }
      scope.externals = utility.mergeToArray(externals, scope.externals);
      // 设置文件根目录
      scope.context = scope.context || setupConfig.context || cwd;
      if(!scope.output) {
        scope.output = path.join(setupConfig.output, moduleAssetsName, scope.name);
      }
      scope.dllOption = this.initScopeDllOption(setupConfig, scope);
      scope.routes = this.initScopeRoutes(scope);
      return scope;
    });
    return scopes;
  },
  /**
   * entry 格式状态 很多，现在将其统一转换 {name, files}
   * @param {*} entry 
   */
  entryToModules(entry, name) {
    if(!entry) return [];
    if(typeof entry === 'string') {
      return [{
        name: name || '',
        files: [ entry ],
      }]
    }
    if(entry instanceof Array) {
      return entry.reduce((memo, item) => {
        return memo.concat(this.entryToModules(item))
      }, []);
    }
    return Object.keys(entry).reduce((memo, name) => {
      return memo.concat(this.entryToModules(entry[name], name))
    }, []);
  },
  initScopeDllOption(setupConfig, scope) {// 构建打包分组关系

    const {setting, cache} = setupConfig;
    const { dllAssetsName, moduleAssetsName } = setting;
    // 如果存在libs
    if(!scope.libs || !scope.libs.length) return;
    const modules = this.entryToModules(scope.libs);
    return this.createDllOption({
      context: scope.context,
      externals: scope.externals,
      name: scope.name,
      output: path.join(cache.output, moduleAssetsName, scope.name, dllAssetsName)
    }, modules);
  },
  initScopeRoutes(scope) {// 路由参数初始化
    return (scope.routes || []).map(route => {
      let pathname = route[0];
      if(!pathname) return null;
      if(typeof pathname === 'string') {
        pathname = pathname.replace(/[\\]/g,'/');
      }
      let file = path.resolve(scope.context, route[1]);
      return {
        pathname,
        file,
        name: md5(this.relativePath(file)).substr(0,4),
        id: ''// 对于当前模块 输出 需要一个hash结果 存在hash 则以hash值 为真实节点名称
      }
    }).filter(p => !!p)
  },
  defaultDllModules(setupConfig) {// 默认内置的全局资源注入

    const {scopes = [], setting = {}} = setupConfig;

    // 内置的集成框架
    const paths = {};
    scopes.forEach(scope => {
      const {id, name, remote, registry} = scope;
      paths[name] = {
        id,
        name,
        remote,
        registry
      }
    });

    const coreParams = {
      scope: encodeURIComponent(JSON.stringify(paths)),
    }

    return [
      {
        type: BuildTypeEnum.LIB, // lib 注入方式 无法使用 loader 加载器
        files: [requirejsPath],
        gid: 0, // 打包分组计算key 不同于 id 会尽量进行同时打包操作 前提保证类型一致
        name: 'requirejs'
      },
      {
        type: BuildTypeEnum.DLL,
        name: 'client_core',
        gid: 1,
        hash: '1.0.0', // 如果提供了hash 信息，会对webpackGroup 生成的hash 结果有影响
        files: [
          clientCorePath, // 绝对不可使用动态路径 否则后续的引用基本失效
        ],
      },
      {
        type: BuildTypeEnum.ENTRY,
        name: 'client_entry_registry',
        hash: Date.now(),// 每次实时生成
        gid: 2,
        files: [
          clientCoreTemplateLoaderPath + '?' + Object.keys(coreParams).map(key => `${key}=${coreParams[key]}`).join('&') 
        ],
      },
    ];
  },
  /**
   * 
   * @param {*} option {output,name}
   */
  createDllOption(option, modules = []) {
    const { output,name, context, externals } = option;
    const dllOption = {
      name,
      output,
      webpackGroups: []
    }
    dllOption.webpackGroups = modules.reduce((memo, item, index) => {
      // 如果 modules 则忽略
      if(!item) return memo;
      let name = item.name || 'lib'; // 分块名称
      let type = (item.type || BuildTypeEnum.DLL);
      let gid = item.gid || 0; // 打包进程 分片id
      let webpackGroup = memo.find(p => p.gid === gid && p.type === type);
      if(!webpackGroup ) {
        webpackGroup = {
          context,
          gid,
          output,
          type,
          id: memo.length,
          modules: []
        };
        // 为模块自身生成 version 值
        // webpackGroup.version = md5(JSON.stringify(webpackGroup));
        memo.push(webpackGroup);
      }
      // 每个 modules 必须生成自己的 hash 规则
      // 如果不存在 则根据files 生成hash信息
      // let hash = item.hash;
      // webpackGroup.hash =  webpackGroup.hash.concat(hash);
      webpackGroup.modules.push({
        name,
        files: item.files,
         ...(item.hash ? {hash: item.hash} : {}) // 混入一个签名
      });
      return memo;
    },[]);
    // 给每个打包分组 版本 都依赖于所有之前的版本是否发生改变
    let memoVersion = [ version, externals ]; // externals 影响版本构建
    dllOption.webpackGroups.forEach(webpackGroup => {
      // 为内置模块
      // let version = memoVersion.concat([ webpackGroup.version ]).concat(webpackGroup.modules.map(p => p.hash)).join(',');
      let version = memoVersion.concat([JSON.stringify(webpackGroup)]);
      version = md5(version.join(','));
      webpackGroup.version = version;

      if(webpackGroup.type === BuildTypeEnum.DLL) {// 只有构建类型为dll 才有可能为后续的打包构建造成影响
        memoVersion = memoVersion.concat([version]);
      }
    });

    return dllOption;
  }
}