import React from 'react';
import { Link, NavLink } from "react-router-dom";
import {Button} from 'antd';

export default () => {
  return (
    <div>
      <Button>typescript</Button>
      <Link to={{ pathname:'/pages/index' }}>前往index</Link>
    </div>
  )
}