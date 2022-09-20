const testStatusFile = require("./testStatus.js");
const { v4: uuidv4 } = require('uuid');

//helper functions that are used by the functions above to prevent cluttering, also just reusability.
module.exports.DMRequesterAboutRequestSubmission = async function (app, requesterUserID, requestID, description, productName, productCost, transactionType_asText, paymentMethod, paymentToVendorOrCustomer, paymentToVendorOrCustomer_name, imageLink, paymentDueByDate, requestDetailMetadata, ApproversMessageMetadata) {
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

  if (testStatusFile.test == "false") {
    //for production
    var messageResults = await app.client.chat.postMessage({
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
  } else if (testStatusFile.test == "true") {
      //for testing
      var messageResults = await app.client.chat.postMessage({
        channel: process.env.infoUserID,
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

    }
    return messageResults;
  };

module.exports.sendErrorMessageOnThrow = async function (app, requesterUserID, errorMsg) {    
  var messageResults = await app.client.chat.postMessage({
    channel: requesterUserID,
    text: errorMsg
  });
  return messageResults;
};

module.exports.generateRequestID = async function () {
  var requestID = uuidv4(); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
  requestID += Date.parse(new Date); //this is used to generate a unique ID that's dependent on a UUID v4 and current time
  return requestID;
};

  //this basically handles updating the message with a log of the last user to approve/deny the request
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
    SlackAPIResponse: msgUpdateResult,
    JSON_Message_ts: JSON_Message_ts
  }
  return JSON.stringify(responseToReturn);
}

//Some of these functions were previously useful.
//they're not used anymore, but I'm keeping them here for reference.

// async function sendJSONVersionOfMSG(requesterUserID, requestID, descriptionEscaped, cost, vendorOrCustomer, vendorOrCustomerName, productName, paymentMethod, transactionType, imageLink, paymentDueByDate) {
//   var message = `
// {
// "reqID":"${requestID}",
// "requestedBy":"<@${requesterUserID}>",
// "requestContent":"${descriptionEscaped}",
// "requestCost":"${cost}",
// "vendorOrCustomer":"${vendorOrCustomer}",
// "vendorOrCustomerName":"${vendorOrCustomerName}",
// "productName":"${productName}",
// "paymentMethod":"${paymentMethod}",
// "transactionType":"${transactionType}",
// "requestPaidForByDate":"${paymentDueByDate}",
// "imageLinks":"${imageLink}"
// }
// `
  
//   var messageResults = await app.client.chat.postMessage({
//     channel: process.env.requests_googleforms_json,
//     text: message
//   });
//   return messageResults;
// };