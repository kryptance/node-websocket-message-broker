import * as Collections from "typescript-collections";
import {Socket} from "socket.io";
import {SocketMessage, SubscriptionTopic} from "./types";
import webpush from "web-push";
import {Queue} from "queue-typescript";
import {sockets} from "./messaging-websocket";

export type Subscriber = {
    topic: SubscriptionTopic,
    socketId?: string,
    webPush?: any
}
// map channel addresses (hash from encryption key) to Subscribers
export const subscriptions = new Collections.MultiDictionary<string, Subscriber>()

export function deliverMessage(subscription: Subscriber, sockets: Map<string, Socket>, message: SocketMessage) {
    if (subscription.socketId) {
        let socket = sockets.get(subscription.socketId);
        socket && socket.send(message)
    } else if (subscription.webPush) {
        const payload = JSON.stringify({
            title: message.body.title,
            description: message.body.description,
            icon: message.body.icon
        });

        webpush.sendNotification(subscription.webPush, payload)
            .then(result => console.log(''))
            .catch(e => {
                console.log(e.stack)
            });
    }
}

export function updateDestination(destination: string) {
    const subs = subscriptions.getValue(destination)
    const subsById = new Collections.MultiDictionary<string, Subscriber>()
    let webPushSubs: Subscriber[] = []
    subs.forEach(sub => {
        if(sub.socketId) {
            subsById.setValue(sub.socketId, sub)
        } else {
            webPushSubs.push(sub)
        }
    })
    subs.forEach(sub => {
        let subscriptionsOfOthersPerTopic = {}

        function incSubscriptionTopic(sub: Subscriber) {
            // @ts-ignore
            let num = subscriptionsOfOthersPerTopic[sub.topic];
            if (!num) {
                // @ts-ignore
                subscriptionsOfOthersPerTopic[sub.topic] = 1
            } else {
                // @ts-ignore
                subscriptionsOfOthersPerTopic[sub.topic] = num + 1
            }
        }

        // gather subscriptions of other subscribers and send to sub
        subsById.keys().forEach(socketId => {
            if (socketId !== sub.socketId) {
                const otherSocketSubscritions = subsById.getValue(socketId)
                otherSocketSubscritions.forEach(sub => {
                    incSubscriptionTopic(sub)
                })
            }
        })
        webPushSubs.forEach(sub => {
            incSubscriptionTopic(sub)
        })

        if(sub.socketId) {
            let socket = sockets.get(sub.socketId);
            socket && socket.send({
                topic: 'update',
                destination: destination,
                encrypted: false,
                body: {
                    'subscribers': subscriptionsOfOthersPerTopic
                }
            } as SocketMessage)
        }
    })
}

const messageQueue = new Queue<SocketMessage>()
export function enqueueMessage(data: SocketMessage) {
    messageQueue.enqueue(data)
}
// TODO: this is for sending message using POST... not yet implemented
// setInterval(deliverQueuedMessages, 100)
// export  function deliverQueuedMessages () {
//     const message = messageQueue.dequeue()
//     if (message) {
//         console.log("SENDING MESSAGE")
//         sockets.forEach(function (socket) {
//             socket.send(message)
//         })
//     }
// }

