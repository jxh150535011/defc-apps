/**
 * 加载器模板 用于
 */
import requirejs from 'requirejs';
import {request, config, registry, getRoute, resolveUrl, getScope, getRegistry} from '../entry/core';

const scope = '${scope || ""}'.replace(/[\/]+$/g,'');
const pathname = '/' + ('${pathname || ""}').replace(/^([\/]+|[.][\/]+)/g,'');

const scopeObj = getScope(scope);

const invokenAsync = async (pathname = '') => {
  let url;
  if(!scopeObj) {
    url = resolveUrl(scope, pathname);
  } else {
    let route = await getRoute(scopeObj.name, pathname);
    if(!route) {
      url = resolveUrl(scopeObj.remote, pathname);
    } else {
      url = resolveUrl(scopeObj.remote, route.id);
    }
  }
  const alias = resolveUrl(scope, pathname);
  return request(url + '?alias=' + encodeURIComponent(alias));
}

let main;
if(pathname && pathname !== '/' ) {
  main = invokenAsync(pathname);
} else {
  main = {
    async request(api, ...args) {
      return invokenAsync(api);
    },
    get registry() {
      return getRegistry(scope);
    },
    setRegistry(scopeObj) {
      return registry(scope, scopeObj);
    }
  }
}

export default main;