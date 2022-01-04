export type SocketMessage = {
    topic: 'subscribe' | 'update' | SubscriptionTopic,
    destination?: string,
    body: any
}

export type SubscriptionTopic = 'email' | 'email-sent' | 'email-queued'

export type Subscription = {
    destination: string,
    encrypted: boolean,
    topic: SubscriptionTopic
}
