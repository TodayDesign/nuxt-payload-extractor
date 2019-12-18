const fs = require('fs')
const path = require('path')

const timestampKey = '__NUXT-VERSION__'
const payloadKey = '__NUXT__'

let extractPayload = function(html, route, timestamp){
  let chunks = html.split('<script>window.__NUXT__=')
  let pre = chunks[0]
  let payload = chunks[1].split('</script>').shift()
  let post = chunks[1].split('</script>').slice(1).join('</script>')
  let path = route === '/' ? '' : route

  return {
    html: pre + '<script defer src="' + path + '/payload' + timestamp + '.js"></script>' + post,
    payload
  }
}

let getAbsoluteDir = function(root, route) {
  let normalizedRoute = route[0] === '/' ? route : '/' + route
  return root + normalizedRoute
}

let writePayload = function(payload, route, root, timestamp){
  let dir = getAbsoluteDir(root, route)

  let subpath = root
  for(let subdir of route.split('/')){
    if(subdir){
      subpath += '/' + subdir
      if (!fs.existsSync(subpath)) fs.mkdirSync(subpath);
    }
  }

  let payloadBody = `window.${payloadKey}=${payload}`

  fs.writeFile(path.resolve(dir, `payload${timestamp}.js`), payloadBody, 'utf8', err => {
    if (err) return console.error('Error', err);
  });

  let data = ''

  if (payload.startsWith('function')) {
    data = eval('('+payload+')')
  } else {
    data = eval(payload)
  }

  // if routes are nested, merge them into one object
  let availableData = data.data
    .filter(d => Object.keys(d).length > 0)
    .reduce((prev, current) => {
      const colidingKey = Object.keys(prev).find(key => Object.keys(current).includes(key))
      if(colidingKey)
        console.error('Payload-extractor fails to extract nested routes data correctly because two routes have same field returned by asyncData: ' + colidingKey)
      if(Object.keys(current).length > 1)
        console.warn('Payload-extractor had to duplicate some nested routes data in extracted payload')
      return { ...prev, ...current }
    }, {})

  fs.writeFile(path.resolve(dir, `payload${timestamp}.json`), availableData ? JSON.stringify(availableData) : '', 'utf8', err => {
    if (err) return console.error('Error new', err);
  });
}

module.exports = function extractor({ blacklist, versioning }) {
  let timestamp = '';
  if(versioning) timestamp = +(new Date())

  this.nuxt.hook('generate:page', async page => {
    if(!this.nuxt.options.generate.subFolders) throw new Error('generate.subFolders should be true for nuxt-payload-extractor');
    if(blacklist && blacklist.includes(page.route)) return page;

    const distDir = this.nuxt.options.generate.dir

    let { html, payload } = extractPayload(page.html, page.route, timestamp)
    writePayload(payload.replace(/^\;/, ''), page.route, distDir, timestamp)

    page.html = html

    return page
  })

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.js'),
    options: {
      timestamp
    }
  })
}

module.exports.meta = require('../package.json')
