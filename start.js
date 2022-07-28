const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const path = require('path');
const nodecron = require('node-cron');

// set up nodecron to ping the heroku server every 20 minutes to avoid sleeping
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


//This is for the Google Forms version of the app.
app.event("reaction_added", async ({ event, client }) => {
  try {
    //Returns the following important info
      //user ID of user who reacted
      //reaction name without the two : marks on either side
      //item that the reaction was on.
        //we want item.channel and item.ts to get the contents of that message only if there's a specific reaction by a specific user. 
    var allowedApproversIDsENV = process.env.allowedApproverIDs; //array found on heroku as env var.
    var allowedApproversIDsArray = allowedApproversIDsENV.split(",");//splits on commas to get individual IDs.
    var reactorUserID = event.user; //user ID of user who reacted
    var reactionName = event.reaction; //reaction name without colons on either side
    var reactionTS = event.event_ts; //this is when the reaction happened


    //just initial check to make sure reaction is in channel we want, and that the user is in the list of allowed approvers, and that the reaction is one of the ones we want.
    if (allowedApproversIDsArray.includes(reactorUserID) == true && (reactionName == "white_check_mark" || reactionName == "negative_squared_cross_mark") && event.item.channel == process.env.requests_googleforms) {
      console.log("User reacted with a valid reaction in the allowed channel using an allowed user ID.");
      console.log("Starting to get content of message that the user reacted to.");
      var channelReactedMessageIsIn = event.item.channel; //gets channel of reacted message
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

      //Put a check on whether or not the "RequestID" is in the message, 
      //otherwise message reactor that the message they reacted to was invalid to prevent errors. 
      //This basically ensures that the message they reacted to was a request message, even though nobody should be messaging inside the channel.
      if (messageText.includes("RequestID:") == true) {

        //returns string with Request ID from the reacted message
        var messageRequestID = messageText.match(/```RequestID:.*```/)[0].split("```")[1].split(":")[1]; 
        console.log("Request ID obtained from message.");
        console.log("Starting to get JSON version of the request with the oldest message being as old as the original message that was reacted to, and the newest message being sent 5 seconds after the message that was reacted to.");

        //get the requester's userID from "messageText"
        var requesterUserID = messageText.match(/<@.*>/)[0].split("@")[1].split(">")[0];

        //this handles the case where the request has been approved.
        //else, shown below, there will be a POST req sent to Zapier where it'll DM the requester that their request was denied. 
        if (reactionName == "white_check_mark") {
          //This tries the grab the message containing the requestID inside the additional info channel. 
          //if the message cannot be found, it will ask the reactor to fill it out and react within 30 minutes (time limit set)
          var additionalInfoText = "";
          var ReactionTimestampMinus30Minutes = reactionTS - 1800; //timestamp of reaction minus 30 minutes (basically scope of messages inside array that's returned)
          var AdditionalInfo_messagesArray = await client.conversations.history({
            channel: process.env.additionalInfoChannel,
            inclusive: true,
            latest: reactionTS,
            oldest: ReactionTimestampMinus30Minutes.toString(),
          });
          //this is basically if there's a message that matches the previous parameters.
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
          } else { //otherwise, if there's no messages found, it'll ask the reactor to fill out the additional info form again.
            console.log("No additional info messages found for this requestID. DM'ing reactor to fill out the form.");
            await client.chat.postMessage({
              channel: reactorUserID,
              text: `Please fill out the additional details form for this requestID \`${messageRequestID}\` before approving it. Please react to the request message again once you have filled it out.`,
            });
            return;
          };

          //use the request ID to get the JSON version of the request by looking for a message
          //sent between the time the original, reacted message was sent and 5 seconds after it.
          //this 5 second window is arbitrary, but generally Zapier seems to send the message within 5 seconds of sending the JSOn version of the request.
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
          axios //this posts the requester's userID, the reaction name, the requestID that is being handled, 
                //and a randomly generated appTokenHeader that's sent along so that Zapier will reject all
                //requests that are made without this appTokenHeader.
                //This is not an issue because as long as the token is stored in Heroku with the right env var name,
                //it'll be accepted by Zapier. 
                //token can be updated later is necessary.
                //also to prevent unncessary triggers.
            .post(process.env.zapierGoogleFormsWorkflowPart2WebhookURL, {
              "requestUserID": `${requesterUserID}`,
              "requestReactionName": reactionName,
              "reqID": `${messageRequestID}`,
              "appTokenHeader": process.env.zapierWebhookRequestAppToken
            });
        };
      } else { //this is what happens when the messages that's reacted to isn't a request message or doesn't contain a RequestID.
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
    text: `Error when message was reacted to. \n\`\`\`${error}\`\`\``,// \n break line and \`\`\` is for code formatting.
  })
}});

