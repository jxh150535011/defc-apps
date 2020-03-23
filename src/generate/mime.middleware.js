const path = require('path');

const MIME_TYPE_S = {
  '.js': 'text/javascript, application/javascript',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jepg': 'image/jepg',
  '.gif': 'image/gif',
  '.jpg': 'image/jpg',
};
const MIME_ACCEPT_TYPE_S = {
  text: ['html', 'text'],
  application: ['json', 'xml'],
  image: ['png', 'jepg', 'gif'],
};

module.exports = options => {
  return async function (req, res, next) {
    let mimeType = '';
    if (req.method === 'GET' || req.method === 'HEAD') {
      const ext = path.extname(req.path);
      mimeType = MIME_TYPE_S[ext];
    }
    if (!mimeType) {
      const acceptTypeKey = Object.keys(MIME_ACCEPT_TYPE_S).find(key => req.accepts(MIME_ACCEPT_TYPE_S[key]));
      const accept = acceptTypeKey && req.accepts(MIME_ACCEPT_TYPE_S[acceptTypeKey]);
      if (accept) {
        mimeType = `${acceptTypeKey}/${accept}; charset=uft-8`;
      }
    }
    if (mimeType) {
      res.set({
        'Content-type': mimeType,
      });
    }
    return next();
  };
};
/*
//Contetn-type:text/html;charset=utf-8
this.is('html');//=>'html'
this.is('text/html');//=>'text/html'
this.is('text/*', 'test/html');//=>'test/html'

//when Content-type is application/json
this.is('json','urlencoded');//=>'json'
this.is('application/json',);//=>'application/json'
this.is('html','application/*',);//=>'application/json'

this.is('html');//=>false
*/

/**
//Accept:text/*,q=.5, application/json
this.accepts(['html', 'json'])
this.accepts('html', 'json')
//=>json

//No Accepts header
this.accpts('html', 'json')
//=>html
this.accepts('json','html')
//=> json
 */
