import express from 'express';
import http from 'http';
import {Server} from "socket.io";
import cors from 'cors';
import webpush from 'web-push';
import {SocketMessage, Subscription} from "./types";
import {privateVapidKey, publicVapidKey} from './config';
import {
  enqueueMessage,
  updateDestination
} from "./messaging";
import {connectSocket, disconnectSocket, relayMessage} from "./messaging-websocket";
import {addWebPushSubscription} from "./messaging-webpush";

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

async function main() {
  // Use connect method to connect to the server
  console.log('Connected successfully to server');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  webpush.setVapidDetails("mailto:example2@yourdomain.org", publicVapidKey, privateVapidKey);

  app.use(express.json());
  app.use(cors(corsOptions));

  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
  });

  app.post('/message', (req, res) => {
    const data = req.body as SocketMessage
    enqueueMessage(data)
    res.end()
  });

  app.post('/push-subscribe', (req, res) => {

    const webSubscription = req.body.webPushSubscription
    const subscription: Subscription = req.body.brokerSubscription
    addWebPushSubscription(subscription, webSubscription)
    updateDestination(subscription.destination)

    res.status(200).json({ 'success': true });
  });

  io.on('connection', (socket) => {

    console.log('a user connected');

    connectSocket(socket)
    const socketId = socket.id

    socket.on('message', (data: any) => {
      relayMessage(data, socketId);
    })

    socket.on('disconnect', () => {
      disconnectSocket(socketId);
    })
  })

  server.listen(30000, () => {
    console.log('listening on *:30000');
  });


  return 'done.';
}

main()
  .then(console.log)
  .catch(console.error)
