import requirejs from 'requirejs';
// 默认都从 lib 用引用
import matchRoute from '../../common/matchRoute';

// 加载时间上线
const MAX_TIME_OUT = 30 * 1000;


// 鉴于 requirejs 的配置项非常不好用 直接做代理过滤
const __GLOABL_NAME = '__gts_web_gateway';
let __STORE_CONFIG = {};
/*
const updateConfig = (function(){// 防止被内存回收 只更改内置的变量
  return function(_config) {
    if(_config === undefined) return __confg;
    // Object.assign(__confg, _config);
    __confg = merge(__confg, _config)
    return __confg;
  }
})();
*/




function merge(memo, config) {
  if(config === undefined) return memo;
  if(typeof config !== 'object') return config;
  if(typeof memo !== 'object' || memo === undefined || memo === null) return config;
  if(memo instanceof Array && config instanceof Array) {
    return memo.concat(config);
  }
  if(memo instanceof Array || config instanceof Array) {// 类型不尽相同 进行覆盖操作
    return config;
  }
  const result = {
    ...memo
  };
  Object.keys(config).forEach(key => {
    result[key] = merge(result[key],config[key]);
  });
  return result;
}

const __REQUEST_MAP = new Map();
const __REQUEST_ERROR_MAP = new Map();

requirejs.onError = (e) => {
  if(!e) return;
  const message = e.toString();
  const match = /Error: Script error for "(.*?)"/.exec(message);
  const { resolve, reject } = __REQUEST_ERROR_MAP.get(match && match[1]) || {};
  if (reject) {
    reject({code: 'SCRIPT_ERROR', error: e})
  }
  throw e;
}

const onScript = (url, callback) => {
  __REQUEST_ERROR_MAP.set(url, callback);
  return {
    reject(result) {
      const { resolve, reject } = __REQUEST_ERROR_MAP.get(url) || {};
      __REQUEST_ERROR_MAP.delete(url);
      reject && reject(result);
    },
    resolve(result) {
      const { resolve, reject } = __REQUEST_ERROR_MAP.get(url) || {};
      __REQUEST_ERROR_MAP.delete(url);
      resolve && resolve(result);
    }
  }
}

export const request = (url, ...args) => {
  let req = __REQUEST_MAP.get(url);
  if(req) return req;
  req= new Promise((resolve,reject) => {
    const script = onScript(url, {
      resolve,
      reject
    });
    
    requirejs([url], function(result){
      if(result) {
        script.resolve(result.__esModule ? result : { default: result });
      } else {
        script.reject({
          code: 'LOAD_ERROR'
        });
      }
    })
    setTimeout(() => {
      script.reject({
        code: 'TIME_OUT'
      })
    }, MAX_TIME_OUT);
  });
  __REQUEST_MAP.set(url, req);
  return req;
};

export const config = (_config) => {
  if(_config === undefined) return __STORE_CONFIG;
  // Object.assign(__confg, _config);
  __STORE_CONFIG = merge(__STORE_CONFIG, _config)
  return __STORE_CONFIG;
};

/**
 * 获取和设置注册路由
 * @param {*} scopeName
 * @param {*} scopeConfig 
 */
export const registry = (scopeName, scopeConfig) => {
  const scopes = __STORE_CONFIG['scope'];
  if(scopeConfig === undefined || scopeConfig === null) {
    return scopes[scopeName];
  }
  if(!scopes) scopes = {};
  scopes[scopeName] = merge(scopes[scopeName], scopeConfig);
  return scopes[scopeName];
}

export const getScope = (scopeName) => {
  const scopes = __STORE_CONFIG['scope'] || {};
  let scope = scopes[scopeName];
  if(scope) return scope;
  scopeName = Object.keys(scopes).find(key => scopes[key].id === scopeName);
  return scopes[scopeName];
}

export const resolveUrl = (remote, pathname) => {
  if (/^http[s]?:\/\//.test(pathname)) {
    return pathname.replace(/([^\/])((?:\/[^\/\?\#]+)+)($|\?|\#)/g,($0, $1, $2, $3) => {
      return $1 + $2 + (/[.][^.]+$/.test($2) ? '' : '.js') + $3
    });
  }
  pathname = '/' + pathname.replace(/^([\/]+|[.][\/]+)/g, '');
  pathname += /[.][^.]+$/.test(pathname) ? '' : '.js';
  return (remote || '').replace(/\/+$/,'') + pathname;
}

const initRegistryScope = {};

export const getRegistry = async (scopeName) => {
  const scope = registry(scopeName);
  if(!scope) return; // 没有注册过头部 则直接拒绝
  // 是否已经注册加载 
  if(initRegistryScope[scopeName]) return initRegistryScope[scopeName];
  initRegistryScope[scopeName] = (async () => {
    const result = await request(resolveUrl(scope.remote, scope.registry));
    // request 加载 registry 后， 默认会直接注册
    return registry(scopeName);
  })();
  return initRegistryScope[scopeName];
}


/**
 * 指定scope path 返回对应的 路由信息
 * @param {*} scopeName 
 * @param {*} pathName 
 */
export const getRoute = async (scopeName, pathName) => {
  const scope = await getRegistry(scopeName);
  if(!scope) return;
  return matchRoute(pathName, scope.routes); // 返回指定路由
}

const main = {
  getRegistry,
  getScope,
  resolveUrl,
  request,
  config,
  registry,
  getRoute
}

if(typeof window !== 'undefined') {
  window[__GLOABL_NAME] = main;
}

