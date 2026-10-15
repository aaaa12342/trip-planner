const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
module.exports = function (extra = {}) {
  const c = { console, setTimeout, clearTimeout, AbortController, DOMException, URLSearchParams, URL, ...extra };
  c.window = c; vm.createContext(c);
  for (const name of ['core','planner','journey','arrival','data','cities-rich','cities-extra','city-attractions','scenic','stay','weather','catalog','stay-engine','editor','storage'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),c);
  return c;
};