//handles "/userid" command
//will basically DM the user with their user ID
//if user mentions another user, it will DM the slash command user with the user ID of the mentioned user.
app.command("/userid", async ({ command, ack, say }) => {
  try {
    await ack();
    if (command.text.includes("@") == false) { // this handles the event where the user doesn't specify a user account
      //gets userID of user who sent the slash command
      //then DM's the user with their userID
      var userID = command.user_id;
      app.client.chat.postMessage({
        channel: userID,
        text: `Your user ID is ${userID}`,
      });
    } else { //this handles the event where the user wants the UserID of another user.
      //gets userID of user who sent the slash command
      //then splits the text of the slash command into arrays to just get the UserID portion. 
      //then DM's the slash command user with the userID of the mentioned user, without mentioning the mentioned user. 
      var commandExecuter = command.user_id;
      var userID = command.text.match(/<@.*>/)[0].split("@")[1].split(">")[0];
      if (userID.includes("|")) {
        userID = userID.split("|")[0];
      }
      app.client.chat.postMessage({
        channel: commandExecuter,
        text: `The user ID for <@${userID}> is ${userID}`,
      });
    }
  } catch (error) {
    console.log(error);
  };
});

// //handles /clearchannel command
// //requires additional params only on heroku to activate.
//   //this is to avoid people getting curious and causing chaos.
// //This is rate limited, so might not be so helpful.
// //command has been disabled via Slack's Bot Dashboard. 
// app.command("/clearchannel", async ({ command, ack, say }) => {
//   try {
//     await ack();
//     var commandText = command.text; //text content of the command
//     var channelInCommandPOST = command.channel_id; //post req that slack sends
//     var commandTextAsArray = commandText.split(" "); //splits the command text into an array
//     var channelInCommand = commandTextAsArray[1]; //channel that is specified inside the command
//     var commandPhraseENV = process.env.command_phrase;
//     var commandPhraseInCommand = commandTextAsArray[0];
//     if (commandPhraseENV == commandPhraseInCommand && channelInCommand == channelInCommandPOST) {
//       console.log("Command phrase matches. Channel IDs match. Clearing channel.");
//       var channelToClear = channelInCommand;
//       var allMessages = await app.client.conversations.history({
//         channel: channelToClear,
//         token: process.env.SLACK_USER_TOKEN,
//       });
//       for (i=0; i<allMessages.messages.length; i++) {
//         var messageID = allMessages.messages[i].ts;
//         await app.client.chat.delete({
//           channel: channelToClear,
//           token: process.env.SLACK_USER_TOKEN,
//           ts: messageID,
//         });
//       }
//       console.log("Channel cleared.");
//     }
//   } catch (error) {
//     console.log(error);
//   }
// })

//handles /request command. This just sends the link to the user that typed the command.
//alternative to starting the request using Slack workflows. 
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
});

//sends the help page to user when they go to URL specified. 
receiver.router.get('/slack/help/getUserID', (req, res) => {
  res.sendFile(path.join(__dirname, "html/userID2.html"));
});

//sends the help page to user when they go to URL specified.
receiver.router.get('/slack/help/GoogleDriveImagePerms', (req, res) => {
  res.sendFile(path.join(__dirname, "html/GoogleDriveImgPerms.html"));
});

//this is to receive the get request that the bot sends to itself every 20 minutes to avoid sleeping.
//otherwise there would be a 404 not found error in the logs. 
receiver.router.get('/nodecron-ping', (req, res) => {
  res.send('{"status": "ok"}');
});


