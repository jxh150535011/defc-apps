import React from 'react';
import { useAsync } from 'react-use';
import { NavLink } from "react-router-dom";
import {Button} from 'antd';
import './index.less';
import './index.css';

const prefix = 'ui-demo-block'

const AsynComponent = (props) => {
  const {component,...params} = props;
  const result = useAsync(async () => {
    return component();
  }, [component]);
  console.log(222, result);
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

export default () => {
  return (
    <div className={prefix}>
      <div className="global-index">
        index私有模块
        <AsynComponent component={() => import('./com')} />
      </div>
      <Button>index</Button>
      <NavLink to='/pages/about'>前往about</NavLink>
    </div>
  )
}