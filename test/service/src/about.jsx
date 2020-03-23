import React from 'react';
import { NavLink } from "react-router-dom";

export default () => {
  return (
    <div>
      about
      <NavLink to='/pages/index'>前往index</NavLink>
    </div>
  )
}