//this section should be used to handle the slack to google calendar integration.
//this should handle the command "/taskfinish", which has to be registered with the app via Slack. 
app.command("/taskfinish", async ({ command, ack, say }) => {
  try {
    await ack();
    var taskJSONChannelID = process.env.taskJSONChannelID;
    var commandMessage = command.text;
    var commandReqID = commandMessage.split(",")[0];
    var commandJSONTimestamp = commandMessage.split(",")[1];
    var commandExecuter = command.user_id;
    var messageArray = await app.client.conversations.history({
      channel: taskJSONChannelID,
      token: process.env.SLACK_USER_TOKEN,
      latest: commandJSONTimestamp,
      inclusive: true,
    });
    //this will always match the JSON message that correlates with the request. The timestamp is inclusive
    //and it's getting all messages up to the timestamp, including the message sent with that timestamp, so 
    //it will always be the first message in the array, unless somehow there's two messages with the same timestamp 
    //in the same channel.
    if (messageArray.messages.length > 0) {
      //this basically checks if the array is empty. If it is, then it just stops so that it doesn't hog time.
      var message = messageArray.messages[0];
      //this returns the first object because the timestamp is inclusive, and the first message is the latest one.
      var messageText_JSON = JSON.parse(message.text);//parses JSON to use it later.
      if (messageText_JSON.reqID == commandReqID) {
        //checks that the two reqIDs match. Otherwise we know that the message isn't the one, and there's likely
        //not another one as two messages with the same timestamp is very unlikely.
        var messageText_JSON_reqID = messageText_JSON.reqID;
        var messageText_JSON_requesterUserID = messageText_JSON.requesterUserID;
        var messageText_JSON_requesteeUserID = messageText_JSON.requesteeUserID;
        var messageText_JSON_calendarID = messageText_JSON.calendarID;
        var messageText_JSON_calendarEventID = messageText_JSON.calendarEventID;
        await app.client.chat.postMessage({
          channel: messageText_JSON_requesterUserID,
          text: `The task you assigned to \`<@${messageText_JSON_requesteeUserID}>\` has been completed. The request ID of the task is \`${messageText_JSON_reqID}\`. You can search for the task and its details using Slack's search inside of Slackbot's DM.`,
        });
        //updates requester that their task has been completed.

        //returns a string like this:
        //<mailto:something@group.calendar.google.com|something@group.calendar.google.com>
        //the section below should return something@group.calendar.google.com
        messageText_JSON_calendarID = messageText_JSON_calendarID.match(/mailto:.*\|/)[0].split(":")[1].split("|")[0];

        //this should then follow up and send a webhook to Zapier to delete the event from Google calendar.
        await axios
          .post(process.env.zapierWebhookGoogleCalDeleteEvent, {
            "calendarID": `${messageText_JSON_calendarID}`,
            "calendarEventID": `${messageText_JSON_calendarEventID}`
          });
          //this POSTs to Zapier which triggers a Zap to delete the event from Google calendar.
      } else {
        //this handles when the two reqIDs don't match.
        app.client.chat.postMessage({
          channel: commandExecuter,
          text: `The request ID you entered does not match any of the tasks that were logged. Please check the requestID, or contact the person who assigned you the task and update them.`,
        });
      };
    } else {
      //this handles when the array is empty meaning the timestamp is wrong as the timestamp is obtained from Slack's API.
      app.client.chat.postMessage({
        channel: commandExecuter,
        text: `The timestamp you entered (the number after the comma) does not match any of the tasks that were logged. Please check the requestID, or contact the person who assigned you the task and update them.`,
      });
    };
  } catch (error) {
    console.log(error);
    app.client.chat.postMessage({
      channel: process.env.slackToGoogleCalendarErrorLogChannelID,
      text: `Error in /taskfinish command. Error: \`\`\`${error}\`\`\``, 
      //the escaped  backticks should make the error message show up as a code block.
      //this also avoids crashing the app.
    });
  };
});

