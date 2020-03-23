const path = require('path');
const url = require('url');
const DllPack =  require('./generate/dll.pack.js');
const ScopePack =  require('./generate/scope.pack.js');
const WebappPack =  require('./generate/webapp.pack.js');
const packUtility = require('./generate/pack.utility.js');
const mimeMiddleware = require('./generate/mime.middleware.js');

const {BuildStateEnum, BuildTypeEnum, PackTypeEnum} = require('./enum');

const createDllInstance = (scopeOption, setupConfig, dllPackAssets) => {

  const dllOption = scopeOption.dllOption;

  const loaderOption = {
    ...setupConfig.loaderOption,
    ...scopeOption.loaderOption
  }

  return new DllPack(dllOption, {
    externals: setupConfig.externals,
    dir_node_modules: setupConfig.dir_node_modules,
    loaderOption,
    chainOption: setupConfig.chain
  }, dllPackAssets);
};

/**
 * 模块批量打包
 */
class ModulesPack {
  constructor(setupConfig) {
    this.setupConfig = setupConfig;
    this.gatewayScopeOption = this.setupConfig.gateway;

    this.gatewayDllPack =  createDllInstance(this.gatewayScopeOption, setupConfig);
    // 已经初始化完毕的 scope 打包对象
    this.packScopes = [];
  }
  async init(fn) {
    const {
      scopes = [], process = {},
      externals, dir_node_modules,
    } = this.setupConfig;

    // 当前打包dll 文件资源
    const dllPackAssets = [
      await this.gatewayDllPack.getAsset()
    ];

    // dll 默认配置，不同scope 之间的 dll manifest 配置 不共享
    const dllSettingOption = {
      externals,
      dir_node_modules,
      dllPackAssets
    };

    for(let i =0, len = scopes.length;i < len ;i ++ ) {
      const scope = scopes[i];
      if(!process[scope.name]) continue;
      let dllPackAsset = null;
      if(scope.dllOption) {
        const dllPack = createDllInstance(scope, this.setupConfig, dllPackAssets);
        await dllPack.build((result) => {
          fn && fn({
            ...result,
            scopeName: scope.name,
            buildType: BuildTypeEnum.DLL
          });
        });
        dllPackAsset = await dllPack.getAsset();
      }
      const pack = new ScopePack(scope, this.setupConfig, dllPackAssets.concat(dllPackAsset ? dllPackAsset : []));
      this.packScopes.push(pack);
    }
  }
  /**
   * 生成注册路由
   */
  async buildRegistryRouter(fn) {
    return Promise.all(this.packScopes.map(async (pack) => {
      return pack.buildRouter(fn);
    }))
  }
  /**
   * 获取谋一个具体scope
   */
  getPackScope(scopeName) {
    return this.packScopes.find(p => p.name === scopeName);
  }
  async build(callback = () => {}) {
    return Promise.all(this.packScopes.map(async (packScope) => {
      const { routes } = packScope.scopeOption || {};
      if (!routes || !routes.length) {
        return [];
      }

      const entry = routes.reduce((memo, route) => {
        memo[route.name] = route.file;
        return memo;
      }, {});

      const routeOption = {
        entry,
        filename:'[name].js'
      };
      const { data = [], error } = await packScope.build(routeOption, callback);
      
      // 根据data 返回值 给每个route 设置id 这样注册生成 router.js 能识别对应路由信息
      const entrys = data;
      routes.forEach(route => {
        const entry = entrys.find(p => p.name === route.name)
        route.id = entry && entry.id || route.id;// 重新设置当前路由的id
      })
      return data;
    }))
  }
}

