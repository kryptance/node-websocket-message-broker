import webpush from "web-push";
import {Subscription, SocketMessage, Subscriber} from "./types";
import {subscriptions} from "./messaging";

export function addWebPushSubscription(subscription: Subscription, webSubscription: any) {
    subscriptions.setValue(subscription.destination, {topic: subscription.topic, webPush: webSubscription})
}

export function sendPushNotification(subscription: Subscriber, message: SocketMessage) {
    const payload = JSON.stringify({
        title: message.body.title,
        description: message.body.description,
        icon: message.body.icon
    });

    webpush.sendNotification(subscription.webPush, payload)
        .then(() => console.log('Successfully sent.'))
        .catch(e => {
            console.log(e.stack)

            // Remove the failed subscriptions
            const auth = subscription.webPush.keys.auth
            const subsForDestination = subscriptions.getValue(message.destination as string)
            subscriptions.remove(message.destination as string)
            
            subsForDestination
                .filter(sub => (sub.webPush.keys.auth !== auth))
                .map(sub => subscriptions.setValue(message.destination as string, sub))
        });
}
