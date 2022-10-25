const testStatusFile = require("./testStatus.js");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
//import path module for cuurrent directory
const path = require('path');
//slackAPIApplication is a global variable that references slack's API App.

//helper functions that are used by the functions above to prevent cluttering, also just reusability.
module.exports.DMRequesterAboutRequestSubmission = async function (requesterUserID, requestID, description, productName, productCost, transactionType_asText, paymentMethod, paymentToVendorOrCustomer, paymentToVendorOrCustomer_name, imageLink, paymentDueByDate, requestDetailMetadata, ApproversMessageMetadata) {
    //removing the newline character from the description
    var messageBlock = `{
      "blocks": [
        {
          "type": "header",
          "text": {
              "type": "plain_text",
              "text": "Here's the expense request you submitted",
              "emoji": true
          }
        },
        {
          "type": "section",
          "text": {
              "type": "mrkdwn",
              "text": "\`\`\`Request ID: ${requestID}\`\`\`"
          }
        },
        {
          "type": "divider"
        },
        {
          "type": "section",
          "text": {
              "type": "mrkdwn",
              "text": "Request Description: \\n${description}"
          }
        },
        {
          "type": "section",
          "fields": [
            {
                "type": "mrkdwn",
                "text": ">*Product Name:*\\n>${productName}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Product Cost:*\\n>$${productCost}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Expense Type/Category:*\\n>${transactionType_asText}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Payment Method:*\\n>${paymentMethod}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Vendor or Customer:*\\n>${paymentToVendorOrCustomer}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Vendor or Customer Name:*\\n>${paymentToVendorOrCustomer_name}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Payment should be made by:*\\n>${paymentDueByDate}"
            },
            {
                "type": "mrkdwn",
                "text": ">*Any images that may have been attached:*\\n>${imageLink}"
            }
          ]
        },
        {
          "type": "actions",
          "block_id": "RequestAddReplyButton_BlockID",
          "elements": [
            {
              "type": "button",
              "text": {
                "type": "plain_text",
                "text": "Add Reply to Request Submission",
                "emoji": true
              },
              "value": "RequestAddReplyButton_Value",
              "action_id": "RequestAddReplyButton_ActionID"
            }
          ]
        }
      ]
    }`
    //stringify the messageBlock
    messageBlock = JSON.stringify(JSON.parse(messageBlock).blocks);
    console.log(messageBlock);
//     var message = `
// \`\`\`Here is the expense request you submitted:\`\`\`
// \`\`\`RequestID:${requestID}\`\`\`
// Request Content:
// ${description_withoutNewline}

// Request Cost:
// $${cost}

// Images Attached to request (if any):
// ${imageLink}

// If approved, request must be paid by:
// ${paymentDueByDate}
// `

//this will message the requester about the request submission. 
//this serves as a confirmation notice to the requester that their request has been submitted.
//this previously was based on whether or not it's in test mode
//if it's in test mode, it would send messages to the info account which develops the app.
//if not, it would go to the normal channels.
//Refer to testing_application_notice.txt for more information.
    var messageResults = await slackAPIApplication.client.chat.postMessage({
      channel: requesterUserID,
      text: "Summary of your expense request",
      blocks: messageBlock,
      metadata: {
        "event_type": "requestApprovedAction", 
        "event_payload": {
          "requestDetails": requestDetailMetadata,
          "ApproversMessageMetadata": ApproversMessageMetadata
        }
      }
    });
    return messageResults;
};

