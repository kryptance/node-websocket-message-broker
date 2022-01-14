import {Subscription} from "./types";
import {subscriptions} from "./messaging";

export function addWebPushSubscription(subscription: Subscription, webSubscription: any) {
    subscriptions.setValue(subscription.destination, {topic: subscription.topic, webPush: webSubscription})
}
