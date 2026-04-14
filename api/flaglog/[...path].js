export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/flaglog/, '') || '/'
  const url = `https://flaglog.com${path}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': req.headers['accept'] || '*/*',
    },
  })

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'public, max-age=86400')

  const buffer = await response.arrayBuffer()
  res.status(response.status).send(Buffer.from(buffer))
}
