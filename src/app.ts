import express from 'express';
import http from 'http';
import {Server, Socket} from "socket.io";
import {Queue} from 'queue-typescript';
import {SocketMessage, Subscription, SubscriptionTopic} from "./types";
import cors from 'cors';
import * as Collections from 'typescript-collections';

const messageQueue = new Queue<SocketMessage>()

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

type Subscriber = {
  topic: SubscriptionTopic,
  socketId: string
}

// map channel addresses (hash from encryption key) to Subscribers
const subscriptions = new Collections.MultiDictionary<string, Subscriber>()
// maps socket id to channel address so we can clean up old sockets
const socketSubscriptions = new Collections.MultiDictionary<string, string>()

async function main() {
  // Use connect method to connect to the server
  console.log('Connected successfully to server');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  let sockets = new Map<string, Socket>()
  app.use(express.json());
  app.use(cors(corsOptions));

  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
  });

  app.post('/message', (req, res) => {
    const data = req.body as SocketMessage
    messageQueue.enqueue(data)
    res.end();
  });

  function updateChannel(channelId: string) {
    const subs = subscriptions.getValue(channelId)
    const subsById = new Collections.MultiDictionary<string, Subscriber>()
    subs.forEach(sub => {
      subsById.setValue(sub.socketId, sub)
    })
    subs.forEach(sub => {
      let subscriptionsOfOthersPerTopic = {}

      // gather subscriptions of other subscribers and send to sub
      subsById.keys().forEach(socketId => {
        if (socketId !== sub.socketId) {
          const otherSocketSubscritions = subsById.getValue(socketId)
          otherSocketSubscritions.forEach(sub => {
            // @ts-ignore
            let num = subscriptionsOfOthersPerTopic[sub.topic];
            if (!num) {
              // @ts-ignore
              subscriptionsOfOthersPerTopic[sub.topic] = 1
            } else {
              // @ts-ignore
              subscriptionsOfOthersPerTopic[sub.topic] = num + 1
            }
          })
        }
      })

      let socket = sockets.get(sub.socketId);
      socket && socket.send({
        topic: 'update',
        destination: channelId,
        encrypted: false,
        body: {
          'subscribers': subscriptionsOfOthersPerTopic
        }
      } as SocketMessage)
    })
  }

  io.on('connection', (socket) => {

    console.log('a user connected');

    const socketId = socket.id
    sockets.set(socketId, socket)

    socket.on('message', (data: any) => {
      const message = data as SocketMessage
      if (message.topic === 'subscribe') {
        const subscription = message.body as Subscription
        subscriptions.setValue(subscription.destination, {topic: subscription.topic, socketId: socketId})
        socketSubscriptions.setValue(socketId, subscription.destination)
        console.log("SUBSCRIBE:" + socketId + " @ " + subscription.destination + " ON TOPIC " + subscription.topic)
        updateChannel(subscription.destination)
      } else if (message.destination) {
        console.log("MESSAGE RECIEVED: " + message.destination + " TOPIC " + message.topic)
        if (subscriptions.containsKey(message.destination)) {
          subscriptions.getValue(message.destination).forEach(subscription => {
            if (subscription.topic === message.topic) {
              console.log("DELIVERING MESSAGE")
              let socket = sockets.get(subscription.socketId);
              socket && socket.send(message)
            }
          })
        }
      }
    })

    socket.on('disconnect', () => {
      const channels = socketSubscriptions.getValue(socketId)
      channels.forEach(channel => {
        const subscriber = subscriptions.getValue(channel).find(sub => {
          return sub.socketId === socketId
        })
        subscriber && subscriptions.remove(channel, subscriber)
      })
      sockets.delete(socketId)
      socketSubscriptions.getValue(socketId).forEach(channelId => {
        updateChannel(channelId)
      })
      console.log('user disconnected');
      socketSubscriptions.remove(socketId)
    })
  })

  server.listen(30000, () => {
    console.log('listening on *:30000');

    setInterval(function () {
      const message = messageQueue.dequeue()
      if (message) {
        console.log("SENDING MESSAGE")
        sockets.forEach(function (socket) {
          socket.send(message)
          /*
          {
                  "subject": "Hello",
                  "to": [{
                      "name": "André Böhlke",
                      "email": "ab@bcoding.de"
                  }],
                  "cc": [],
                  "bcc": [],
                  "replyTo": [],
                  "body": "Multiline<br/>Line 2<br/> Line 3"
              }
           */
        })
      }
    }, 100)
  });


  return 'done.';
}

main()
  .then(console.log)
  .catch(console.error)
