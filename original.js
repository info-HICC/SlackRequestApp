const { App, ExpressReceiver} = require('@slack/bolt');

var PORT = process.env.PORT || 3000;
var token = process.env.SLACK_BOT_TOKEN;

//Custom Receiver docs here: https://slack.dev/bolt-js/concepts#custom-routes
//creating a Bolt Receiver
const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
})

// Creating Bolt App using the Receiver
const app = new App({
    token: token,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    receiver,
});

//this is a slack interaction. using "app" is for Slack methods.
app.event("message", async ({ event, context }) => {
    console.log("event, message")
    console.log("Event")
    console.log(event);
    console.log("Context")
    console.log(context);
})

//this is a web request, things that aren't slack interactions.
receiver.router.get('/', async (req, res) => {
    res.send("Hello World!\nThis is using @slack/bolt's web receiver, no express.js.")
})

(async () => {
    await app.start(process.env.PORT || PORT);
    console.log('⚡️ Bolt app started');
})();