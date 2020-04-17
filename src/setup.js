const {parse} = require('url');
const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const util = require('util');
const utility = require('../common/utility');

const webpack = require('webpack');
const webpackDevServer = require('webpack-dev-server');

const { openBrowser,choosePort } = require('./common/dev-utils');

const config = require('./config');
const generate = require('./generate');
const {BuildStateEnum, BuildTypeEnum, PackTypeEnum} = require('./enum');
const debug = require('debug')('server');


/**
 * @param {*} webpackGroupId  打包分组
 * @param {*} scopeName  scope 名称
 * @param {*} buildType  DLL | ENTRY | WEBAPP | MODULE | REGISTRY_MODULE
 * @param {*} packType  SCOPE | GATEWAY
 */
const processCallback = (log, { scopeName, webpackGroupId, buildName, buildType, packType ,state, error}) => {
  const isGateway = packType === PackTypeEnum.GATEWAY;

  let buildTypeName = `>dll:${buildName}`;
  if(buildType === BuildTypeEnum.WEBAPP || buildType === BuildTypeEnum.REGISTRY_MODULE || buildType === BuildTypeEnum.MODULE) {
    buildTypeName = buildName ? `:${buildName}` : '';
  }

  const title = [
    isGateway ? '网关' : `模块>${scopeName}`,
    buildTypeName
  ].join('');

  if(BuildStateEnum.CACHE === state) {
    log(title, '--缓存');
  } else if(BuildStateEnum.START === state) {
    log(title, '--开始');
  } else if(BuildStateEnum.DONE === state) {
    log(title, '--完成');
  } else if(BuildStateEnum.ERROR === state) {
    log(title, '--异常', error);
  }
}

/**
* 
* configOptions = {
*  isDev
*  output,
*  webapp:{
*    root,
*    template,
*    entry,
*    alias:{}
*    assets:{}
*  },
*  dlls,
*  modules,
*  dir_node_modules,
* }
* 
*/

function setup(configOptions) {
  const log = utility.timeLog(0, '开始构建');
  // 暂定 modules 所有内容 都作为基类保存
  // await generateDllAsync(modules);
  const setupConfig = config.init(configOptions);// 对configOptions 进行初始化过滤操作 使之符合要求
  if(setupConfig.error) { // 如果配置异常直接报错
    throw new Error(setupConfig.error);
  }
  const setup = generate(setupConfig);
  const callback = processCallback.bind(null, log);
  return {
    log,
    async run(_port) {
      // await generateDllAsync(setupConfig);
      let {host, port} = setupConfig.webapp;
      port = _port || port;
      const url = `http://${host}:${port}`;

      try {
          let uri = parse(url);
          let port = await choosePort(uri.hostname, Number(uri.port) || 80);
          if (port === null) {
            return console.log('we have not found a port');
          }
          await setup.start(callback);
          console.log('Starting the development server...\n');
          openBrowser(url);
          ['SIGINT', 'SIGTERM'].forEach(function (sig) {
              process.on(sig, function () {
                  // devServer.close();
                  process.exit();
              });
          });
      }
      catch (e) {
        console.log(e);
        process.exit(1);
      }
    },
    async build() {
      return setup.build(callback);
    },
    scope(scopeName) {
      return setup.scope(scopeName, callback);
    }
  }
}
setup.utility = utility;

/**
 * 检查目录的模块目录合法性 返回符合要求的目录
 */
const check_dir_node_modules = async (dir_node_modules = [], cwd, configFiles = [], root) => {
  // dir_node_modules 用户配置的模块目录
  // cwd 执行目录
  // configPath 配置文件所在目录
  // root 脚手架工程 自身所在的目录位置
  let dirs  = dir_node_modules.concat([
    path.resolve(cwd, 'node_modules'),
    ...configFiles.filter(p => !!p).map(file => {
      return path.resolve(file, './node_modules') || ''
    })
  ]);
  let _dirs = [];
  for (let dir of dirs) {
    if (!dir || _dirs.indexOf(dir) > -1) continue;
    let isFlag = (await utility.existsAsync(dir)) && (await utility.statAsync(dir)).isDirectory();
    if(!isFlag) continue;
    _dirs.push(dir);
  };
  return _dirs;
}

const resolveConfigOptions = async (configOptions, cwd) => {
  let file = '';
  if(typeof configOptions === 'string') {
    file = configOptions || 'defc.apps.config.js';
    file = path.resolve(cwd, file);
    
    if(await utility.existsAsync(file) && (await utility.statAsync(file)).isDirectory()) {
      file = path.resolve(file, 'defc.apps.config.js');
    }
    if((!await utility.existsAsync(file)) || (await utility.statAsync(file)).isDirectory()) {
      return;
    }
    configOptions = require(file);
    if(typeof configOptions === 'function') {
      try{
        configOptions = await configOptions({cwd});
      } catch(e) {
        console.error(file, e);
        return;
      }
    }
  }

  if(!configOptions || typeof configOptions !== 'object') {
    return;
  }

  // 配置文件根目录
  let parentResolveConfig = null;
  let files = file ? [ file ] : [];
  if(configOptions.configFile && typeof configOptions.configFile === 'string') { // 检查是否有配置文件路径模板
    const dir = file ? path.dirname(file) : cwd;
    parentResolveConfig = await resolveConfigOptions(configOptions.configFile, dir);
    files = (parentResolveConfig && parentResolveConfig.files || []).concat(files);
  }
  return {
    files,
    config: setup.utility.merge(parentResolveConfig && parentResolveConfig.config, configOptions)
  };
}
setup.meta = config.meta;
setup.BuildTypeEnum = BuildTypeEnum;
/**
 * 装载相对于cwd 目录下 配置文件
 */
setup.load = async (configOptions, options) => {
  const { cwd = config.cwd, root = config.root } = options || {};
  const resolveConfig = await resolveConfigOptions(configOptions, cwd);
  if (!resolveConfig || !resolveConfig.config) {
    throw 'Not Found Config';
  }
  configOptions = resolveConfig.config;
  // 重新梳理模块依赖位置
  configOptions.dir_node_modules = await check_dir_node_modules(configOptions.dir_node_modules, cwd, resolveConfig.files);
  return setup(configOptions);
}

module.exports = setup;