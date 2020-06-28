'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const pathMatch = require('path-match');
const chalk = require('chalk');

const routeMatch = (fn, options) => {
  if(fn === false) return false;
  if(typeof fn === 'function') return fn;
  else if(typeof fn === 'string') {
    if(typeof options === 'function') {
      return (url) => {
        return options(url, fn);
      }
    }
    const route = pathMatch({
      end: false,
      strict: false,
      sensitive: false,
      ...options
    })(fn);
    return url => !!route(url);
  }
  else if(fn instanceof RegExp) {
    return url => !!url.match(fn);
  }
  else if(fn instanceof Array) {
    return (url) => {
      return fn.map(p => routeMatch(p, options)).some(p => p(url))
    }
  }
  return () => false;
}

function timeLog(color, message){// 0 1 2
  let _color = color;
  let timeColor = chalk.hex('#fadb14');
  let time = Date.now();
  // [执行成功]+20s > message
  const log = (prefix,strTime = '+[span]s' ,...args) => {
    let prefixColor = chalk.hex(['#52c41a','#fa8c16','#f5222d'][_color] || _color);
    let now = Date.now();
    let span = now - time;
    let str = '       ';
    if(strTime) {
      str = strTime.replace(/\[span\]/g, Math.floor(span/1000));
      str = (`${str}          `).substr(0,7);
    }
    console.log(prefixColor(`[${prefix}]`), timeColor(str), args.length ? '>' : '',...args);
  }
  log.warning = function(...args) {
    _color = 1;
    log(...args);
    return log;
  }
  log.error = function(...args) {
    _color = 1;
    log(...args);
    return log;
  }
  if(message) {
    log(message, false);
  }
  return log;
}


function wrapPromise(context, fn,...args) {
  return new Promise((resolve,reject) => {
    fn.call(context,...args,(err,result) => {
      if(err) return reject(err);
      return resolve(result);
    });
  })
}

const unlinkAsync = util.promisify(fs.unlink);
const rmdirAsync = util.promisify(fs.rmdir);
const _mkdirAsync =  util.promisify(fs.mkdir);

async function mkdirAsync(dir,mode = 0o777) {
  let i = dir.indexOf(':\\');
  i = (i > 0) ? (i + 2) : 1; //window unix first is /
  let paths = [dir.substr(0, i)];
  paths = paths.concat(dir.substr(i).split(i > 1 ? '\\' : '/'));
  dir = paths[0];
  for (let i = 1, len = paths.length; i < len; i++) {
    dir = path.resolve(dir, paths[i]);
    if (!await existsAsync(dir)) {
      try {
        await _mkdirAsync(dir, mode)
      } catch(e) {
        if(e.code !== 'EEXIST') {
          console.log(e);
          return false;
        }
      };
    }
  }
  return true;
}
async function statAsync(pathLike) {
  return wrapPromise(fs, fs.stat,pathLike)
}
async function readdirAsync(pathLike,options) {
  return wrapPromise(fs, fs.readdir,pathLike,options)
}

async function readFileAsync(pathLike,options) {
  if(!(await existsAsync(pathLike)))return; 
  return wrapPromise(fs, fs.readFile,pathLike,options || {encoding:'utf-8'});
}

async function existsAsync(dir) {
  return new Promise(resolve => fs.exists(dir,resolve))
}

async function writeFileAsync (pathLike, content, options) {
  await mkdirAsync(path.dirname(pathLike), options && options.mode);
  return wrapPromise(fs, fs.writeFile,pathLike, content ,{encoding:'utf-8',...options});
}
async function copyFileAsync (src, dest, options) {
  await mkdirAsync(path.dirname(dest), options && options.mode);
  /**
  fs.constants.COPYFILE_EXCL - 如果 dest 已存在，则拷贝操作将失败。
  fs.constants.COPYFILE_FICLONE - 拷贝操作将尝试创建写时拷贝（copy-on-write）链接。如果平台不支持写时拷贝，则使用后备的拷贝机制。
  fs.constants.COPYFILE_FICLONE_FORCE - 拷贝操作将尝试创建写时拷贝链接。如果平台不支持写时拷贝，则拷贝操作将失败。
   */
  const flags = options && options.flag || 0;
  return wrapPromise(fs, fs.copyFile, src, dest, flags);
}


async function removeAsync (dir) {
  let exists = await existsAsync(dir);
  if(!exists) return true;
  let stat = await statAsync(dir);
  if(!stat.isDirectory()) {
    return unlinkAsync(dir);
  }
  let files = await readdirAsync(dir);
  for(let file of files) {
    let filePath = path.join(dir,file);
    await removeAsync(filePath);
  }
  return rmdirAsync(dir);
};

