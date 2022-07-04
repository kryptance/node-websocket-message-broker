export type SocketMessage = {
    topic: 'subscribe' | 'update' | SubscriptionTopic,
    destination?: string,
    body: any
}

export type SubscriptionTopic = string

export type Subscription = {
    destination: string,
    encrypted: boolean,
    topic: SubscriptionTopic
}

export type Subscriber = {
    topic: SubscriptionTopic,
    socketId?: string,
    webPush?: any
}
