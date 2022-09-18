const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const path = require('path');
const nodecron = require('node-cron');
//this references the testStatus.js file 
const testStatusFile = require('./testStatus.js');
//this require statement contains the modal view.
const modalViews = require("./modalViews.js");
//this require statement contains the messages with blocks.
const messageViews = require("./messageViews.js");
//import uuidv4
const { v4: uuidv4 } = require('uuid');

//importing express just to use express.json() for parsing POST data
const express = require('express');
const { updateMessage } = require('./messageViews.js');

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

// set up a static server for serving images.
receiver.router.use("/static", express.static(path.join(__dirname, '/docs/images')));

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
    if (allowedApproversIDsArray.includes(reactorUserID) == true && (reactionName == "white_check_mark" || reactionName == "negative_squared_cross_mark") && event.item.channel == process.env.requests_googleforms_approvers) {
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
      console.log(messageText)
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
            console.log(AdditionalInfo_messagesArray.messages.length)
            for (i=0; i<AdditionalInfo_messagesArray.messages.length; i++) {
              console.log("AdditionalInfo_messagesArray.messages[i].text:");
              var JSONMsgArray_parsed = JSON.parse(AdditionalInfo_messagesArray.messages[i].text);
              console.log("Logging: JSONMsgArray_parsed->");
              console.log(JSONMsgArray_parsed);
              console.log(JSONMsgArray_parsed.AdditionalInfoForReqID);
              console.log(messageRequestID)
              if (JSONMsgArray_parsed.AdditionalInfoForReqID == messageRequestID) {
                additionalInfoText = AdditionalInfo_messagesArray.messages[i].text;
                console.log("additionalInfoText");
                console.log(additionalInfoText);
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
            latest: (parseInt(timestampOfMessage)+10).toString(), 
            //the most recent message is the message that is sent, at most, 10 seconds after the message that was reacted to.
            //oldest combined with latest ensures that the messages that are returned are the messages that were sent after the original reacted message
            //which happens before the JSON version of the message is sent. 
            //Adding 5 seconds is to just allow for additional time in case it takes a bit longer for Zapier to send the JSON version of the message.
          })
          console.log("Obtained JSON messages that match the previous criteria.");
          console.log("Starting to loop through the messages array that was returned and find the message that has the same request ID as the reacted message.");
          console.log(allMessages_JSONChannel)
          for (i=0; i<allMessages_JSONChannel.messages.length; i++) {
            console.log(allMessages_JSONChannel.messages[i])
            var JSONMsgParsedToJSON = JSON.parse(allMessages_JSONChannel.messages[i].text);
            // console.log("JSONMsgParsedToJSON");
            // console.log(JSONMsgParsedToJSON);
            if (JSONMsgParsedToJSON.reqID == messageRequestID) {
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

// //listen for when user opens the home tab
// //show test status of application
// app.event('app_home_opened', async ({ event, client }) => {
//   try {
//     console.log("app_home_opened event triggered.");
//     var ApplicationStatus = "";
//     if (testStatusFile.test == "true") {
//       ApplicationStatus = "Test Mode";
//     } else {
//       ApplicationStatus = "Production Mode";
//     }
//     // Call views.publish with the built-in client
//     const result = await client.views.publish({
//       // Use the user ID associated with the event
//       user_id: event.user,
//       view: {
//         "type": "home",
//         "blocks": [
//           {
//             "type": "section",
//             "text": {
//               "type": "mrkdwn",
//               "text": "Hello there! :wave: Application Status: " + ApplicationStatus
//             }
//           }
//         ]
//       }
//     });
//   }
//   catch (error) {
//     console.error(error);
//   }
// });

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

//handles webhook from Zapier.
receiver.router.post('/slack/updateTaskeeOnTask', express.json(), async (req, res) => {
  if (req.body.checksum == process.env.updateTaskeeOnTask_checksum) {
    res.status(200).send("Successfully POSTed");
    var POST_requestBody = req.body;
    var task_id = POST_requestBody.task_id;
    var task_title = POST_requestBody.task_title;
    var task_description = POST_requestBody.task_description;
    var task_due_date = POST_requestBody.task_due_date;
    var task_assigner = POST_requestBody.task_assigner;
    var task_assignee = POST_requestBody.task_assignee;
    var JSON_channel_ts = POST_requestBody.JSON_channel_ts;
    var message = await messageViews.updateMessageContent(task_id, task_title, task_description, task_due_date, JSON_channel_ts);
    var messageAsString = JSON.stringify(JSON.parse(message).blocks);
    await app.client.chat.postMessage({
      channel: task_assignee,
      text: "This message contains Blocks from Slack Block Kit which is used to send a message to the assignee about the task they have, and two buttons to either say the task is finished, or it won't be finished by the deadline.",
      blocks: messageAsString
    })
  } else {
    res.status(403).sent("Not Allowed to access.")
  }
});

//creating shared function to send message
async function TaskDone_NotDoneFunc(status, requesterUserID, requesteeUserID, dueDate, reqID) {
  if (status == "done") {
    await app.client.chat.postMessage({
      channel: requesterUserID,
      text: `The task you assigned to \`<@${requesteeUserID}>\` has been completed. The due date of the task is \`${dueDate}\`. The request ID of the task is \`${reqID}\`. You can search for the task and its details using Slack's search inside of Slackbot's DM.`,
    });
  } else if (status == "notDone") {
    await app.client.chat.postMessage({
      channel: requesterUserID,
      text: `The task you assigned to \`<@${requesteeUserID}>\` has not been completed, and will not be completed by the deadline assigned \`(${dueDate})\`. The request ID of the task is \`${reqID}\`. You can search for the task and its details using Slack's search inside of Slackbot's DM.`,
    });
  };
  return;
};

//delete Google Calendar Event
async function deleteGoogleCalendarEvent(calendarID, eventID) {
  await axios
    .post(process.env.zapierWebhookGoogleCalDeleteEvent, {
      "calendarID": `${calendarID}`,
      "calendarEventID": `${eventID}`
    });
};

//error handling for taskDone and taskNotDone app.actions
async function taskDone_NotDoneErrorFunc(error, status) {
  await app.client.chat.postMessage({
    channel: process.env.slackToGoogleCalendarErrorLogChannelID,
    text: `Error when marking Google Calendar Task as: \`${status}\`. \nError: \`\`\`${error}\`\`\``, 
    //the escaped  backticks should make the error message show up as a code block.
    //this also avoids crashing the app.
  });
};

//helper function for editing message to remove buttons afterwards
async function newBlocksArrayForTaskDone_NotDone(blocksArray, userTz, done_notDone) {
  var array = JSON.parse(blocksArray);
  var newArray = [];
  for (i=0; i<array.length; i++) {
    var block = array[i];
    if (block.block_id == "TaskDone_TaskNotDone_BlockID") {
      //might potentially add another block to update the msg with the option that was chosen.
      // getting time when function was run/when button was pressed
      var time = new Date().toLocaleString("en-US", {timeZone: userTz});

      var userSelectionBlock = "";
      if (done_notDone == "done") {
        userSelectionBlock = {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `You have marked this task as *Done* at ${time}.`
            }
          ]
        };
      } else if (done_notDone == "notDone") {
        userSelectionBlock = {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `You have marked this task as *Not Done* at ${time}.`
            }
          ]
        };
      } else {
        //basically just error handling, kind of
        //it's so that the issue can be caught and so that the reason for not updating with the user's selection can be fixed.
        //this will very likely not be used unless the function parameters are modified backend
        //or if somehow, something breaks, or does something unintentional.
        userSelectionBlock = {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": `For some reason, there was no status update for this. I don't know whether you pressed done or not done. You might want to contact the person maintaining the bot to figure out what's going on. They may ask you to provide additional information (such as what you did) to help with fixing this. Time: ${time}`
            }
          ]
        };
      };
      newArray.push(userSelectionBlock)
      continue;
    } else {
      newArray.push(block);
    };
  };
  return await JSON.stringify(newArray);
};

