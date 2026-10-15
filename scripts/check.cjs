const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');let count=0;
for(const name of fs.readdirSync(path.join(root,'js')).filter(name=>name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root,'js',name),'utf8'),{filename:name});count++;
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^"#?]+)(?:\?[^"#]*)?"/g))
  if(!fs.existsSync(path.join(root,match[1])))throw new Error('Missing asset: '+match[1]);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate page element id');
const navigation=html.match(/<nav class="result-nav"[\s\S]*?<\/nav>/)[0];
const targets=[...navigation.matchAll(/href="#([^"]+)"/g)].map(match=>match[1]);
let previous=-1;
for(const id of targets) {
  const position=html.indexOf('id="'+id+'"');
  if(position<0 || position<=previous)throw new Error('Navigation order differs from content: '+id);
  previous=position;
}
for(const asset of ['leaflet.js','leaflet.css','LICENSE','images/layers.svg'])
  if(!fs.existsSync(path.join(root,'vendor','leaflet',asset)))throw new Error('Missing local map asset: '+asset);
new vm.Script(fs.readFileSync(path.join(root,'vendor','leaflet','leaflet.js'),'utf8'),{filename:'vendor/leaflet/leaflet.js'});
const gsapRoot=path.join(root,'vendor','gsap');
const gsapSource=JSON.parse(fs.readFileSync(path.join(gsapRoot,'SOURCE.json'),'utf8'));
const gsapBytes=fs.readFileSync(path.join(gsapRoot,'gsap.min.js'));
if(require('node:crypto').createHash('sha256').update(gsapBytes).digest('hex')!==gsapSource.sha256)throw new Error('GSAP integrity mismatch');
new vm.Script(gsapBytes.toString('utf8'),{filename:'vendor/gsap/gsap.min.js'});
const audit=require('../tests/context.cjs')().TripCatalog.audit();
if(audit.errors.length||audit.warnings.length)throw new Error(JSON.stringify(audit));
console.log('Checked '+count+' JavaScript files, HTML assets/ids, '+audit.counts.cities+' cities and '+audit.counts.scenic+' scenic destinations');
