import jwt from 'jsonwebtoken'
import { WebSocket, WebSocketServer } from 'ws'
import { v4 as uuidV4 } from 'uuid'

// External function for worker
// For client use:
// const url = new URL(process.env.REACT_APP_MAP_SERVER_API_URL)
// const serverHost = url.host // This includes both the hostname and the port
// let socketUrl
//
// if (process.env.REACT_APP_START_TYPE === 'dev') {
//   socketUrl = `ws://${serverHost}`
// } else {
//   socketUrl = `wss://${serverHost}`
// }
// const ws = new WebSocket(socketUrl, [process.env.REACT_APP_MAP_SERVER_API_SOCKET_CONNECTION_TOKEN])
// External function for worker
export const webSocketConnection = async (server) => {
  const wss = new WebSocketServer({
    server,
    verifyClient: function (info, done) {
      const origin = info.origin
      const { NODE_ENV, FRONT_END_APP_URL_PROD, FRONT_END_APP_URL_DEV } = process.env
      let checkedOrigin

      if (NODE_ENV === 'prod') {
        checkedOrigin = FRONT_END_APP_URL_PROD
      } else {
        checkedOrigin = FRONT_END_APP_URL_DEV
      }

      // Check if the origin is in the list of allowed origin
      if (origin === checkedOrigin) {
        done(true)
      } else {
        console.log(`Websocket connection fail - wrong origin: ${origin}`)
        done(false, 401, 'Unauthorized')
      }
    },
  })

  const activeClients = new Map()

  // Handle new connection
  wss.on('connection', async ws => {
    const clientId = uuidV4()

    // Store the WebSocket connection along with the client ID
    activeClients.set(clientId, ws)

    // Send the client ID to the connected client
    ws.send(JSON.stringify({ event: 'clientId', payload: clientId }))
    console.log(`Socket - client connected with ID: ${clientId}`)

    ws.on('message', async message => {
      try {
        const data = JSON.parse(message)

        if (typeof data !== 'object' && data === null) {
          console.log('Socket - received not valid JSON message')
          ws.send(JSON.stringify({ event: 'error', payload: 'Server received not valid JSON message' }))
        }
      } catch (error) {
        console.error('Socket - error parsing JSON message')
        ws.send(JSON.stringify({ event: 'error', payload: 'Server received not valid JSON message. Error parsing JSON message' }))
      }
    })

    ws.on('pong', () => {})

    const interval = setInterval(() => {
      ws.ping()
    }, 30000)

    // Handle close connection
    ws.on('close', async () => {
      console.log(`Socket - client: ${clientId} disconnected`)
      clearInterval(interval)

      // Remove the disconnected client from the map
      activeClients.delete(clientId)
    })
  })

  // Handle upgrade of the request
  server.on('upgrade', function upgrade(request, socket, head) {
    const { headers } = request
    const token = headers['sec-websocket-protocol']

    if (!token || !authenticateToken(token)) {
      console.log('Websocket connection fail - Unauthorized')
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
    }
  })

  // Authenticate the token
  function authenticateToken(token) {
    try {
      if (token !== process.env.SOCKET_CONNECTION_ACCESS_TOKEN) {
        return false
      }
      // decoded JWT key
      return jwt.verify(token, process.env.JWT_KEY)
    } catch (error) {
      return null
    }
  }

  // Broadcast function to send a message to all connected clients
  function broadcast(message) {
    const jsonMessage = JSON.stringify(message)

    activeClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonMessage)
      }
    })
  }
}
