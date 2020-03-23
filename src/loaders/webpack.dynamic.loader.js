const url = require('url');
const loaderUtils = require('loader-utils'); 
const scriptModule = require('../common/script.module.js');

/**
 * 创建模板编译对象
 */
function compiledTemplate(bundle) {
  const script = scriptModule.compiled('module.exports = ' + 
    [
      '`',
      bundle.replace(/`/g,'\\`'),
      '`'
    ].join('')
  );
  return function(context) {
    return scriptModule.evaluate(script, context);
  }
};

// import 如果 属于 dll-reference 或 externals 不回在触发loader 加载器
module.exports = function (content, map, meta) {
  // const opitons = loaderUtils.getOptions(this) || {};
  // const query = loaderUtils.parseQuery(this.query);
  const uri = url.parse(this.resource);
  const query = uri.search ? loaderUtils.parseQuery('?' + uri.search.substr(1)) : {};
  const hash = uri.hash ? uri.hash.substr(1) : '';
  const template = compiledTemplate(content);
  
  const context = {
    pathname:hash,
    ...query
  };
  try {
    return template(context);
  } catch(e) {
    console.log('dynamic.loader', e);
    return e;
  }
};