async function loadFilesAsync (root, options) {
  const {
    match,
    ignore,
    include,
    exclude,
  } = options || {};
  const matchRule = (rule, absolute) => {
    if(!rule) return;
    if(!absolute) return;
    return rule(absolute) || rule('/' + absolute);
  }

  const loadAsync = async (dir,options) => {
    let {match,ignore,include,exclude, absolute = ''} = options;
    let exists = await existsAsync(dir);
    if(!exists) return [];
    absolute = absolute.replace(/\\/g,'/');
    try {
      let stat = await statAsync(dir);
      if(matchRule(exclude, absolute) === true) return [];
      if(matchRule(include, absolute) === false) return [];
      if(!stat.isDirectory()) {
        if(matchRule(ignore, absolute) === true) return [];
        if(matchRule(match, absolute) === false) return [];
        return [ dir ];
      }
      const dirs = await readdirAsync(dir);
      const files = await Promise.all(dirs.map(file => {
        return loadAsync(path.join(dir,file), {
          ...options,
          absolute:path.join(absolute,file)
        })
      }));
      return files.reduce((memo,items) => memo.concat(items),[]);
    } catch(ex) {
      return [];
    }
  }
  return loadAsync(root,{
    ignore:!ignore ? null: routeMatch(ignore),
    match:!match ? null: routeMatch(match),
    include:!include ? null : routeMatch(include, function(absolute, pathname) {
      if(absolute.indexOf(pathname) === 0 || pathname.indexOf(absolute) === 0) {
        return true; // 互相子集 则判定为相同
      }
      return false;
    }),
    exclude:!exclude ? null : routeMatch(exclude, function(absolute, pathname) {
      if(absolute.indexOf(pathname) === 0 || pathname.indexOf(absolute) === 0) {
        return true; // 互相子集 则判定为相同
      }
      return false;
    }),
  });
}


const random = (len) => {
  let hexDigits = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
  let s = [];
  for (let i = 0; i < len; i++) {
      s[i] = hexDigits[Math.floor(Math.random() * 0x10)];
  }
  return s.join('');
}
const uuid = () => {
  let strTime = '' + new Date().getTime();
  return [strTime,'-',random(35-strTime.length-1)].join('');
}

const escapeStringRegexp = (str) => {
  return (str || '').replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}


const resolveAsync = async (main) => {// 必须指定 检索目录 dirs 这里只在子一级目录下检索 优化检索性能
  // return require.resolve(name, {paths: dirs});
  try {
    if(!main) return {error: 'undefind'};
    let exists = await existsAsync(main);
    if(exists) {
      const stat = await statAsync(main);
      if(!stat.isDirectory()) {// 如果当前是文件 则直接返回
        return {main};
      }
    }

    let packageJson = path.join(main, 'package.json');
    let meta;
    let mains = [
      main + '.js',
      path.join(main, 'index.js')
    ];
    if(await existsAsync(packageJson)) {
      meta = require(packageJson);
      mains = [ path.join(main, meta && meta.main || '') ].concat(mains);
    }
    for(let i = 0, len = mains.length; i < len; i++) {
      if(await existsAsync(mains[i])) {
        return {main:mains[i],meta};
      }
    }
    return {
      meta,
      error:'not found'
    }
  } catch(error) {
    return {error};
  }
}

async function resolve(moduleNames = [],resolveOptions = {}) {// modules 指定查询范围
  const {alias = {},modules = []} = resolveOptions;
  const dependencies = await Promise.all(moduleNames.map(async (name) => {
    let item = typeof name === 'string' ? { name }: name;
    if (!item || !item.name) return {name, error:'not defined'};
    let result = {error:'not defined'};
    if (item.main) {
      result = await resolveAsync(item.main);
    } else {
      let main = alias[item.name] || item.name;// 检查是否匹配别名
      if(main[0] === '/' || main.indexOf(':\\') > -1) {// 绝对路径 直接判断
        result = await resolveAsync(main);
      } else {
        for(let i = 0, len = modules.length; i < len; i++) {
          result = await resolveAsync(path.join(modules[i], main));
          if(!result.error) break;
        }
      }
    }
    return {
      ...item,
      ...result
    }
  }));
  return {
    modules: dependencies,
    errors: dependencies.filter(p => p.error)
  }
}

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
function mergeToArray(...args) {
  return args.reduce((memo, item) => {
    if (!item) return memo;
    if(item instanceof Array) {
      return memo.concat(item);
    }
    memo.push(item)
    return memo;
  }, [])
}

function bindPromise(context,fn) {
  return async (...args) => {
    return wrapPromise(context, fn, ...args);
  }
}

const rulesMap = new Map();

const matchRoute = function(pathname,rules) {// 路由匹配
  // rules 只允许正则 跟 字符串
  if(!(rules instanceof Array)) rules = [rules];
  let regRules = rules.map(rule => {
    if(rule instanceof RegExp) return rule;
    if(rulesMap.has(rule)) return rulesMap.get(rule);
    let reg = rule.replace(/\\/g,'\\\\')
    .replace(/\/[*]{2,}/g,'(?:\\/.*)?')
    .replace(/\/[*]{1,1}/g,'(?:\\/[^\\/]+)?');
    rulesMap.set(rule,new RegExp('^' + reg + '$','gi'))
    return rulesMap.get(rule);
  }).filter(p => !!p);

  return regRules.some(regRule => {
    regRule.lastIndex = 0;
    return regRule.test(pathname);
  });
}


module.exports = {
  matchRoute,
  bindPromise,
  merge,
  mergeToArray,
  resolve,
  timeLog,
  escapeStringRegexp,
  random,
  routeMatch,
  uuid,
  copyFileAsync,
  unlinkAsync,
  rmdirAsync,
  mkdirAsync,
  statAsync,
  readdirAsync,
  readFileAsync,
  existsAsync,
  writeFileAsync,
  removeAsync,
  loadFilesAsync,
}