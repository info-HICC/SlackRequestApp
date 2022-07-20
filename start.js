const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const path = require('path');
const nodecron = require('node-cron');

// set up nodecron to ping the heroku server every once in a while within 30 minutes
nodecron.schedule('*/20 * * * *', () => {
  console.log("Pinging Heroku Server to keep alive app...");
  axios.get('https://slack-requestapp.herokuapp.com/nodecron-ping');
});

// Custom Receiver docs here: https://slack.dev/bolt-js/concepts#custom-routes
//Using the template found in the docs linked above.

// Create a Bolt Receiver
const receiver = new ExpressReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET });

// Create the Bolt App, using the receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});


// This is pretty much not used, but it's here for reference in the future if we ever need something like this.
// //This is using the built-in Slack Workflow app
// // Slack interactions are methods on app
// app.event('message', async ({ event, client }) => {
//   // Do some slack-specific stuff here
//   if (event.channel == process.env.msgIntegrationChannel_Workflow) { //channel is called "request-workflow-logs", but need channel ID
//     try {
//         var msgFromWorkflow = event.text;
//         console.log("Slack Request Workflow has posted a message to the channel called \"request-workflow-logs\".");
//     axios
//         .post(process.env.zapierWebhookURL, {
//             "text": `${msgFromWorkflow}`
//         })
//         .then(function (response) {
//             console.log("Response about POST request status from Zapier:\n");
//             console.log(response.data.status);
//         });
//     } catch (error) {
//         console.log(error);
//     }
//   }
// });


