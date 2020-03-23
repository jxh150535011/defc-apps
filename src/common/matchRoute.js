const debug = require('debug')('router');
/**
 * 当前脚本 前后端共用
 */

 module.exports = function(pathname,routes) {// 路由匹配

  if(!pathname) return false;
  pathname = '/' + pathname.replace(/^([.]\/|[\/]+)/, ''); // 格式化字符串
  debug('test match route', pathname);
  // rules 只允许正则 跟 字符串
  if(!routes) return;
  if(!(routes instanceof Array)) routes = [routes];
  return routes.find(route => {
    if(!route.regexp) {
      if(route.path instanceof RegExp) {
        route.regexp = route.path;
      }
      else if(typeof route.path === 'string') {
        let reg = '/' + route.path.replace(/^([.]\/|[\/]+)/, ''); // 格式化字符串
        reg = reg.replace(/\\/g,'\\\\')
        .replace(/\/[*]{2,}/g,'(?:\\/.*)?')
        .replace(/\/[*]{1,1}/g,'(?:\\/[^\\/]+)?');
        route.regexp = new RegExp('^' + reg + '$','gi');
      }
    }
    if(route.regexp) {
      route.regexp.lastIndex = 0;
      return route.regexp.test(pathname);
    }
    return false;
  })
}