//this is a general function that can be used to send a message to a user.
//it's called when there's an error when the app is processing a request submission.
//you can ask the user for the error message to figure out what's going on. 
module.exports.sendErrorMessageOnThrow = async function (userID, errorMsg, errorUUID, errorMsg_logging, errorStack, sendFile, sendFile_text) {
  //make sure UUID is provided
  if (errorUUID === null) {
    errorUUID = uuidv4();
  };
  //make sure sendFile is set to true or false, if not, set it to false.
  //it cannot be any other type of value besides boolean.
  //if it's a string, it'll be set to false.
  if ((sendFile !== true && sendFile !== false) || sendFile_text === undefined) {
    sendFile = false;
  };
  var errorStack_noFormatting = errorStack.replaceAll(/\[[0-9]*m/gm, "");
  var errorMsg = `${errorMsg}\n\nError ID: \`${errorUUID}\`\nProvide this error ID to the developer if you cannot figure out what is wrong.`;
  var errorMsg_logging = `${errorMsg_logging}\n\nError ID: \`${errorUUID}\`\nError Stack: \`\`\`${errorStack_noFormatting}\`\`\``;
  var messageResults_requester = await slackAPIApplication.client.chat.postMessage({
    channel: userID,
    text: errorMsg
  });
  var messageResults_logging = await slackAPIApplication.client.chat.postMessage({
    channel: process.env.slackErrorHandleChannel,
    text: errorMsg_logging
  });
  if (sendFile === true) {
    //create the file
    fs.writeFile(path.join(__dirname, `./errorLogs/${errorUUID}.txt`), sendFile_text, function (err) {
      if (err) {
        console.log(err);
      };
    });
    var messageResults_logging_fileupload = await slackAPIApplication.client.files.upload({
      channels: process.env.slackErrorHandleChannel,
      file: fs.createReadStream(path.join(__dirname, `./errorLogs/${errorUUID}.txt`)),
      filename: `${errorUUID}.txt`,
      title: `Error Logs for Error ID: ${errorUUID}`
    });
  }
  return {messageResults_requester, messageResults_logging};
};

//this function can be used anywhere, but as of the time of writing the comment,
//it's used 3 times in the app.
//it's used to send a message to the requester about the status of their request when it's approved or denied.
//sending messages to a channel can be done any specifying a channel ID in the userID parameter.
//it returns the Slack API response.
module.exports.sendMessageUserIDAndMessage = async function (app, userID, message) {
  console.log(userID);
  console.log(message);
  var messageResults = await app.client.chat.postMessage({
    channel: userID,
    text: message
  });
  return messageResults;
};

//this is just used to generate a requestID for requests that are submitted.
//it uses UUIDv4 to generate a random string.
//then it appends the current date and time to the end of the UUIDv4 string as a epoch timestamp. 
//this essentially garuntees that the requestID is unique.
module.exports.generateRequestID = async function () {
  var requestID = uuidv4(); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
  requestID += Date.parse(new Date); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
  return requestID;
};

//this function will update the Slack message in the approvers channel to reflect that the request has been denied.
//it will return the Slack API response to the chat.update API call.
//it will keep everything else the same.
//it overwrites the white image because it seems to have issues using the one send by the Slack App as it includes additional parameters.
//it will also update the block ID of "expenseRequestStatus_BlockID" to reflect the new updated status.
//a future idea is to remove the buttons after denying a request to prevent it from being approved after it's been denied.
module.exports.expenseRequest_UpdateRequestMSG_denied = async function (app, blocksArray, approverUserID, blockMessageChannelID, messageBlocksTS, decision) {
  var blocks = JSON.parse(blocksArray);
  var newUpdatedBlocks = [];
  //this returns the current time in UTC in 24 hour clock format.
  //returns something like this "2022-08-10T13:42:07.847Z"
  var time = new Date().toISOString();
  time = time.replace(/T/, ' ').replace(/\..+/, '');
  //this replace changes the above example into something like this: "2022-08-10 13:42:07"

  for (i=0; i<blocks.length; i++) {
    var block = blocks[i];
    if (block.block_id == "image_BlockID") {
      var newImageBlock = {
        "type": "image",
        "block_id": "image_BlockID",
        "image_url": "https://slack-requestapp.herokuapp.com/static/whiteLine_600_50.png",
        "alt_text": "A plain white image that's used to split messages."
      };
      newUpdatedBlocks.push(newImageBlock);
    } else if (block.block_id == "expenseRequestStatus_BlockID") {
      var newStatusBlock = `{
        "type": "section",
        "block_id": "expenseRequestStatus_BlockID",
        "text": {
            "type": "mrkdwn",
            "text": "*Current Request Status:*\\nDenied by <@${approverUserID}> at ${time} UTC"
        }
      }`;
      newUpdatedBlocks.push(JSON.parse(newStatusBlock));
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
    text: "This message has been updated to log the last decision (denied).",
    blocks: newUpdatedBlocks
  });
  return msgUpdateResult;
};

//this basically handles updating the message with a log of the last user to approve/deny the request
  //and a lot more stuff. So we're separating it into approve and deny functions
  //approve is the function below
  //deny is the function above
module.exports.expenseRequest_UpdateRequestMSG = async function (app, blocksArray, approverUserID, blockMessageChannelID, messageBlocksTS, userAlreadyApproved, listOfApprovers, listOfApproversTimestamps, decision) {
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
    } else if (block.block_id == "expenseRequestStatus_ListOfApproversTimestamps_BlockID" && decision == "approved") {
      var newListOfApproversWithTimestampsFormatted = [];
      // console.log(listOfApprovers);
      // console.log(listOfApprovers[0]);
      // console.log(listOfApproversTimestamps);
      // console.log(listOfApproversTimestamps[0]);
      // console.log(listOfApprovers.length);
      // console.log(listOfApproversTimestamps.length);
      for (let i=0; i<=listOfApprovers.length - 1; i++) {
        var approver = listOfApprovers[i];
        var approverTimestamp = listOfApproversTimestamps[i];
        var newListOfApproversWithTimestamps = `{ "type": "mrkdwn", "text": "\><@${approver}> at ${approverTimestamp} UTC" }`;
        newListOfApproversWithTimestampsFormatted.push(newListOfApproversWithTimestamps);
        // console.log(i);
        // console.log(`listOfApprovers Length: ${listOfApprovers.length}`);
      };
      var newListOfApproversWithTimestampsFormattedAsString = JSON.stringify(newListOfApproversWithTimestampsFormatted).replaceAll('[', '(').replaceAll(']', ')').replaceAll('"', '');
      console.log(newListOfApproversWithTimestampsFormattedAsString)
      var originalText = block.text;
      delete originalText.text.verbatim;
      originalText = JSON.stringify(originalText);
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
    SlackAPIResponse: msgUpdateResult
  }
  return JSON.stringify(responseToReturn);
}

//this function is for handling errors and logging them properly with a UUID. 
//the goal is that this function is called each time an error occurs and the UUID is returned to the user.
//then the user can message either the bot or the app dev with the UUID and the app dev can look up the error to help fix the issue.
module.exports.handleError = async function (error, invokerUserId) {
  var uuid = uuidv4();
  slackAPIApplication.chat.postMessage({
    channel: process.env.slackErrorHandleChannel,
    text: `An error has occurred. The UUID for this error is: ${uuid}.Error below:\\n\`\`\`${error}\`\`\``, 
  });
  slackAPIApplication.chat.postMessage({
    channel: invokerUserId,
    text: `An error has occurred. The UUID for this error is: \`${uuid}\`. Please notify the app developer with the UUID (it's the bit of text that looks different from the rest of this message) so that they can look into fixing it.`
  });
  console.log(`Error messages have been sent. UUID for this error is: ${uuid}`);
}