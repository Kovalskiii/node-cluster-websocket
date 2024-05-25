import testRoutes from '../router/testRoutes.js'

export default function routes(app) {
  app.use('/node-cluster-api/testRoutes/', testRoutes)
  app.get('/node-cluster-api', function (req, res) {
    res.send('Node cluster server is alive')
  })
  app.get('/', function (req, res) {
    res.send('Node cluster server is alive')
  })
}
