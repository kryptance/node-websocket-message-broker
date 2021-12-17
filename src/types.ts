export type SocketMessage = {
    topic: 'subscribe' | 'email' | 'email-sent',
    destination: string,
    body: any
}

export type SubscriptionTopic = 'email' | 'email-sent'

export type Subscription = {
    destination: string,
    topic: SubscriptionTopic
}