//handles the button presses from the message that is sent when a POST req goes to "/slack/updateTaskeeOnTask"
app.action("TaskDone_ActionID", async ({ ack, client, body }) => {
  try {
    await ack();
    //get user id, then make API call to users.info to get user timezone, then pass that into function newBlocksArrayForTaskDone_NotDone
    var userID = body.user.id;
    var userInfoResult = await app.client.users.info({
      user: userID
    });
    var userTz = userInfoResult.user.tz;

  //this section handles updating messages to remove the button blocks.
    var messageWithBlocksTS = body.message.ts;
    var channelWithMessageWithBlocks = body.channel.id;
    var blocksArray = body.message.blocks;
    //iterate over blocks array and return new set of blocks by removing the block containing the buttons
    var newMsgWithoutButtonsBlock = await newBlocksArrayForTaskDone_NotDone(JSON.stringify(blocksArray), userTz, "done");
    //then call chat.update API method to update the message using the info above.
    var msgUpdateResult = await app.client.chat.update({
      channel: channelWithMessageWithBlocks,
      ts: messageWithBlocksTS,
      text: "This message has been updated to remove the button blocks.",
      blocks: newMsgWithoutButtonsBlock
    });

    var JSONChannelTS_BlockID = "JSON_channel_ts_BlockID";
    var TaskID_BlockID = "task_id_BlockID";
    var timestamp = "";
    var reqID = "";
  //going through blocks to gather info like timestamp and taskID
    for (i=0; i<body.message.blocks.length; i++) {
      //the if statement below finds the timestamp.
      if (JSONChannelTS_BlockID == body.message.blocks[i].block_id) {
        var text = body.message.blocks[i].elements[0].text;
        timestamp = text.match(/`[0-9].*\.[0-9].*`/)[0].split("`")[1];
      } else if (TaskID_BlockID == body.message.blocks[i].block_id) {
        var text = body.message.blocks[i].elements[0].text;
        reqID = text.match(/`[0-9a-z\-].*`/)[0].split("`")[1];
      } else {
        continue;
      };
    }
  //now use timestamp and the JSON channel ID to look up the message contents which is stored in JSON form
    var messageArray = await app.client.conversations.history({
      channel: process.env.taskJSONChannelID,
      latest: timestamp,
      inclusive: true
    });
    var message = messageArray.messages[0];
    var messageTextAsJSON = JSON.parse(message.text);
    //list of variables to be used later if needed
    var messageTextAsJSON_reqID = messageTextAsJSON.reqID;
    var messageTextAsJSON_requesterUserID = messageTextAsJSON.requesterUserID;
    var messageTextAsJSON_requesteeUserID = messageTextAsJSON.requesteeUserID;
    var messageTextAsJSON_dueDate = messageTextAsJSON.dueDate;
    var messageTextAsJSON_calendarID = messageTextAsJSON.calendarID;
    var messageTextAsJSON_calendarEventID = messageTextAsJSON.calendarEventID;
    //then check task IDs to ensure it's the same one (should be generally the first one, which is what the var message is set to as it's VERY difficult to get two messages with the same TS.)
    if (reqID == messageTextAsJSON_reqID) {
      //then make API call to Slack to send message to assigner about status update
      await TaskDone_NotDoneFunc("done", messageTextAsJSON_requesterUserID, messageTextAsJSON_requesteeUserID, messageTextAsJSON_dueDate, messageTextAsJSON_reqID);
  
      //fixing variable
      //returns a string like this:
      //<mailto:something@group.calendar.google.com|something@group.calendar.google.com>
      //the section below should return something@group.calendar.google.com
      messageTextAsJSON_calendarID = messageTextAsJSON_calendarID.match(/mailto:.*\|/)[0].split(":")[1].split("|")[0];
  
      //then trigger webhook on Zapier to delete calendar event
      await deleteGoogleCalendarEvent(messageTextAsJSON_calendarID, messageTextAsJSON_calendarEventID);
    }
  } catch (error) {
    console.log(error);
    await taskDone_NotDoneErrorFunc(error, "Done");
  }
});
//basically the same thing as above, but instead of taskDone, it's notDone. 
app.action("TaskNotDone_ActionID", async ({ ack, client, body }) => {
  try {
    await ack();
    //get user id, then make API call to users.info to get user timezone, then pass that into function newBlocksArrayForTaskDone_NotDone
    var userID = body.user.id;
    var userInfoResult = await app.client.users.info({
      user: userID
    });
    var userTz = userInfoResult.user.tz;

  //this section handles updating messages to remove the button blocks.
    var messageWithBlocksTS = body.message.ts;
    var channelWithMessageWithBlocks = body.channel.id;
    var blocksArray = body.message.blocks;
    //iterate over blocks array and return new set of blocks by removing the block containing the buttons
    var newMsgWithoutButtonsBlock = await newBlocksArrayForTaskDone_NotDone(JSON.stringify(blocksArray), userTz, "notDone");
    //then call chat.update API method to update the message using the info above.
    var msgUpdateResult = await app.client.chat.update({
      channel: channelWithMessageWithBlocks,
      ts: messageWithBlocksTS,
      text: "This message has been updated to remove the button blocks.",
      blocks: newMsgWithoutButtonsBlock
    });

    var JSONChannelTS_BlockID = "JSON_channel_ts_BlockID";
    var TaskID_BlockID = "task_id_BlockID";
    var timestamp = "";
    var reqID = "";
    //show another modal view here.
    for (i=0; i<body.message.blocks.length; i++) {
      //the if statement below finds the timestamp.
      if (JSONChannelTS_BlockID == body.message.blocks[i].block_id) {
        var text = body.message.blocks[i].elements[0].text;
        timestamp = text.match(/`[0-9].*\.[0-9].*`/)[0].split("`")[1];
      } else if (TaskID_BlockID == body.message.blocks[i].block_id) {
        var text = body.message.blocks[i].elements[0].text;
        reqID = text.match(/`[0-9a-z\-].*`/)[0].split("`")[1];
      } else {
        continue;
      };
    };
    //now use timestamp and the JSON channel to look up the message contents
    var messageArray = await app.client.conversations.history({
      channel: process.env.taskJSONChannelID,
      latest: timestamp,
      inclusive: true
    });
    var message = messageArray.messages[0];
    var messageTextAsJSON = JSON.parse(message.text);
    //list of variables to be used later if needed
    var messageTextAsJSON_reqID = messageTextAsJSON.reqID;
    var messageTextAsJSON_requesterUserID = messageTextAsJSON.requesterUserID;
    var messageTextAsJSON_requesteeUserID = messageTextAsJSON.requesteeUserID;
    var messageTextAsJSON_dueDate = messageTextAsJSON.dueDate;
    var messageTextAsJSON_calendarID = messageTextAsJSON.calendarID;
    var messageTextAsJSON_calendarEventID = messageTextAsJSON.calendarEventID;
    //then check task IDs to ensure it's the same one (should be generally the first one, which is what the var message is set to as it's VERY difficult to get two messages with the same TS.)
    if (reqID == messageTextAsJSON_reqID) {
      //then make API call to Slack to send message to assigner about status update
      await TaskDone_NotDoneFunc("notDone", messageTextAsJSON_requesterUserID, messageTextAsJSON_requesteeUserID, messageTextAsJSON_dueDate, messageTextAsJSON_reqID);
  
      //fixing variable
      //returns a string like this:
      //<mailto:something@group.calendar.google.com|something@group.calendar.google.com>
      //the section below should return something@group.calendar.google.com
      messageTextAsJSON_calendarID = messageTextAsJSON_calendarID.match(/mailto:.*\|/)[0].split(":")[1].split("|")[0];
  
      //then trigger webhook on Zapier to delete calendar event
      await deleteGoogleCalendarEvent(messageTextAsJSON_calendarID, messageTextAsJSON_calendarEventID);
    }
  } catch (error) {
    console.log(error);
    await taskDone_NotDoneErrorFunc(error, "Not Done");
  }
});

