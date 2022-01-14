// maps socket id to channel address so we can clean up old sockets
import {Socket} from "socket.io";
import {DefaultEventsMap} from "socket.io/dist/typed-events";
import * as Collections from "typescript-collections";
import {deliverMessage, subscriptions, updateDestination} from "./messaging";
import {SocketMessage, Subscription} from "./types";

export const socketSubscriptions = new Collections.MultiDictionary<string, string>()
export let sockets = new Map<string, Socket>()

export function disconnectSocket(socketId: string) {
    const channels = socketSubscriptions.getValue(socketId)
    channels.forEach(channel => {
        const subscriber = subscriptions.getValue(channel).find(sub => {
            return sub.socketId === socketId
        })
        subscriber && subscriptions.remove(channel, subscriber)
    })
    sockets.delete(socketId)
    socketSubscriptions.getValue(socketId).forEach(channelId => {
        updateDestination(channelId)
    })
    console.log('user disconnected');
    socketSubscriptions.remove(socketId)
}

export function connectSocket(socket: Socket<DefaultEventsMap, DefaultEventsMap>) {
    sockets.set(socket.id, socket)
}

export function relayMessage(data: any, socketId: string) {
    const message = data as SocketMessage
    if (message.topic === 'subscribe') {
        handleSubscribeMessage(message, socketId, updateDestination)
    } else if (message.destination) {
        console.log("MESSAGE RECEIVED: " + message.destination + " TOPIC " + message.topic)
        if (subscriptions.containsKey(message.destination)) {
            subscriptions.getValue(message.destination).forEach(subscription => {
                if (subscription.topic === message.topic) {
                    console.log("DELIVERING MESSAGE")
                    deliverMessage(subscription, sockets, message);
                }
            })
        }
    }
}

export function handleSubscribeMessage(message: SocketMessage, socketId: string, updateDestination: (destination: string) => void) {
    const subscription = message.body as Subscription
    subscriptions.setValue(subscription.destination, {topic: subscription.topic, socketId: socketId})
    socketSubscriptions.setValue(socketId, subscription.destination)
    console.log("SUBSCRIBE:" + socketId + " @ " + subscription.destination + " ON TOPIC " + subscription.topic)
    updateDestination(subscription.destination)
}
