import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Link } from "react-router-dom";
import { Route, Switch, useRouteMatch, withRouter } from 'react-router';
import * as client from '@alicloud/defc-apps/client';

import './registerServiceWorker.js';
import { useAsync } from 'react-use';


const invoke = async (pathname) => {
  const clientConfig = client.config();// 每次获取配置信息
  const scopes = clientConfig && clientConfig['scope'] || {};
  for(let key in scopes) {
    if(!scopes.hasOwnProperty(key)) continue;
    const scope = scopes[key];
    const route = await client.getRoute(key, pathname);
    if(route) {
      const url = client.resolveUrl(scope.remote, route.id);
      return client.request(url);
    }
  }
};

const useRoute = (location) => {
  const { pathname, search, hash } = location;
  const result = useAsync(async () => {
    let callback = await invoke(pathname);
    if(!callback) {
      return {
        status: 404
      };
    }
    try {
      // 检查是否为 React.Component类继承组件，在其原型链上 应该有 React.Component类
      if(React.Component.isPrototypeOf(callback)) {
        return {
          status: 200,
          view: callback
        };
      }
      if(typeof callback === 'function') {
        // 进行简易判断 是否属于 函数组件 .createElement( 目前返回的函数组件 必定内部继承于 React.Component
        /*
        if(/[.]createElement\(/.test(callback.toString())) {
          return callback;
        }
        */
        callback = await callback();
      }
      return {
        status: 200,
        view: callback
      };
    } catch(e) {
      console.error(e, callback);
      return {
        status: 500,
        error: e
      };
    }
  }, [ pathname, search, hash ]);

  const loading = result.loading;
  const { view, status, error } = result.value || {};
  return {
    loading,
    view, status, error
  }
}

const IndexView = withRouter((props) => {
  const route = useRoute(props.location);
  if(route.loading) {
    return (
      <div>loading</div>
    )
  }
  if(route.status !== 200) {
    return (
    <div>Stauts: {route.status}, Error {JSON.stringify(route.error)}</div>
    );
  }
  if(route.view instanceof React.Component || typeof route.view === 'function') {
    return (
      <route.view />
    )
  }
  return (
    <div>
      {JSON.stringify(route.view)}
    </div>
  )
});

const RouterView = () => {
  return (
    <Router>
      <IndexView />
    </Router>
  )
}

ReactDOM.render(
  <RouterView />,
  ['app', 'root'].map(document.getElementById.bind(document))[0]
);