//handle /createtask command (Slack => Google Calendar Task)
app.command("/createtask", async ({ command, ack, say, client}) => {
  try {
    await ack();
  
    await client.views.open({
      trigger_id: command.trigger_id,
      view: modalViews.modalForm
    });
  } catch (error) {
    console.log(error);
  };
});

//this will hopefully handle the Create Google Cal event shortcut from Slack
//this handles the pop up modal, but not submission of the form.
//the next step should hopefully handle that second part.
//this callbackID is specified inside of Slack's App Configuration page.
app.shortcut("create-google-cal-task", async ({ shortcut, ack, client }) => {
  try {
    await ack();
  
    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: modalViews.modalForm
    });
  } catch (error) {
    console.log(error);
  }
});

//handles form submission (callback id)
app.view("create-google-cal-task-callback", async ({ ack, body, view, client }) => {
  await ack();
  var formSubmittionValues = body.view.state.values;
  var assignerUserID = body.user.id;
  var assigneeUserID = formSubmittionValues.requesteeSelectBlock_BlockID.requesteeSelectBlock_ActionID.selected_user;
  var assigneeEmailAddress = formSubmittionValues.requesteeEmailAddress_BlockID.requesteeEmailAddress_ActionID.value;
  var taskTitle = formSubmittionValues.taskTitle_BlockID.taskTitle_ActionID.value;
  var taskDescription = formSubmittionValues.taskDescription_BlockID.taskDescription_ActionID.value;
  var taskDueDate = formSubmittionValues.taskDueDate_BlockID.taskDueDate_ActionID.selected_date;
  var UUIDAndUnixTimeForTaskIDString = uuidv4(); //this is referenced as taskID
  UUIDAndUnixTimeForTaskIDString += Date.parse(new Date); //this is referenced as taskID

  await axios.post(process.env.SlackToGoogleCalendarWebhookURL, {
    "assignerUserID": `${assignerUserID}`,
    "assigneeUserID": `${assigneeUserID}`,
    "assigneeEmailAddress": `${assigneeEmailAddress}`,
    "taskTitle": `${taskTitle}`,
    "taskDescription": `${taskDescription}`,
    "taskDueDate": `${taskDueDate}`,
    "TaskID": `${UUIDAndUnixTimeForTaskIDString}`
  }).then(function (response) {
    console.log(response.status + " " + response.statusText + " " + response.data.status);
  });
});