//This is for the Google Forms version of the app.
app.event("reaction_added", async ({ event, client }) => {
  try {
    //Returns the following important info
      //user ID of user who reacted
      //reaction name without the two : marks on either side
      //item that the reaction was on.
        //we want item.channel and item.ts to get the contents of that message only if there's a specific reaction by a specific user. 
    var allowedApproversIDsENV = process.env.allowedApproverIDs;
    var allowedApproversIDsArray = allowedApproversIDsENV.split(",");
    var reactorUserID = event.user;
    var reactionName = event.reaction;
    var reactionTS = event.event_ts; //this is when the reaction happened


    //just initial check to make sure reaction is in channel we want, and that the user is in the list of allowed approvers, and that the reaction is one of the ones we want.
    if (allowedApproversIDsArray.includes(reactorUserID) == true && (reactionName == "white_check_mark" || reactionName == "negative_squared_cross_mark") && event.item.channel == process.env.requests_googleforms) {
      console.log("User reacted with a valid reaction in the allowed channel using an allowed user ID.");
      console.log("Starting to get content of message that the user reacted to.");
      var channelReactedMessageIsIn = event.item.channel;
      var timestampOfMessage = event.item.ts; //this is when the message that was reacted to was sent.
      
      
      //getting the message that was reacted to using the channel and timestamp.
      //then extracting the requestID from the message.
      var allMessages = await client.conversations.history({
        channel: channelReactedMessageIsIn,
        inclusive: true,
        latest: timestampOfMessage,
      })
      var messageText = allMessages.messages[0].text;
      console.log("Message contents of reacted message obtained.")
      console.log("Starting regex check to get the request ID from the message.");

      //Put a check on whether or not the RequestID is in the message, 
      //otherwise message reactor that the message they reacted to was invalid to prevent errors. 
      if (messageText.includes("RequestID:") == true) {

        var messageRequestID = messageText.match(/```RequestID:.*```/)[0].split("```")[1].split(":")[1]; //returns string with Request ID from the reacted message
        console.log("Request ID obtained from message.");
        console.log("Starting to get JSON version of the request with the oldest message being as old as the original message that was reacted to, and the newest message being sent 5 seconds after the message that was reacted to.");

        //get the requester's userID from "messageText"
        var requesterUserID = messageText.match(/<@.*>/)[0].split("@")[1].split(">")[0];

        if (reactionName == "white_check_mark") {
          //use the requestID to check if the additional details form has been filled out for the specified requestID, if request was approved. Otherwise, send a message to the approver (aka the user who reacted) telling them to fill it out then react again. 
          //use function on line 52 called "checkIfFormFilledOut()" to check if the form has been filled out, by matching the requestID to messages sent within 30 minutes of the reaction. 
          //if the form has been filled out, then it should continue the steps below, otherwise, it'll message and then encapsulate the stuff below this point
          // into an if statement. So that it only runs if the form has been filled out.
          //function to check if the approved messages has filled out the additional details form.
          var additionalInfoText = "";
          var ReactionTimestampMinus30Minutes = reactionTS - 1800;
          var AdditionalInfo_messagesArray = await client.conversations.history({
            channel: process.env.additionalInfoChannel,
            inclusive: true,
            latest: reactionTS,
            oldest: ReactionTimestampMinus30Minutes.toString(),
          });
          if (AdditionalInfo_messagesArray.messages.length > 0) {
            for (i=0; i<AdditionalInfo_messagesArray.messages.length; i++) {
              if (JSON.parse(AdditionalInfo_messagesArray.messages[i].text).AdditionalInfoForReqID == messageRequestID) {
                additionalInfoText = AdditionalInfo_messagesArray.messages[i].text;
                break;
              } else {
                await client.chat.postMessage({
                  channel: reactorUserID,
                  text: `Please fill out the additional details form for this requestID \`${messageRequestID}\` before approving it. Please react to the request message again once you have filled it out.`,
                });
                return;
              };
            };
          } else {
            console.log("No additional info messages found for this requestID. DM'ing reactor to fill out the form.");
            await client.chat.postMessage({
              channel: reactorUserID,
              text: `Please fill out the additional details form for this requestID \`${messageRequestID}\` before approving it. Please react to the request message again once you have filled it out.`,
            });
            return;
          }
          console.log("If this is reached, then the form has been filled out. Otherwise, this should not be reached.");

          //use the request ID to get the JSON version of the request by looking for a message
          //sent between the time the original, reacted message was sent and 5 seconds after it.
          var allMessages_JSONChannel = await client.conversations.history({
            channel: process.env.requests_googleforms_json,
            inclusive: true,
            oldest: timestampOfMessage,
            latest: (parseInt(timestampOfMessage)+5).toString(), 
            //the most recent message is the message that is sent, at most, 5 seconds after the message that was reacted to.
            //oldest combined with latest ensures that the messages that are returned are the messages that were sent after the original reacted message
            //which happens before the JSON version of the message is sent. 
            //Adding 5 seconds is to just allow for additional time in case it takes a bit longer for Zapier to send the JSON version of the message.
          })
          console.log("Obtained JSON messages that match the previous criteria.");
          console.log("Starting to loop through the messages array that was returned and find the message that has the same request ID as the reacted message.");
          for (i=0; i<allMessages_JSONChannel.messages.length; i++) {
            if (JSON.parse(allMessages_JSONChannel.messages[i].text).reqID == messageRequestID) {
              console.log("Found message with reqID that matches the request ID found in the reacted message.");
              //checking if the reqID in the JSON mesage is the same as the requestID in the reacted message
              //if reqID doesn't exist in that message, it should just fail therefore this part wouldn't matter. 
              //once it's been verified to be the same message, we can POST that message to Zapier via their webhook.
              console.log("Starting to POST the message to Zapier, then breaking out of the loop to not waste time.");
              var messageText_JSONChannel = allMessages_JSONChannel.messages[i].text;
              await axios
                .post(process.env.zapierGoogleFormsWorkflowPart2WebhookURL, {
                  "text": `${messageText_JSONChannel}`,
                  "additionalInfoForm_Data": `${additionalInfoText}`,
                  "requestUserID": `${requesterUserID}`,
                  "appTokenHeader": process.env.zapierWebhookRequestAppToken,
                  "requestReactionName": reactionName
                });
                console.log("Message posted to Zapier.");
                break;
            }; //end of if statement
          }; //end of for loop
        } else {//end of if(reactionName == "white_check_mark"), handle else statement here too
          //this handles what happens if the reaction is a negative_squared_cross_mark
          console.log("Request was denied.");
          console.log("Making POST request to Zapier to let the requester know that their request was denied.");
          axios
            .post(process.env.zapierGoogleFormsWorkflowPart2WebhookURL, {
              "requestUserID": `${requesterUserID}`,
              "requestReactionName": reactionName,
              "reqID": `${messageRequestID}`,
              "appTokenHeader": process.env.zapierWebhookRequestAppToken
            });
        };
      } else {
        client.chat.postMessage({
          channel: reactorUserID,
          text: `Please make sure that the message you're reacting to is a request message from Zapier. Do not react to any other message.`,
        });
      };
    } ;
} catch (error) { //have no clue if this is necessary, but it's here just in case an error does occur, and it's easily accessible.
  console.log(error);
  app.client.chat.postMessage({
    channel: process.env.errorLogChannel,
    text: `${error}`,
  })
}});



