import * as Collections from "typescript-collections";
import {SocketMessage, Subscriber} from "./types";
import {Queue} from "queue-typescript";
import {sendMessage, sockets} from "./messaging-websocket";
import {sendPushNotification} from "./messaging-webpush"
import RedisSMQ, {QueueMessage} from "rsmq"

// map channel addresses (hash from encryption key) to Subscribers
export const subscriptions = new Collections.MultiDictionary<string, Subscriber>()

export function deliverMessage(subscription: Subscriber, message: SocketMessage) {
  if (subscription.socketId) {
    sendMessage(subscription, message)
  } else if (subscription.webPush) {
    sendPushNotification(subscription, message)
  }
}

export function updateDestination(destination: string) {
  const subs = subscriptions.getValue(destination)
  const subsById = new Collections.MultiDictionary<string, Subscriber>()
  let webPushSubs: Subscriber[] = []
  subs.forEach(sub => {
    if (sub.socketId) {
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

    if (sub.socketId) {
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

export class MessageQueue {
  private rsmq: RedisSMQ
  private queueName: string

  constructor(options: RedisSMQ.ConstructorOptions & { queueName: string }) {
    this.rsmq = new RedisSMQ(options)
    this.queueName = options.queueName
    this.startRecieveLoop()

    /*
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
     */
  }

  startRecieveLoop() {
    setInterval(() => {
      // alternative to receiveMessage would be popMessage => receives the next message from the queue and deletes it.
      this.rsmq.receiveMessage({ qname: this.queueName }, (err, resp) => {
        const response = resp as QueueMessage
        if (err) {
          console.error(err)
          return
        }

        // checks if a message has been received
        if (response.id) {
          console.log("received message:", response.message)

          // we are done with working on our message, we can now safely delete it
          this.rsmq.deleteMessage({ qname: this.queueName, id: response.id }, (err) => {
            if (err) {
              console.error(err)
              return
            }

            console.log("deleted message with id", response.id)
          });
        }
      })
    }, 50);
  }

  async init(): Promise<void> {
    const list = await this.rsmq.listQueuesAsync()
    if (!list.includes(this.queueName)) {
      await this.rsmq.createQueueAsync({
        qname: this.queueName
      })
    }
  }

  async enqueueMessage(data: SocketMessage): Promise<string> {
    return this.rsmq.sendMessageAsync({
      qname: this.queueName,
      message: JSON.stringify(data)
    })
  }
}