//handles createExpenseRequest which is used to test moving the request process from Google Forms to Slack entirely (at least for part 1)
app.action("createExpenseRequest", async ({ ack, client, body }) => {
  try {
    await ack();
    //check if application is in test mode
    if (testStatusFile.test == "false") {
      //this is shown to everyone when not in test mode
      var APICallResults = await client.views.open({
        trigger_id: body.trigger_id,
        view: modalViews.createRequestView
      });
      console.log(APICallResults);
    } else {
      if (body.user.id == process.env.infoUserID) {
        //if user is info account, then show the form
        var APICallResults = await client.views.open({
          trigger_id: body.trigger_id,
          view: modalViews.createRequestView
        });
        console.log(APICallResults);
      } else {
        //if user is not info account, then show the notification message
        var APICallResults = await client.views.open({
          trigger_id: body.trigger_id,
          view: modalViews.testModeModal
        });
        console.log(APICallResults);
      }
    }
  
  } catch (error) {
    console.log(error);
  };
});
//creating action handler for when user selects cash/credit card and updating view
app.action("PaymentMethod_ActionID", async ({ ack, body, client }) => {
  try {
    ack();
    console.log(body);
  
    //getting view ID
    var viewID = body.view.id;
    //getting the radio button pressed
    var buttonPressed = body.actions[0].selected_option.value; //there's two options: Cash and CreditCard in those exact case.
    //creating new view (aka if cash, show the other fields)
    if (buttonPressed == "Cash") {
      var newView = modalViews.createRequestView_Cash; //change this variable depending on the selected option
      //call slack API to update the view
      var updateViewAPIResults = await app.client.views.update({
        view: newView,
        view_id: viewID
      });
      console.log(updateViewAPIResults);
    } else if (buttonPressed == "CreditCard") {
      var newView = modalViews.createRequestView; //change this variable depending on the selected option
      //call slack API to update the view
      var updateViewAPIResults = await app.client.views.update({
        view: newView,
        view_id: viewID
      });
      console.log(updateViewAPIResults);
    };
  } catch (error) {
    console.log(error);
  };
})