//handles /userid command
app.command("/userid", async ({ command, ack, say }) => {
  try {
    await ack();
    var userID = command.user_id;
    app.client.chat.postMessage({
      channel: userID,
      text: `Your user ID is ${userID}`,
    });
  } catch (error) {
    console.log(error);
  };
});

//handles /clearchannel command
app.command("/clearchannel", async ({ command, ack, say }) => {
  try {
    await ack();
    var commandText = command.text; //text content of the command
    var channelInCommandPOST = command.channel_id; //post req that slack sends
    var commandTextAsArray = commandText.split(" "); //splits the command text into an array
    var channelInCommand = commandTextAsArray[1]; //channel that is specified inside the command
    var commandPhraseENV = process.env.command_phrase;
    var commandPhraseInCommand = commandTextAsArray[0];
    if (commandPhraseENV == commandPhraseInCommand && channelInCommand == channelInCommandPOST) {
      console.log("Command phrase matches. Channel IDs match. Clearing channel.");
      var channelToClear = channelInCommand;
      var allMessages = await app.client.conversations.history({
        channel: channelToClear,
        token: process.env.SLACK_USER_TOKEN,
      });
      for (i=0; i<allMessages.messages.length; i++) {
        var messageID = allMessages.messages[i].ts;
        await app.client.chat.delete({
          channel: channelToClear,
          token: process.env.SLACK_USER_TOKEN,
          ts: messageID,
        });
      }
      console.log("Channel cleared.");
    }
  } catch (error) {
    console.log(error);
  }
})

app.command("/request", async ({ command, ack, say }) => {
  try {
    await ack();
    await app.client.chat.postMessage({
      channel: command.user_id,
      text: `This is the form to make a request. Fill out this form, and once done, wait for a message from Slackbot to confirm. You will receive a message when your request is approved or denied. Link: ${process.env.googleFormsRequestURL}`,
      unfurl_links: false,
    })
  } catch (error) {
    console.log(error);
  }
})

// Other web requests are methods on receiver.router
receiver.router.post('/slack_message/zapier/process', (req, res) => {
  // You're working with an express req and res now.
  res.send('yay!');
});

receiver.router.get('/slack/help/getUserID', (req, res) => {
  res.sendFile(path.join(__dirname, "html/userID2.html"));
});

receiver.router.get('/slack/help/GoogleDriveImagePerms', (req, res) => {
  res.sendFile(path.join(__dirname, "html/GoogleDriveImgPerms.html"));
});

receiver.router.get('/zapier/test/webhook/receiver', (req, res) => {
  res.send('Hello from the receiver!');
});

receiver.router.get('/nodecron-ping', (req, res) => {
  res.send('{"status": "ok"}');
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app started');
})();