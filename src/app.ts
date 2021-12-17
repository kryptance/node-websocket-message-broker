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

    io.on('connection', (socket) => {

        console.log('a user connected');

        sockets.set(socket.id, socket)

        socket.on('message', (data: any) => {
            const message = data as SocketMessage
            if (message.topic === 'subscribe') {
                const subscription = message.body as Subscription
                subscriptions.setValue(subscription.destination, {topic: subscription.topic, socketId: socket.id})
                console.log("SUBSCRIBE:" + socket.id + " @ " + subscription.destination + " ON TOPIC " + subscription.topic)
            } else {
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
            sockets.delete(socket.id)
            console.log('user disconnected');
        });
    });

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