//this should handle the command "/tasknotfinish", which has to be registered with the app via Slack.
app.command("/tasknotfinish", async ({ command, ack, say }) => {
  try {
    await ack();
    var taskJSONChannelID = process.env.taskJSONChannelID;
    var commandMessage = command.text;
    var commandReqID = commandMessage.split(",")[0];
    var commandJSONTimestamp = commandMessage.split(",")[1];
    var commandExecuter = command.user_id;
    var messageArray = await app.client.conversations.history({
      channel: taskJSONChannelID,
      token: process.env.SLACK_USER_TOKEN,
      latest: commandJSONTimestamp,
      inclusive: true,
    });
    //this will always match the JSON message that correlates with the request. The timestamp is inclusive
    //and it's getting all messages up to the timestamp, including the message sent with that timestamp, so 
    //it will always be the first message in the array, unless somehow there's two messages with the same timestamp 
    //in the same channel.
    if (messageArray.messages.length > 0) {
      var message = messageArray.messages[0];
      var messageText_JSON = JSON.parse(message.text);
      if (messageText_JSON.reqID == commandReqID) {
        var messageText_JSON_reqID = messageText_JSON.reqID;
        var messageText_JSON_requesterUserID = messageText_JSON.requesterUserID;
        var messageText_JSON_requesteeUserID = messageText_JSON.requesteeUserID;
        var messageText_JSON_calendarID = messageText_JSON.calendarID;
        var messageText_JSON_calendarEventID = messageText_JSON.calendarEventID;
        await app.client.chat.postMessage({
          channel: messageText_JSON_requesterUserID,
          text: `The task you assigned to \`<@${messageText_JSON_requesteeUserID}>\` has not been completed. The request ID of the task is \`${messageText_JSON_reqID}\`. You can search for the task and its details using Slack's search inside of Slackbot's DM.`,
        });
        //this should then follow up and send a webhook to Zapier to delete the event from Google calendar.
        axios
          .post(process.env.zapierWebhookGoogleCalDeleteEvent, {
            "calendarID": `${messageText_JSON_calendarID}`,
            "calendarEventID": `${messageText_JSON_calendarEventID}`
          });
      } else {
        app.client.chat.postMessage({
          channel: commandExecuter,
          text: `The request ID you entered does not match any of the tasks that were logged. Please check the requestID, or contact the person who assigned you the task and update them.`,
        });
      };
    } else {
      app.client.chat.postMessage({
        channel: commandExecuter,
        text: `The timestamp you entered (the number after the comma) does not match any of the tasks that were logged. Please check the requestID, or contact the person who assigned you the task and update them.`,
      });
    };
  } catch (error) {
    console.log(error);
    app.client.chat.postMessage({
      channel: process.env.slackToGoogleCalendarErrorLogChannelID,
      text: `Error in /tasknotfinish command. Error: \`\`\`${error}\`\`\``, 
      //the escaped  backticks should make the error message show up as a code block.
      //this also avoids crashing the app.
    });
  };
});

//handle /createtask command
app.command("/createtask", async ({ command, ack, say }) => {
  try {
    await ack();
    var commandExecuter = command.user_id;
    app.client.chat.postMessage({
      channel: commandExecuter,
      text: `Fill out this form, and the requestee will receive the request as an event in their Google Calendar. Form link: <${process.env.slackToGoogleCalendarFormLink}>`,
      unfurl_links: false
    });
  } catch (error) {
    console.log(error);
    app.client.chat.postMessage({
      channel: process.env.slackToGoogleCalendarErrorLogChannelID,
      text: `Error in /createtask command. Error: \`\`\`${error}\`\`\``,
    });
  };
});

//this will hopefully handle the Create Google Cal event shortcut from Slack
//this handles the pop up modal, but not submission of the form.
//the next step should hopefully handle that second part.
app.shortcut("create-google-cal-task", async ({ shortcut, ack, client }) => {
  try {
    await ack();
  
    var results = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: { //view created using Slack's interactive Block Kit Builder
        "type": "modal",
        "callback_id": "create-google-cal-task",
        "title": {
          "type": "plain_text",
          "text": "Slack-RequestApp",
          "emoji": true
        },
        "submit": {
          "type": "plain_text",
          "text": "Submit",
          "emoji": true
        },
        "close": {
          "type": "plain_text",
          "text": "Cancel",
          "emoji": true
        },
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Select the user that the task will be assigned to. Only select ONE user."
            }
          },
          {
            "type": "input",
            "element": {
              "type": "multi_users_select",
              "placeholder": {
                "type": "plain_text",
                "text": "Select One User",
                "emoji": true
              },
              "action_id": "requesteeSelectBlock_ActionID",
              "block_id": "requesteeSelectBlock_BlockID",
            },
            "label": {
              "type": "plain_text",
              "text": "Select One User",
              "emoji": true
            }
          }
        ]
      }
    });
    console.log("Results:")
    console.log(results);
  } catch (error) {
    console.log(error);
  }
});

app.view("create-google-cal-task", async ({ ack, body, view, client }) => {
  await ack();

  console.log(body.view.state.values);
})

//this handles when the page the user is requesting doesn't exist. 
//it may be better to use an HTML file later, but for now,
//it sends plain text to the user.
receiver.router.use((req, res) => {
  res.status(404).send('404 Page Not Found');
});

//this starts the bot
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app started');
})();