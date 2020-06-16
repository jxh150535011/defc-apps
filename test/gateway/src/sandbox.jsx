import React from 'react';
import ReactDOM from 'react-dom';

const RouterView = () => {
  return (
    <div>
      沙箱环境
    </div>
  )
}

ReactDOM.render(
  <RouterView />,
  ['app', 'root'].map(document.getElementById.bind(document))[0]
);
