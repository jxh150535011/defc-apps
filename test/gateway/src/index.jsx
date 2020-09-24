import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Link } from "react-router-dom";
import { Route, Switch, useRouteMatch, withRouter } from 'react-router';
import scope from '@scope';

import '../registerServiceWorker.js';
import { useAsync } from 'react-use';

const routes = [ '/pages/index', '/pages/about', '/pages/package.json', '/pages/typescript' ];

const AsynComponent = (props) => {
  const {component,...params} = props;
  const result = useAsync(async () => {
    return component();
  }, [component]);

  if(result.loading) {
    return (
      <div>Loading </div>
    );
  }
  if(result.error || !result.value) {
    return (
      <div>Error {JSON.stringify(result.error)}</div>
    );
  }
  const View = result.value && result.value.default;
  if(View instanceof React.Component || typeof View === 'function') {
    return (
      <View />
    )
  }
  return (
    <div>
      {JSON.stringify(result.value)}
    </div>
  )

}

const IndexView = (props) => {
  // const match = useRouteMatch(routes);
  return (
    <div>
      hello world<br/>
      <Link to={{ pathname:'/pages/about' }}>前往about</Link>
      <Link to={{ pathname:'/pages/index' }}>前往index</Link>
      <Link to={{ pathname:'/pages/package.json' }}>前往package</Link>
      <div>
        错误的模块加载
        <AsynComponent component={() => scope.request('/unkown')} />
      </div>
      <div>
        动态独立编译模块加载
        <AsynComponent component={() => scope.request('/pages/demo')} />
      </div>
      <div>
        简单静态资源内容加载
        <AsynComponent component={() => scope.request('http://127.0.0.1:7001/static/demo')} />
      </div>
    </div>
  )
};


const renderRoutes = (routes) => {
  return routes.map(route => {
    return (
      <Route
        key={route}
        path={route}
        component={() => {
          return (
            <AsynComponent component={() => scope.request(route)} />
          );
        }}
      >
      </Route>
    )
  })
}
const RouterView = () => {
  return (
    <div>
      当前注册信息<br/>
      <AsynComponent component={() => scope.registry} />
      <div>
        公共模块
        <AsynComponent component={() => import('./com.jsx')} />
      </div>
      <Router>
        <Switch>
          {renderRoutes(routes)}
          <IndexView />
        </Switch>
      </Router>
    </div>
  )
}

ReactDOM.render(
  <RouterView />,
  ['app', 'root'].map(document.getElementById.bind(document))[0]
);
