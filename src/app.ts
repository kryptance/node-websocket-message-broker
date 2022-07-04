import express from 'express';
import http from 'http';
import {Server} from "socket.io";
import cors from 'cors';
import webpush from 'web-push';
import dotenv from 'dotenv';
import {SocketMessage, Subscription} from "./types";
import {
  enqueueMessage, MessageQueue,
  updateDestination
} from "./messaging";
import {connectSocket, disconnectSocket, relayMessage} from "./messaging-websocket";
import {addWebPushSubscription} from "./messaging-webpush";

dotenv.config();

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const queue = new MessageQueue({
    host: "127.0.0.1",
    port: 6379,
    password: 'eYVX7EwVmmxKPCDmwMtyKVge8oLd2t81',
    queueName: 'messages'
  })

  webpush.setVapidDetails(
    "mailto:admin@kryptance.de",
    process.env.PUBLIC_VAPID_KEY || '',
    process.env.PRIVATE_VAPID_KEY || '',
  )

  app.use(express.json());
  app.use(cors(corsOptions));

  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
  })

  app.post('/message', (req, res) => {
    const data = req.body as SocketMessage
    queue.enqueueMessage(data).then(() => {
      res.end()
    })
  })

  app.post('/push-subscribe', (req, res) => {
    const webSubscription = req.body.webPushSubscription
    const subscription: Subscription = req.body.brokerSubscription
    addWebPushSubscription(subscription, webSubscription)
    updateDestination(subscription.destination)

    res.status(200).json({
      'success': true
    })
  })

  io.on('connection', (socket) => {
    console.log('a user connected')

    connectSocket(socket)
    const socketId = socket.id

    socket.on('message', (data: any) => {
      relayMessage(data, socketId)
    })

    socket.on('disconnect', () => {
      disconnectSocket(socketId)
    })
  })

  server.listen(30000, () => {
    console.log('listening on *:30000')
  })

  return 'done.'
}

main()
  .then(console.log)
  .catch(console.error)