const createDevMiddleware = (setupConfig, modulePacks) => {

  const {scopes = [], setting} = setupConfig;

  const gatewayServiceHostUri = url.parse(setting.gatewayServiceHost);
  // 拦截服务地址
  const gatewayServicePath = gatewayServiceHostUri.pathname;

  const matchScopeRoute = (function(scopes){
    // 处理路由 用于后续匹配
    const scopeRoutes = scopes.map((scope) => {
      return {
        scope,
        uri: url.parse(scope.remote)
      }
    })
    return (pathname) => {
      for(let route of scopeRoutes) {
        if(pathname.indexOf(route.uri.pathname) === 0) {
          return {
            scope: route.scope,
            relative: pathname.replace(route.uri.pathname, '')
          };
        }
      }
    }
  })(scopes);

  /**
   * 实时编译文件
   * @param {*} scope 
   * @param {*} pathname 
   */
  const loadRouteScopeFileContent = async (scope, pathname) => {
    const packScope = modulePacks.getPackScope(scope.name);
    if(!packScope) {
      return {
        status: 500,
        content: 'NOT READY'
      }
    }
    const id = path.basename(pathname, path.extname(pathname));
    const route = scope.routes.find(p => p.id === id || p.name === id);
    if(!route) {
      return {
        status: 404,
        content: 'NOT FOUND'
      };
    }
    const entry = {};
    entry[route.name] = route.file;
    const result = await packScope.build({
      entry,
      filename: '[name].js'
    });
    if(result.error) {
      console.error('构建异常', result.error);
      return {
        status: 500,
        content: result.error.toString()
      }
    }
    const data = result.data || [];
    const chunk = data.find(p => p.id === id || p.name === id);
    if(!chunk) {
      return {
        status: 404,
        content: 'NOT FOUND CHUNK'
      };
    }
    return {
      status: 200,
      content: chunk.content
    };
  }

  return async (req, res, next) => {
    let pathname = req.path || ''; // 相对于scope 的目录地址
    if(pathname.indexOf(gatewayServicePath) !== 0) return next();
    const route = matchScopeRoute(pathname);
    if(!route) {
      res.status(404);
      return res.end();
    }
    const { scope, relative } = route;
    pathname = relative;

    let response = await packUtility.loadScopeFileContentAsync(scope, pathname);
    if(response.status === 404) { // 如果文件未找到，则尝试实时生成
      response = await loadRouteScopeFileContent(scope, pathname);
    }
    res.status(response.status);
    return res.end(response.content || '');
  }
}


const create = (setupConfig) => {

  return {

    async start(callback) {
      const gatewayScope = setupConfig.gateway;
      const dllPack = createDllInstance(gatewayScope, setupConfig);
      // 编译 gateway dll
      await dllPack.build((result) => {
        callback({...result, packType: PackTypeEnum.GATEWAY});
      });
      
      // 先开始编译模块
      const modulePacks = new ModulesPack(setupConfig);
      await modulePacks.init(callback);
      await modulePacks.buildRegistryRouter(callback)

      const devMiddleware = createDevMiddleware(setupConfig, modulePacks);

      const middlewares = [
        mimeMiddleware(),
        devMiddleware
      ];
      const webappPack = new WebappPack(gatewayScope, setupConfig, dllPack, middlewares);
      await webappPack.start((result) => {
        callback({...result, buildType:BuildTypeEnum.WEBAPP, packType: PackTypeEnum.GATEWAY});
      })
    },
    async build(callback) {
      const gatewayScope = setupConfig.gateway;
      const dllPack = createDllInstance(gatewayScope, setupConfig);
      // 编译 gateway dll
      await dllPack.build((result) => {
        callback({...result, packType: PackTypeEnum.GATEWAY});
      });
      
      // 先开始编译模块
      const modulePacks = new ModulesPack(setupConfig);
      await modulePacks.init(callback);
      await modulePacks.build(callback);
      await modulePacks.buildRegistryRouter(callback);// 最后在生成路由

      // 先开始编译网关
      const webappPack = new WebappPack(gatewayScope, setupConfig, dllPack);
      await webappPack.build((result) => {
        callback({...result, buildType:BuildTypeEnum.WEBAPP, packType: PackTypeEnum.GATEWAY});
      })
    },
    scope(scopeName, fn) {
      const { scopes = [], process = {} } = setupConfig;
      const scope = scopes.find(p => p.name === scopeName);
      if (!scope) {
        console.error(`未发现${scopeName}模块`);
        return;
      }
      const packScope = new ScopePack(scope, setupConfig);
      return {
        name: scope.name,
        output: scope.output,
        remote: scope.remote,
        id: scope.id,
        async build(routeOption, callback) {
          const { data = [], error } = await packScope.build(routeOption, (...args) => {
            fn && fn(...args);
            callback && callback(...args);
          });
          return {
            data,
            error
          }
        }
      }
    }
  }
}

module.exports = create;