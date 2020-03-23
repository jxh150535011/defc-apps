import {request, config, registry, getRoute} from '../entry/core';

// import axios from 'axios';
// import('axios');

const main = {
  name: '${name}',
  id: '${id}',
  routes: ${routes || '[]'}
}

const scope = registry(main.name);
// router 打包后 外部被包裹define
registry(main.name, main);
export default {};