//handles submission of modal triggered by actionID of "createExpenseRequest", which is used to test moving the request process from Google Forms to Slack entirely (at least for part 1)
//createExpenseRequest-callback is the callbackID of the modal that's shown when the actionID "createExpenseRequest" is called
app.view("createExpenseRequest-callback", async ({ ack, body, view, client }) => {
  try {
    await ack();
    var customErrorMsg;
    var requesterUserID = body.user.id;
    var formSubmittionValues = body.view.state.values;

    var requestID = await generateRequestID();
    var Description = formSubmittionValues.Description_BlockID.Description_ActionID.value;
    var Cost = formSubmittionValues.Cost_BlockID.Cost_ActionID.value;
    var paymentDueByDate = formSubmittionValues.paymentDueByDate_BlockID.paymentDueByDate_ActionID.selected_date;
    var VendorOrCustomer = formSubmittionValues.VendorOrCustomer_BlockID.VendorOrCustomer_ActionID.selected_option.value;
    var VendorOrCustomerName = formSubmittionValues.VendorOrCustomerName_BlockID.VendorOrCustomerName_ActionID.value;
    var productName = formSubmittionValues.ProductName_BlockID.ProductName_ActionID.value;
    var paymentMethod = formSubmittionValues.PaymentMethod_BlockID.PaymentMethod_ActionID.selected_option.value;
      //^this is the value (aka a custom set value that's not show to the user) of the radio button that's selected
    var paymentMethod_text = formSubmittionValues.PaymentMethod_BlockID.PaymentMethod_ActionID.selected_option.text.text;
      //^this is the text (aka the text shown to the user) of the radio button that's selected
    var transactionType = formSubmittionValues.TransactionType_BlockID.TransactionType_ActionID.selected_option.value;
    var transactionType_text = formSubmittionValues.TransactionType_BlockID.TransactionType_ActionID.selected_option.text.text;
    var imageLink = formSubmittionValues.imageLink_BlockID.imageLink_ActionID.value;
    var paymentMethodIsCash = "";
    if (paymentMethod == "Cash") {
      paymentMethodIsCash = true;
    } else {
      paymentMethodIsCash = false;
    };
    var cash_accountName = null;
    var cash_bankName = null;
    var cash_AccountNumber = null;
    var cash_RoutingNumber = null;
    var cash_SWIFTCode = null;

    if (paymentMethod == "Cash") { //this checks the value of the radio button that's selected, not the text
      //these variable only apply to the "Cash" option, basically to obtain account+routing number and other details for the payment
      cash_accountName = formSubmittionValues.AccountName_Cash_BlockID.AccountName_Cash_ActionID.value;
      cash_bankName = formSubmittionValues.BankName_Cash_BlockID.BankName_Cash_ActionID.value;
      cash_AccountNumber = formSubmittionValues.AccountNumber_Cash_BlockID.AccountNumber_Cash_ActionID.value;
      cash_RoutingNumber = formSubmittionValues.RoutingNumber_Cash_BlockID.RoutingNumber_Cash_ActionID.value;
      cash_SWIFTCode = formSubmittionValues.SWIFTCode_Cash_BlockID.SWIFTCode_Cash_ActionID.value;
    };
    
    //checking input values and modifying them for usage.
    if (Description.match(/\\/)) {
      //prohibiting the use of the character "\"
      //alerting user that the "\" character is not allowed.
      customErrorMsg = "Do not use the character \"\\\" in your task description. Please resubmit your request but without that character, or else, you will get another message like this."
      await sendErrorMessageOnThrow(requesterUserID, customErrorMsg);
      throw "Error: User tried to use a character that's not allowed inside their description. (The backslash character).";
      //^ that should end the try statement by throwing an error
    };
    //escaping quotation marks inside of the description, if any. 
    var DescriptionEscaped = Description.replace(/"/g, '\\"');

    //this basically checks if the $ character is present. If so, remove it. 
    if (Cost.match(/\$/g)) {
      Cost = Cost.replace(/\$/g, "");
    };
    //this then checks if the cost provided is a valid number, if not, it throws an error and msgs the requester
    //if so, it rounds the number to the nearest hundredths
    if (isNaN(Cost) == true) {
      //run if Cost is not a number
      customErrorMsg = "Please enter a valid number when entering the cost of a request. Please re-fill out the form, making sure that you put a number (like 1, 10, 100, 100.01, 100.91275) for the cost to submit a request, otherwise, you will receive this error message again."
      await sendErrorMessageOnThrow(requesterUserID, customErrorMsg);
      throw "Error: User tried to pass a value that isn't a number into the Cost parameter.";
    } else {
      //else make the number into a money value format (like 10.00)
      Cost = parseFloat(Cost).toFixed(2);
      //changes a number like 1.195 into 1.20
    };

    //this is checking for "\" character inside of the productName provided, if it matches, it throws an error and msgs requester
    if (productName.match(/\\/)) {
      //prohibiting the use of the character "\"
      //alerting user that the character is not allowed.
      customErrorMsg = "Do not use the character \"\\\" in the product name of your request. Please resubmit your request but without that character, or else, you will get another message like this."
      await sendErrorMessageOnThrow(requesterUserID, customErrorMsg);
      throw "Error: User tried to use a character that's not allowed inside their product name. (The backslash character).";
      //^ that should end the try statement by throwing an error
    };
    //this is just removing the quotation marks present in the product name, if there's a quotation mark present.
    if (productName.match(/"/g)) {
      productName = productName.replace(/"/g, '')
    };

    //this just sets the imageLink to nothing if the user didn't provide a link.
    if (imageLink == null) {
      imageLink = "";
    };

    //this just checks if payment type is Cash and if so, create a JSON object of additional fields, no clue if I need that
    // then create a sentence using the additional information, and then add it to the description
    if (paymentMethod_text == "Cash") {
      var cashPayment_AdditionalInfo_JSON = {
        "accountName": cash_accountName,
        "bankName": cash_bankName,
        "accountNumber": cash_AccountNumber,
        "routingNumber": cash_RoutingNumber,
        "swiftCode": cash_SWIFTCode
      };
      var cashPayment_AdditionalInfo_AddToDescription = `This request is using cash for payment. The details obtained are as follows: Account Name: ${cash_accountName} | Bank Name: ${cash_bankName} | Account Number: ${cash_AccountNumber} | Routing Number: ${cash_RoutingNumber} | SWIFT Code: ${cash_SWIFTCode}.`
      Description = Description + "\\n\\n" + cashPayment_AdditionalInfo_AddToDescription;
    } else {
      var cashPayment_AdditionalInfo_AddToDescription = `This expense is not paid in cash. There are no additional details that need to be added.`;
      Description = Description + "\\n\\n" + cashPayment_AdditionalInfo_AddToDescription;
    };

    //updating DescriptionEscaped variable with the new description while escaping characters like quotation marks and newlines.
    DescriptionEscaped = Description.replace(/"/g, '\\"').replace(/\n/g, '\\n');

    // const sectionSeperatorSymbol = "§"
    //DM requester about their submission
      //this function returns the results of the API call if that is something that's needed.
    await DMRequesterAboutRequestSubmission(requesterUserID, requestID, Description, Cost, imageLink, paymentDueByDate);

    //creating JSON version of msg
      //this function returns the results of the API call if that is something that's needed.
    var JSONMSGSentResult = await sendJSONVersionOfMSG(requesterUserID, requestID, DescriptionEscaped, Cost, VendorOrCustomer, VendorOrCustomerName, productName, paymentMethod, transactionType, imageLink, paymentDueByDate);
    var JSONMSG_ts = await JSONMSGSentResult.ts;

    //Sending request to Approvers' channel
      //this function returns the results of the API call if that is something that's needed.
      //this is still set to msg requester with this info.
      // create JSON containing the variables required in the function messageViews.createRequestMessageForApprovers(): 
        var JSONWithData = JSON.stringify({
          requesterID: requesterUserID,
          requestID: requestID,
          JSON_ts: JSONMSG_ts,
          task_description: DescriptionEscaped,
          productName: productName,
          productCost: Cost,
          transactionType_asText: transactionType_text,
          paymentMethod: paymentMethod_text,
          paymentToVendorOrCustomer: VendorOrCustomer,
          paymentToVendorOrCustomer_name: VendorOrCustomerName,
          makePaymentByDate: paymentDueByDate,
          imageLinksThatWereSubmitted: imageLink,
          cashPayment_AdditionalInfo: cashPayment_AdditionalInfo_JSON,
          paymentMethodIsCash: paymentMethodIsCash,
          //the stuff below this will either be filled or empty, depending on the payment method.
          //there should be a check to see if "paymentMethodIsCash" is true, and if so, then use the stuff below this. 
          cash_accountName: cash_accountName,
          cash_bankName: cash_bankName,
          cash_AccountNumber: cash_AccountNumber,
          cash_RoutingNumber: cash_RoutingNumber,
          cash_SWIFTCode: cash_SWIFTCode
        });

    //this function call returns the results of the API call to Slack to send a message to the approvers' channel. 
    var messageViewsResult = await messageViews.createRequestMessageForApprovers(JSONWithData, app);

  } catch (error) {
    console.log(error);
  };
});

//handles when a request is approved using the approve button inside the approvers channel. 
app.action("approve_approvers_ApproveDeny_BTN_ActionID", async ({ ack, body, client }) => {
  try {
    ack();
    var approverUserID = body.user.id;
    
    var messageBlocks = JSON.stringify(body.message.blocks);
    var messageBlocksTS = body.message.ts;
    var channelWithMessageWithBlocks = body.channel.id;

    //call Slack's API to get message metadata of the message inside approvers channel.
    var messageMetadata = await client.conversations.history({
      channel: channelWithMessageWithBlocks,
      latest: messageBlocksTS,
      limit: 1,
      inclusive: true,
      include_all_metadata: true
    });
    var metadataApprovalCount = messageMetadata.messages[0].metadata.event_payload.numberOfApprovals;
    var newMetadataApprovalCount = (metadataApprovalCount + 1)%2;
    var metadataRequestCost = parseFloat(messageMetadata.messages[0].metadata.event_payload.cost).toFixed(2);//basically turn it from a string to an integer.
    var metadataPreviousApproverID = messageMetadata.messages[0].metadata.event_payload.previousApproverID.toUpperCase();
    var metadata = messageMetadata.messages[0].metadata; //this is already in JSON (aka an object)
    metadata.event_payload.numberOfApprovals = newMetadataApprovalCount;
    var listOfApprovers = messageMetadata.messages[0].metadata.event_payload.listOfApprovers;
    var listOfApproversTimestamps = messageMetadata.messages[0].metadata.event_payload.listOfApproversTimestamps;
    if (listOfApprovers.includes(approverUserID.toUpperCase()) == false) {
      listOfApprovers.push(approverUserID.toUpperCase());
      listOfApproversTimestamps.push(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''));
    };
    var originalMessageText = messageMetadata.messages[0].text;

    var userAlreadyApproved = false;
    if (metadataPreviousApproverID.includes(approverUserID.toUpperCase())) {
      userAlreadyApproved = true;
    }

    //this handles creating the updated message, and updating that message.
    //returns a stringified JSON of Slack API call results and the ts of the JSON version of the message. 
      //this is to later find the JSON version of the message to POST to Zapier. 
    var functionResponse = await expenseRequest_UpdateRequestMSG(app, messageBlocks, approverUserID, channelWithMessageWithBlocks, messageBlocksTS, userAlreadyApproved, listOfApprovers, listOfApproversTimestamps, "approved");
    
    if (metadataRequestCost >= 10000) { //this checks if the request is over or equal to $10,000 
      //this part can be fixed later to use the modulus (%) operator.
      if (userAlreadyApproved == true) {
        //if the user has already approved this request, then don't do anything, but send them a message saying that they've already approved this request, and include the requestID.
        var requestID = messageMetadata.messages[0].metadata.event_payload.requestID;
        var message = `You've already approved this request. You cannot approve the request twice. The request ID is ${requestID}.`;
        await client.chat.postMessage({
          channel: approverUserID,
          text: message
        });
        console.log(`User ${approverUserID} has already approved this request. They tried to approve it twice. The request ID is ${requestID}.`);
      } else {
        //if the user has not already approved this request, then add their ID to the metadata and increase the metadata count. 
        if (metadataApprovalCount == 0) {
          //if count==0, then update it to be 1
          //this checks the count before it adds 1 to it. 
          metadata.event_payload.previousApproverID = approverUserID.toUpperCase();
            //^if it's the first approver, then add their ID to the metadata.
          await client.chat.update({
            channel: channelWithMessageWithBlocks,
            text: originalMessageText,
            ts: messageBlocksTS,
            metadata: metadata
          });
          console.log("Request has been approved by one approver. Waiting for another approver to approve requestID: " + messageMetadata.messages[0].metadata.event_payload.requestID);
        } else if (metadataApprovalCount == 1) {
          //if count==1, then update it to be reset to 0. 
          //this checks the count before it adds 1 to it. 
          metadata.event_payload.previousApproverID = "";
            //^if it's the second approver, then reset the metadata to be empty.
          await client.chat.update({
            channel: channelWithMessageWithBlocks,
            text: originalMessageText,
            ts: messageBlocksTS,
            metadata: metadata
          });
          console.log("Request has been approved by two approvers. RequestID: " + messageMetadata.messages[0].metadata.event_payload.requestID);
    
          // //this part only runs if the request has been approved twice.
          // //if it's been approved twice, it'll be reset so that it'll be as if it was never approved
          //   //this means that the request then needs to be approved by two more individuals. 
          // var functionResponse_parsed = JSON.parse(functionResponse);
          // var JSON_Message_ts = functionResponse_parsed.JSON_Message_ts;
          // var JSON_Message_Content_APIResult = await app.client.conversations.history({
          //   channel: process.env.requests_googleforms_json,
          //   latest: JSON_Message_ts,
          //   inclusive: true
          // });
          // var JSON_Message_Content = JSON_Message_Content_APIResult.messages[0].text;
          // //change of plans, data does not need to be pushed to QBO.
          // //but this will remain here in case it's needed in the future.
          // // await axios
          // //   .post(process.env.zapierProcessExpenseRequestPart2, {
          // //     appTokenHeader: process.env.zapierWebhookRequestAppToken,
          // //     requestContent_JSON: JSON_Message_Content,
          // //     expense_decision: "approved"
          // //   })
        }
      }
    } else {
      //this is the part to just send the request to the accountants channel, no more QBO/Zapier.
      console.log("request is under $10,000, so it doesn't need to be approved by two people.");
    }


    
  } catch (error) {
    console.log(error);
  };
});
//handles when a request is denied using the deny button
app.action("deny_approvers_ApproveDeny_BTN_ActionID", async ({ ack, body, client }) => {
  try {
    ack();
    var approverUserID = body.user.id;
    
    var messageBlocks = JSON.stringify(body.message.blocks);
    var messageBlocksTS = body.message.ts;
    var channelWithMessageWithBlocks = body.channel.id;

    //this handles creating the updated message, and updating that message.
    //returns a stringified JSON of Slack API call results and the ts of the JSON version of the message. 
      //this is to later find the JSON version of the message to POST to Zapier. 
    var functionResponse = await expenseRequest_UpdateRequestMSG(app, messageBlocks, approverUserID, channelWithMessageWithBlocks, messageBlocksTS, "denied");
    var functionResponse_parsed = JSON.parse(functionResponse);
    var JSON_Message_ts = functionResponse_parsed.JSON_Message_ts;
    var JSON_Message_Content_APIResult = await app.client.conversations.history({
      channel: process.env.requests_googleforms_json,
      latest: JSON_Message_ts,
      inclusive: true
    });
    var JSON_Message_Content = JSON_Message_Content_APIResult.messages[0].text;
    await axios
      .post(process.env.zapierProcessExpenseRequestPart2, {
        appTokenHeader: process.env.zapierWebhookRequestAppToken,
        requestContent_JSON: JSON_Message_Content,
        expense_decision: "denied"
      })
  } catch (error) {
    console.log(error);
  };
});
//helper functions that are used by the functions above to prevent cluttering, also just reusability.
  async function DMRequesterAboutRequestSubmission(requesterUserID, requestID, description, cost, imageLink, paymentDueByDate) {
    //removing the newline character from the description
    var description_withoutNewline = description.replace(/\\n/g, ' ');
    var message = `
\`\`\`Here is the expense request you submitted:\`\`\`
\`\`\`RequestID:${requestID}\`\`\`
Request Content:
${description_withoutNewline}

Request Cost:
$${cost}

Images Attached to request (if any):
${imageLink}

If approved, request must be paid by:
${paymentDueByDate}
`

  if (testStatusFile.test == "false") {
    //for production
    var messageResults = await app.client.chat.postMessage({
      channel: requesterUserID,
      text: message
    });
  } else if (testStatusFile.test == "true") {
      //for testing
      var messageResults = await app.client.chat.postMessage({
        channel: process.env.infoUserID,
        text: message
      });

    }
    return messageResults;
  };

  async function sendJSONVersionOfMSG(requesterUserID, requestID, descriptionEscaped, cost, vendorOrCustomer, vendorOrCustomerName, productName, paymentMethod, transactionType, imageLink, paymentDueByDate) {
    var message = `
{
  "reqID":"${requestID}",
  "requestedBy":"<@${requesterUserID}>",
  "requestContent":"${descriptionEscaped}",
  "requestCost":"${cost}",
  "vendorOrCustomer":"${vendorOrCustomer}",
  "vendorOrCustomerName":"${vendorOrCustomerName}",
  "productName":"${productName}",
  "paymentMethod":"${paymentMethod}",
  "transactionType":"${transactionType}",
  "requestPaidForByDate":"${paymentDueByDate}",
  "imageLinks":"${imageLink}"
}
`
    
    var messageResults = await app.client.chat.postMessage({
      channel: process.env.requests_googleforms_json,
      text: message
    });
    return messageResults;
  };

  async function sendErrorMessageOnThrow(requesterUserID, errorMsg) {    
    var messageResults = await app.client.chat.postMessage({
      channel: requesterUserID,
      text: errorMsg
    });
    return messageResults;
  };

  async function generateRequestID() {    
    var requestID = uuidv4(); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
    requestID += Date.parse(new Date); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
    return requestID;
  };

  //this basically handles updating the message with a log of the last user to approve/deny the request
  async function expenseRequest_UpdateRequestMSG(app, blocksArray, approverUserID, blockMessageChannelID, messageBlocksTS, userAlreadyApproved, listOfApprovers, listOfApproversTimestamps, decision) {
    var blocks = JSON.parse(blocksArray);
    var newUpdatedBlocks = [];
    //this returns the current time in UTC in 24 hour clock format.
      //returns something like this "2022-08-10T13:42:07.847Z"
    var time = new Date().toISOString();
    time = time.replace(/T/, ' ').replace(/\..+/, '');
    //this replace changes the above example into something like this: "2022-08-10 13:42:07"

    for (i=0; i<blocks.length; i++) {
      var block = blocks[i];
      //potentially the image that is returned has invalid parameters?
      //so, re-writing the image block
      if (block.block_id == "image_BlockID") {
        var newImageBlock = {
          "type": "image",
          "block_id": "image_BlockID",
          "image_url": "https://slack-requestapp.herokuapp.com/static/whiteLine_600_50.png",
          "alt_text": "A plain white image that's used to split messages."
        };
        newUpdatedBlocks.push(newImageBlock);
      } else if (block.block_id == "expenseRequestStatus_BlockID") {
        if (decision == "approved") {
          var newStatusBlock = `{
            "type": "section",
            "block_id": "expenseRequestStatus_BlockID",
            "text": {
                "type": "mrkdwn",
                "text": "*Current Request Status:*\\nApproved by <@${approverUserID}> at ${time} UTC"
            }
          }`;
          newUpdatedBlocks.push(JSON.parse(newStatusBlock));
        } else if (decision == "denied") {
          var newStatusBlock = `{
            "type": "section",
            "block_id": "expenseRequestStatus_BlockID",
            "text": {
                "type": "mrkdwn",
                "text": "*Current Request Status:*\\nDenied by <@${approverUserID}> at ${time} UTC"
            }
          }`;
          newUpdatedBlocks.push(JSON.parse(newStatusBlock));
        }
      } else if (block.block_id == "approvers_JSONts_BlockID") {
        //matches any string that's in the format of 123.123 but not 123 or 123.
        var JSON_Message_ts = block.text.text.match(/[0-9]*\.[0-9]*/g)[0];
      } else if (block.block_id == "expenseRequestStatus_numberOfApproversNeeded_BlockID") {
        var numberOfApproversNeeded = block.text.text.match(/\d+/g)[0];
        console.log(numberOfApproversNeeded);
        if (numberOfApproversNeeded > 0 && userAlreadyApproved == false) {
          console.log("subtracting...")
          var newNumberOfApproversNeeded = parseInt(numberOfApproversNeeded) - 1;
          var newStatus_numberOfApproversNeeded_Block = `{
            "type": "section",
            "block_id": "expenseRequestStatus_numberOfApproversNeeded_BlockID",
            "text": {
                "type": "mrkdwn",
                "text": "*Number of Approvers Needed:*\\n${newNumberOfApproversNeeded}"
            }
          }`
          newUpdatedBlocks.push(JSON.parse(newStatus_numberOfApproversNeeded_Block));
        } else {
          console.log('not subtracting...')
          //just push the blocks to the newUpdatedBlocks Array if the number of approvers needed is 0. 
          newUpdatedBlocks.push(block);
        }
      } else if (block.block_id == "expenseRequestStatus_ListOfApproversTimestamps_BlockID") {
        var newListOfApproversWithTimestampsFormatted = [];
        console.log(listOfApprovers);
        console.log(listOfApprovers[0]);
        console.log(listOfApproversTimestamps);
        console.log(listOfApproversTimestamps[0]);
        console.log(listOfApprovers.length);
        console.log(listOfApproversTimestamps.length);
        for (let i=0; i<=listOfApprovers.length - 1; i++) {
          var approver = listOfApprovers[i];
          var approverTimestamp = listOfApproversTimestamps[i];
          if (listOfApprovers.length-1 == i) {
            var newListOfApproversWithTimestamps = `{ "type": "mrkdwn", "text": "\><@${approver}> at ${approverTimestamp} UTC" }`;
          } else {
            var newListOfApproversWithTimestamps = `{ "type": "mrkdwn", "text": "\><@${approver}> at ${approverTimestamp} UTC" },`;
          }
          newListOfApproversWithTimestampsFormatted.push(newListOfApproversWithTimestamps);
          console.log(i);
          console.log(`listOfApprovers Length: ${listOfApprovers.length}`);
        };
        var newListOfApproversWithTimestampsFormattedAsString = JSON.stringify(newListOfApproversWithTimestampsFormatted).replaceAll('[', '(').replaceAll(']', ')').replaceAll('"', '');
        console.log(newListOfApproversWithTimestampsFormattedAsString)
        var originalText = block.text;
        originalText = delete originalText.text.verbatim;
        var newListOfApproversTimestampsBlock = `{
          "type": "section",
          "block_id": "expenseRequestStatus_ListOfApproversTimestamps_BlockID",
          "text": ${originalText},
          "fields": [${newListOfApproversWithTimestampsFormatted}]
        }`
        console.log(newListOfApproversTimestampsBlock);
        newUpdatedBlocks.push(JSON.parse(newListOfApproversTimestampsBlock));
      } else {
        newUpdatedBlocks.push(block);
      };
    };
    newUpdatedBlocks = JSON.stringify(newUpdatedBlocks);
    // match &amp;lt; and &amp;gt; to < and >
    newUpdatedBlocks = newUpdatedBlocks.replace(/&amp;lt;/g, '<');
    newUpdatedBlocks = newUpdatedBlocks.replace(/&amp;gt;/g, '>');
    var msgUpdateResult = await app.client.chat.update({
      channel: blockMessageChannelID,
      ts: messageBlocksTS,
      token: process.env.SLACK_BOT_TOKEN,
      text: "This message has been updated to log the last decision.",
      blocks: newUpdatedBlocks
    });
    var responseToReturn = {
      SlackAPIResponse: msgUpdateResult,
      JSON_Message_ts: JSON_Message_ts
    }
    return JSON.stringify(responseToReturn);
  }


//handle POST requests that are meant to update the original request maker on the status of the request
receiver.router.post("/slack/updateRequesterOnExpenseStatus", express.json(), async (req, res) => {
  if (req.body.checksum == process.env.updateRequesterOnRequestStatus_checksum) {
    var requestBody = req.body;
    await app.client.chat.postMessage({
      channel: requestBody.requesterUserID,
      text: `Your request with the ID of \`${requestBody.requestID}\` has been ${requestBody.decision}.`
    });
    
    res.send("Ok")
  } else {
    res.status(403).send("Forbidden. Check auth code matches.");
  }
});
//handles POST requests that are meant to update the approver about the request being logged in QBO.
receiver.router.post("/slack/updateApproverOnRequest", express.json(), async (req, res) => {
  if (req.body.checksum == process.env.updateRequesterOnRequestStatus_checksum) {
    var requestBody = req.body;
    await app.client.chat.postMessage({
      channel: requestBody.requesterUserID,
      text: `Your approval for the request with an ID of \`${requestBody.requestID}\` should have been logged in QuickBooks. Please check QuickBooks Online to confirm. Errors do occur.`
    });
    
    res.send("Ok")
  } else {
    res.status(403).send("Forbidden. Check auth code matches.");
  }
});
receiver.router.post("/slack/msgAccountantsChannel", express.json(), async (req, res) => {
  try {
    if (req.body.checksum == process.env.receiver_POST_checksum) {
      var cost = req.body.request_cost;
      var customerOrVendor = req.body.request_customer_or_vendor;
      var customerOrVendorName = req.body.request_customer_vendor_name;
      var description = req.body.request_description;
      var payByDate = req.body.request_pay_by_date;
      var paymentMethod = req.body.request_paymentMethod;
      var productName = req.body.request_product_name;
      var requestID = req.body.request_id;
  
      //create message to send to accountants channel
      var messageToSend = `An expense has been approved. The details are as follows: \n\nIt is a ${customerOrVendor} expense. \n\nThe ${customerOrVendor} is ${customerOrVendorName}. \n\nThe product is ${productName}. \n\nThe cost is $${cost}. \n\nThe payment method is ${paymentMethod}. \n\nThe payment is due by ${payByDate}. \n\nThe description is: ${description} \n\nPlease pay the expense request by the due date, if you need additional details, you can reference the requestID of ${requestID}.`;
      
      if (testStatusFile.test == "false") {
        //send message to accountants channel
        var slackAPIResponse = await app.client.chat.postMessage({
          channel: process.env.accountantsChannelID,
          text: messageToSend
        });
      } else if (testStatusFile.test == "true") {
        var slackAPIResponse = await app.client.chat.postMessage({
          channel: process.env.infoUserID,
          text: messageToSend
        });
      }
      var creatingResponse = {
        slackAPIResponse: slackAPIResponse,
      }
  
      res.status(200).send(creatingResponse);
    } else {
      res.status(403).send("Forbidden. Check auth code matches.");
    }
  }
  catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error, something messed up. Please remember what you did before this.");
  }
});

//this handles when the page the user is requesting doesn't exist. 
//it may be better to use an HTML file later, but for now,
//it sends plain text to the user.
receiver.router.use((req, res) => {
  res.status(404).send('404 Page Not Found');
});








//creating section for just test stuff.

//handles the test button for the expense request form.
//this should be used to test modal designs. 
  //the callback_id for this button is "createExpenseRequest-callback-test"
    //this callback_id is not being handled.
app.action("testActionButton", async ({ ack, client, body }) => {
  try {
    await ack();
  
    var APICallResults = await client.views.open({
      trigger_id: body.trigger_id,
      view: modalViews.createRequestView_test
    });
    console.log(APICallResults);
  } catch (error) {
    console.log(error);
  };
});



//this starts the bot
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app started');
})();