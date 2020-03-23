/**
 * 加载器模板 用于
 */
import requirejs from 'requirejs';

import { config } from '../entry/core';

/* 
  因为dll 没有办法自动执行 需要调用函数 执行触发， 但是通过其他entry加载容易到loader参数覆盖异常
  lib 是纯粹 静态加载 不能处理loader
  采用普通entry 入口方式 同时对于 别名 做单独映射，
  鉴于 requirejs 本身 对于paths 别名映射的(命名的特殊约定 ) ,当存在.js 后缀（别名失效）有过一些特殊处理，所以转换为自定义处理
 */

const scope = ${scope || '{}'};
config({
  scope 
});

/*
const paths = {};
Object.keys(scope).forEach(scopeName => {
  paths[scopeName] = scope[scopeName].remote;
})

requirejs.config({
  paths
});
*/

