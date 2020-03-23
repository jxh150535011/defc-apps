const vm = require('vm');
const nativeModule = require('module');

function createContext(initialRunContext) {
  const _context = {
    Buffer,
    console,
    process,
    setTimeout,
    setInterval,
    setImmediate,
    clearTimeout,
    clearInterval,
    clearImmediate,
    __INITIAL_RUN_CONTEXT__: initialRunContext,
  }
  _context.global = _context
  return _context;
}

module.exports = {
  isScript(script) {
    return vm.Script.prototype.isPrototypeOf(script);
  },
  compiled(code,options = {}) {
    const wrapper = nativeModule.wrap(code);
    if(typeof options === 'string') {
      options = {filename:options};
    }
    return new vm.Script(wrapper, {
      displayErrors: true,
      ...options
    });
  },
  evaluate(script,context) {
    // compiledWrapper =>  function(exports, require, module, __filename, __dirname)
    const compiledWrapper = (!context || context === global) ? script.runInThisContext() : script.runInNewContext(context);
    const _module = {
      exports: {}
    };
    const _require = (file) => {
      console.log('file',file,path.posix.join('.', file));
    }
    compiledWrapper.call(_module.exports, _module.exports, _require, _module);
    if(typeof _module.exports === 'object' && _module.exports.hasOwnProperty('default')) {
      return _module.exports.default;
    }
    return _module.exports;
    /*
    const r = file => {
      file = path.posix.join('.', file)
      if (files[file]) {
        return evaluateModule(file, sandbox, evaluatedFiles)
      } else if (basedir) {
        return require(resolvedModules[file] ||
          (resolvedModules[file] = _resolve.sync(file, { basedir })))
      } else {
        return require(file)
      }
    }
    compiledWrapper.call(m.exports, m.exports, r, m)

    const res = Object.prototype.hasOwnProperty.call(m.exports, 'default')
      ? m.exports.default
      : m.exports
    evaluatedFiles[filename] = res
    return res
    */
  },
  
  /**
   * 编译b
   */
  createBundleRunnerEvaluate(code) {
    const compiledScripts = {};
    const resolvedModules = {};
    return (context) => {
      let script = this.compiled(code);
      return this.evaluate(script,context);
    }
  },
  /**
   * 编译并执行某一个对应文件
   */
  exec(bundle,context) {
    let script = this.compiled(bundle);
    return this.evaluate(script,context);
  },
  createBundleRunner(bundle,context) {
    let runner;
    let initialRunContext = {};
    let runnerEvaluate = this.createBundleRunnerEvaluate(bundle);

    return async (runContext = {}) => {
      if(!runner) {
        context = context === false ? global : createContext(initialRunContext);
        runner = runnerEvaluate(context);
      }
      runContext._registeredComponents = new Set();
      if(initialRunContext._styles) {
        runContext._styles = initialRunContext._styles;// 直接复用
        const renderStyles = initialRunContext._renderStyles;
        if (renderStyles) {
          Object.defineProperty(runContext, 'styles', {
            enumerable: true,
            get() {
              return renderStyles(runContext._styles)
            },
          })
        }
      }
      return runner;
    }
  },
}