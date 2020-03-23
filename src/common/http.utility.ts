import {UrlWithStringQuery, parse} from 'url';
import {gunzip} from 'zlib';
import {request as httpRequest,RequestOptions,IncomingMessage,OutgoingHttpHeaders,IncomingHttpHeaders} from 'http';
import {request as httpsRequest} from 'https';
import {connect,constants} from 'http2';


const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_HOST,
  HTTP2_HEADER_DATE,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_STATUS
} = constants;


export const getOriginByUri = (requestOptions:RequestOptions|UrlWithStringQuery):string => {

  // 不支持 express 的 Request 中的 protocol 没有 :
  // let hostname = requestOptions.hostname || requestOptions.host;
  let defaultPort = requestOptions.protocol == 'https:' ? 443 : 80;
  let origin = requestOptions.protocol + '//' + requestOptions.hostname + (':'+(requestOptions.port||defaultPort)).replace(':'+defaultPort,'');
  return origin;
}


export const getOriginByUrl = (url) => {
  return getOriginByUri(parse(url));
}

export interface ProxyRequest {
  url:string,
  data?:Buffer|string,
  method?:string,
  headers?:OutgoingHttpHeaders,
}


export interface ProxyResponse {// 代理的返回结果内容
  status:number,
  headers?:OutgoingHttpHeaders,
  'set-cookie'?:Array<string>,
  content?:Buffer,
  error?:Error,
  request:RequestOptions|null,// 最终发送给服务器的请求体
  response?:IncomingMessage|null,
}

export interface HttpResonse {
  status?:number,
  headers?:IncomingHttpHeaders|undefined,
  // buffer:Buffer,
  content?:Buffer,
  error?:Error
}


export const httpRequestAsync = (requestOptions:RequestOptions,data?:Buffer|string):Promise<HttpResonse> => {
  const headers:OutgoingHttpHeaders | null = requestOptions.headers || null;
  return new Promise((resolve,reject)=>{
    let request = requestOptions.protocol == 'https:' ? httpsRequest : httpRequest;
    const handler = request(requestOptions,(response:IncomingMessage)=>{
      let buffer = Buffer.alloc(0);
      //response.setEncoding('gb2312');
      response.on('data',function(chunk){
          buffer=Buffer.concat([buffer,chunk],buffer.length+chunk.length);
      }).on('end',function(e) {
        // let content = buffer && buffer.toString('utf-8') || '';
        /*
        // 暂时不做gizp解压操作
        if(response.headers && response.headers['content-encoding'] === 'gzip') {
          gunzip(buffer,(err,buffer) => {
            resolve({
              status:response.statusCode,
              headers:response.headers,
              content:buffer
            });
          })
        } else {

        }
        */
        resolve({
          status:response.statusCode,
          headers:response.headers,
          content:buffer
        });

      });
    }).on('error', (e) => {
      reject({
        error:e
      });
    });
  
    if(headers) {
      ['origin','content-type','referer','cookie'].forEach((key)=>{
        let value = headers[key];
        if(value) {
          handler.setHeader(key,value);
        }
      });
    }
    if(data) {
      handler.write(data);
    }
    handler.end();
  });
}


export const http2RequestAsync = (requestOptions:RequestOptions,data?:Buffer|string):Promise<HttpResonse> => {
  //const headers:OutgoingHttpHeaders | null = requestOptions.headers || null;
  return new Promise((resolve,reject)=>{
    let origin = getOriginByUri(requestOptions);
    // let url = origin + requestOptions.path;
    let http2Headers = {};
    let headers = requestOptions.headers || {};
    ['host','upgrade'].forEach(key => {
      http2Headers[key] = headers[key] || '';
      delete headers[key];
    });
    const clientHttp2 = connect(origin);
    const handler = clientHttp2.request({
      ...headers,
      // [HTTP2_HEADER_HOST]:http2Headers['host'] || '',
      [HTTP2_HEADER_PATH]:requestOptions.path,
      [HTTP2_HEADER_METHOD]:requestOptions.method,
    });
    if(data) {
      handler.write(data);
    }
    handler.end();
    handler.on('response', (headers) => {
      let status = Number(headers[HTTP2_HEADER_STATUS]);
      let buffer = Buffer.alloc(0);
      //response.setEncoding('gb2312');
      handler.on('data',function(chunk){
          buffer=Buffer.concat([buffer,chunk],buffer.length+chunk.length);
      }).on('end',function(e) {
        // let content = buffer && buffer.toString('utf-8') || '';
        clientHttp2.close();
        resolve({
          status,
          headers,
          content:buffer
        });
      });
    });

  });
}

export const requestAsync = (requestOptions:RequestOptions,data?:Buffer|string):Promise<HttpResonse> => {
  let upgrade = requestOptions.headers && requestOptions.headers['upgrade'];
  if(upgrade === 'HTTP/2.0') {
    return http2RequestAsync(requestOptions,data);
  }
  return httpRequestAsync(requestOptions,data);
}


export const proxyRequestAsync = async (proxyRequest:ProxyRequest):Promise<ProxyResponse> => {
  let uri = parse(proxyRequest.url);
  let origin = getOriginByUri(uri);
  let headers:OutgoingHttpHeaders = Object.assign({
      'content-type':'text/plain',
    },
    proxyRequest.headers,
    {
      cookieorigin:origin,// 代理优先级最高 cookieorigin origin
      origin:origin,
      host:uri.hostname,
    }
  );
  // 本地部分请求可能会要求服务gizp压缩返回
  //headers['accept-encoding'] = null;
  const httpRequestOptions: RequestOptions = {
    protocol:uri.protocol,
    host:uri.host,// 含有:port
    hostname:uri.hostname,// getOriginByUri 方法需要
    port:uri.port,
    method:proxyRequest.method || 'GET',
    path:uri.path,
    headers:headers,
    // requestCert: true,//请求客户端证书
    // rejectUnauthorized: false//不拒绝不受信任的证书
  };
  /*
  ['accept','cookieorigin','host','content-length','user-agent','cookie'].forEach((key)=>{
      if(headers[key]) {
        httpRequestOptions.headers[key] = headers[key];
      }
  });
  */

  try{
    // console.log('request:',JSON.stringify(httpRequestOptions));
    let {status,headers,content} = await requestAsync(httpRequestOptions,proxyRequest.data);
    let outputHeaders = {};
    let responseHeaders = headers || {};
    Object.keys(responseHeaders).forEach(key => {
      outputHeaders[key] = responseHeaders[key];
    });
    // response.headers['set-cookie'] 拦截cookie
    return {
      status: status || 200,
      content,
      headers:outputHeaders,
      request:httpRequestOptions,
      "set-cookie":outputHeaders['set-cookie']
    };
  } catch(e) {
    return {
      status:500,
      error:e,
      request:httpRequestOptions
    };
  }
};

