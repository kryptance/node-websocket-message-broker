# node-websocket-message-broker
Minimal message broker supporting websocket and push notification based on socket.io and web-push.

Endpoints:

##Websocket
There are the following messages
- subscription message
- un-subscribe message
- message
- update channel

See types.ts

## REST
### /push-subscribe
This will subscribe the web-push to a certain broker destination/topic
#### REQUEST
```json
{
  "webPushSubscription": {
    "endpoint": "https://....",
    "keys": {
      "p256dh": ".....",
      "auth": "....."
    }
  },
  "brokerSubscription": {
    "destination": "064ee3993d081f8d947db3226ec0c3c7cc1a66859094b7c45ca830df133a1fd1",
    "topic": "news"
  }
}
```
#### RESPONSE
```json
{
  "brokerSubscriptionId": "some_random_id"
}
``` 
### /push-unsubscribe
#### REQUEST
```json
{
  "brokerSubscriptionId": "some_random_id"
}
``` 
