import os from 'os'
import cluster from 'cluster'
import serverStart from './start.js'
import {webSocketConnection} from "./socket.js";

// External function for worker
const getMobilityData = async () => {
  // some code
}

// ===== START CLUSTERS =====//
const clusterStart = app => {
  const mainNumCpus = os.cpus().length

  // If cpu count is less than 2, do not use cluster
  if (mainNumCpus < 2) {
    serverStart(app)
    getMobilityData()

    // Separate server for socket
    const socketServer = serverStart(app, true)
    webSocketConnection(socketServer)
  } else {
    if (cluster.isPrimary) {
      const numCpus = os.cpus().length
      console.log(`The total number of CPUs is ${numCpus}`)
      console.log(`Master started. Pid: ${process.pid}`)

      let webSocketWorkerId = null
      let getMobilityDataWorkerId = null

      // Create cluster workers
      for (let i = 0; i < numCpus; i++) {
        const worker = cluster.fork()

        // Initial worker responsible for webSocketConnection
        if (i === 0) {
          webSocketWorkerId = worker.id
          setTimeout(() => {
            worker.send({ type: 'startWebSocketWorker' })
          }, 1000)
        } else if (i === 1) {
          getMobilityDataWorkerId = worker.id
          setTimeout(() => {
            worker.send({ type: 'startGetMobilityDataWorker' })
          }, 1000)
        } else {
          setTimeout(() => {
            worker.send({ type: 'startSimpleWorker' })
          }, 1000)
        }
      }

      cluster.on('exit', worker => {
        if (worker.id === webSocketWorkerId) {
          console.log(`Cluster WebSocket worker with pid=${worker.process.pid} died`)
          console.log(`Starting another WebSocket worker`)
          const webSocketWorker = cluster.fork()
          webSocketWorkerId = webSocketWorker.id

          setTimeout(() => {
            webSocketWorker.send({ type: 'restartWebSocketWorker' })
          }, 1000)
        } else if (worker.id === getMobilityDataWorkerId) {
          console.log(`Cluster GetMobilityData worker with pid=${worker.process.pid} died`)
          console.log(`Starting another GetMobilityData worker`)
          const worker = cluster.fork()
          getMobilityDataWorkerId = worker.id

          setTimeout(() => {
            worker.send({ type: 'restartGetMobilityDataWorker' })
          }, 1000)
        } else {
          console.log(`Cluster simple worker with pid=${worker.process.pid} died`)
          console.log(`Starting another simple worker`)
          cluster.fork()
        }
      })
    }
    if (cluster.isWorker) {
      process.on('message', message => {
        switch (message?.type) {
          // Initial web socket function start
          case 'startWebSocketWorker':
          {
            const server = serverStart(app, true)
            webSocketConnection(server)
          }
            break
          case 'restartWebSocketWorker':
          {
            console.log(`Restarted WebSocket worker Pid: ${process.pid}`)
            const server = serverStart(app, true)
            webSocketConnection(server)
          }
            break
          case 'startGetMobilityDataWorker':
            {
              console.log(`GetMobilityData worker Pid: ${process.pid}`)
              serverStart(app)
              getMobilityData()
            }
            break
          case 'restartGetMobilityDataWorker':
            {
              console.log(`Restarted GetMobilityData worker Pid: ${process.pid}`)
              serverStart(app)
              getMobilityData()
            }
            break
          case 'startSimpleWorker':
            serverStart(app)
            break

          default:
            break
        }
      })
    }
  }
}

export default clusterStart
