//import slack bolt for basic functionality with Slack API
const { App, ExpressReceiver } = require('@slack/bolt');
//import express.js for JSON parsing and static file serving
const express = require('express');
//import path for linking to static files
const path = require('path');
//import uuidv4 for generating unique IDs
const { v4: uuidv4 } = require('uuid');
//import node-cron to keep server alive
const nodecron = require('node-cron');
//import dotenv for environment variables
require('dotenv').config();

//reference local helper function files
//for test status of application
//returns true/false as string, not boolean
const testStatusFile = require('./testStatus.js');
//for helper functions
//these are functions that are used in multiple places/are too long to be in the main file
const helperFunctionsFile = require('./helperFunctions.js');
//for modal views inside of Slack
//these create the modals that are used in the application using Slack Block Kit
const modalViews = require("./modalViews.js");
//for message views inside of Slack
//these create and send the messages using predefined blocks using Slack Block Kit
const messageViews = require("./messageViews.js");
//reference local helper function files end

//set up nodecron to ping the heroku server every 20 minutes to avoid sleeping
//this will eventually be changed once Heroku finishes the transition to no free tier. 
//change is currently slated for end of November 2022.
nodecron.schedule('*/20 * * * *', () => {
	console.log("Pinging Heroku Server to keep alive app...");
	axios.get('https://slack-requestapp.herokuapp.com/nodecron-ping');
});

//creating a new ExpressReceiver object using the details found here: https://slack.dev/bolt-js/concepts#custom-routes
//this basically allows us to define endpoints for this application
const receiver = new ExpressReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET });

//create Slack Bolt App object
//this is the main object that will be used to interact with the Slack API
//include the ExpressReceiver object as a parameter
const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	receiver
});

//create static route which will be used to serve static files like images
//this basically creates a /static route which serves the files inside the /docs/images folder
receiver.router.use("/static", express.static(path.join(__dirname, '/docs/images')));

//previously, the app handled approvals and denials through a reaction system on Slack, but that is being deprecated as of 9/30/2022.
//the code for handling it via reactions can be found in the old file, but it will not be used here.




//this section handles app.action events
//these are events that are triggered when a user interacts with a modal or message
//this handles "createExpenseRequest" action
//this basically shows the user the modal depending on whether or not the app is in test mode
//if it's in test mode, only the maintainer can see the modal, everyone else gets a modal that shows the app is in test mode
//the maintainer's account is identified using their userID, which is set as an environment variable. 
//If there's a need for more than 1 maintainer, this will need to be changed to an array of userIDs, and you'd need to parse through the array to see if the user is in the maintainer array.
app.action("createExpenseRequest", async ({ ack, client, body }) => {
	try {
		await ack();
		console.log(body);
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
//this handles the "PaymentMethod_ActionID" action which is triggered when the user selects a payment method in the modal (either card or cash)
//this basically enables users to provide additional necessary info if they choose cash as the payment method.
//if it's cash --> credit card, then the cash info section is hidden from the user. 
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
});
//handles the "createExpenseRequest-callback" view
//it's included in this section because it's triggered by the "createExpenseRequest" action even though it's a view
//it's triggered when the user submits the modal
//basically parses the submission, sends the info into approvers' channel, then sends a DM to the requester with a summary of their request.
app.view("createExpenseRequest-callback", async ({ ack, body, view, client }) => {
	try {
		await ack();
		var customErrorMsg;
		var requesterUserID = body.user.id;
		var formSubmittionValues = body.view.state.values;

		var requestID = await helperFunctionsFile.generateRequestID();
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
			await helperFunctionsFile.sendErrorMessageOnThrow(app, requesterUserID, customErrorMsg);
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
			await helperFunctionsFile.sendErrorMessageOnThrow(requesterUserID, customErrorMsg);
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
			await helperFunctionsFile.sendErrorMessageOnThrow(requesterUserID, customErrorMsg);
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

		// //creating JSON version of msg
		//   //this function returns the results of the API call if that is something that's needed.
		// var JSONMSGSentResult = await sendJSONVersionOfMSG(requesterUserID, requestID, DescriptionEscaped, Cost, VendorOrCustomer, VendorOrCustomerName, productName, paymentMethod, transactionType, imageLink, paymentDueByDate);
		// var JSONMSG_ts = await JSONMSGSentResult.ts;

		//Sending request to Approvers' channel
		//this function returns the results of the API call if that is something that's needed.
		//this is still set to msg requester with this info.
		// create JSON containing the variables required in the function messageViews.createRequestMessageForApprovers(): 
		var JSONWithData = JSON.stringify({
			requesterID: requesterUserID,
			requestID: requestID,
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


		var RequesterSummaryMessageMetadata = {
			"requesterUserID": requesterUserID,
			"requestID": requestID,
			"description": DescriptionEscaped,
			"cost": Cost,
			"vendorOrCustomer": VendorOrCustomer,
			"vendorOrCustomerName": VendorOrCustomerName,
			"productName": productName,
			"paymentMethod": paymentMethod,
			"transactionType": transactionType,
			"imageLink": imageLink,
			"paymentDueByDate": paymentDueByDate,
		};
		var ApproversMessageMetadata = {
			approversMessageTimestamp: messageViewsResult.ts,
			approversChannelID: messageViewsResult.channel
		}

		//DM requester about their submission
		//this function returns the results of the API call if that is something that's needed.
		await helperFunctionsFile.DMRequesterAboutRequestSubmission(app, requesterUserID, requestID, DescriptionEscaped, productName, Cost, transactionType_text, paymentMethod_text, VendorOrCustomer, VendorOrCustomerName, imageLink, paymentDueByDate, RequesterSummaryMessageMetadata, ApproversMessageMetadata);
		//when using reply feature, look for body.messages.metadata to get the metadata of the message with the button that was clicked.
	} catch (error) {
		console.log(error);
	};
});
//handles the "approve_approvers_ApproveDeny_BTN_ActionID" action
//this is basically triggered whenever the request is approved by an approver.
app.action("approve_approvers_ApproveDeny_BTN_ActionID", async ({ ack, body, client }) => {
	try {
		ack();
		console.log("Approve Button Clicked\n\n" + JSON.stringify(body));
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
		var requesterUserID = messageMetadata.messages[0].metadata.event_payload.requesterUserID;
		var requestID = messageMetadata.messages[0].metadata.event_payload.requestID;
		var metadataApprovalCount = messageMetadata.messages[0].metadata.event_payload.numberOfApprovals;
		var newMetadataApprovalCount = (metadataApprovalCount + 1) % 2;
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
		var functionResponse = await helperFunctionsFile.expenseRequest_UpdateRequestMSG(app, messageBlocks, approverUserID, channelWithMessageWithBlocks, messageBlocksTS, userAlreadyApproved, listOfApprovers, listOfApproversTimestamps, "approved");

		if (metadataRequestCost >= 10000) { //this checks if the request is over or equal to $10,000 
			//this part can be fixed later to use the modulus (%) operator.
			if (userAlreadyApproved == true) {
				//if the user has already approved this request, then don't do anything, but send them a message saying that they've already approved this request, and include the requestID.
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
					//^if it's the second approver, then reset the metadataApprovalCount to be empty.
					await client.chat.update({
						channel: channelWithMessageWithBlocks,
						text: originalMessageText,
						ts: messageBlocksTS,
						metadata: metadata
					});
					console.log("Request has been approved by two approvers. RequestID: " + messageMetadata.messages[0].metadata.event_payload.requestID);

					var blocksForAccountants = [{
						"type": "section",
						"block_id": "blocksForAccountant_2approvers_BlockID",
						"text": {
							"type": "mrkdwn",
							"text": "A request has been approved. It is my understanding that the accountants know what will happen from this point on."
						}
					}];
					for (i = 0; i < body.message.blocks.length; i++) {
						if (body.message.blocks[i].block_id == "approvers_requestDescription_BlockID") {
							blocksForAccountants.push(body.message.blocks[i]);
						} else if (body.message.blocks[i].block_id == "approvers_requestInformation_BlockID") {
							blocksForAccountants.push(body.message.blocks[i]);
						} else if (body.message.blocks[i].block_id == "approvers_requestID_BlockID") {
							blocksForAccountants.push(body.message.blocks[i]);
						}
					};
					//this enables the ability to send along the button that allows the accountants to add replies to the message inside of approvers channel. 
					blocksForAccountants.push({
						"type": "section",
						"block_id": "followUpSection_BlockID",
						"text": {
							"type": "mrkdwn",
							"text": "If you have any questions or concerns regarding this request, please message the approver: <@" + approverUserID + "> directly and you can reference the Request ID which is unique for each request.",
							"verbatim": false
						}
					});
					//if test mode don't send to accountants channel
					if (testStatusFile.test == "false") {
						console.log("is test false required 2 approvers")
						await client.chat.postMessage({
							channel: process.env.accountantsChannelID,
							text: "Request has been approved by 2 people. Please review the request and make the payment if necessary. It is my understanding that the accountants already know what will happen from this point on.",
							blocks: blocksForAccountants
						});
					} else if (testStatusFile.test == "true") {
						console.log("is test true required 2 approvers")
						await client.chat.postMessage({
							channel: process.env.devchannel,
							text: "Request has been approved by 2 people. Please review the request and make the payment if necessary. It is my understanding that the accountants already know what will happen from this point on.",
							blocks: blocksForAccountants
						});
					};
					await helperFunctionsFile.sendMessageUserIDAndMessage(app, requesterUserID, `Your request with the ID of "${requestID}" has been approved. It has been sent to the accountants channel.`)
				}
			}
		} else {
			var blocksForAccountants = [{
				"type": "section",
				"block_id": "blocksForAccountant_1approver_BlockID",
				"text": {
					"type": "mrkdwn",
					"text": "A request has been approved. It is my understanding that the accountants know what will happen from this point on."
				}
			}];
			for (i = 0; i < body.message.blocks.length; i++) {
				if (body.message.blocks[i].block_id == "approvers_requestDescription_BlockID") {
					blocksForAccountants.push(body.message.blocks[i]);
				} else if (body.message.blocks[i].block_id == "approvers_requestInformation_BlockID") {
					blocksForAccountants.push(body.message.blocks[i]);
				} else if (body.message.blocks[i].block_id == "approvers_requestID_BlockID") {
					blocksForAccountants.push(body.message.blocks[i]);
				}
			};
			//this enables the ability to send along the button that allows the accountants to add replies to the message inside of approvers channel. 
			blocksForAccountants.push({
				"type": "section",
				"block_id": "followUpSection_BlockID",
				"text": {
					"type": "mrkdwn",
					"text": "If you have any questions or concerns regarding this request, please message the approver: <@" + approverUserID + "> directly and you can reference the Request ID which is unique for each request.",
					"verbatim": false
				}
			});
			if (testStatusFile.test == "false") {
				console.log("is test false");
				await client.chat.postMessage({
					channel: process.env.accountantsChannelID,
					text: "Request has been approved. Please review the request and make the payment if necessary. It is my understanding that the accountants already know what will happen from this point on.",
					blocks: blocksForAccountants
				});
			} else if (testStatusFile.test == "true") {
				console.log("is test true")
				await client.chat.postMessage({
					channel: process.env.devchannel,
					text: "Request has been approved. Please review the request and make the payment if necessary. It is my understanding that the accountants already know what will happen from this point on.",
					blocks: blocksForAccountants
				});
			};
			await helperFunctionsFile.sendMessageUserIDAndMessage(app, requesterUserID, `Your request with the ID of \`${requestID}\` has been approved. It has been sent to the accountants channel.`)
			//this is the part to just send the request to the accountants channel, no more QBO/Zapier.
			console.log("request is under $10,000, so it doesn't need to be approved by two people.");
		}
	} catch (error) {
		console.log(error);
	};
});
//this handles the "deny_approvers_ApproveDeny_BTN_ActionID" action
//this is the action that is used to deny a request
//triggered by the "Deny" button in the approvers channel
app.action("deny_approvers_ApproveDeny_BTN_ActionID", async ({ ack, body, client }) => {
	try {
		ack();
		console.log(body);
		var requesterUserID = body.message.metadata.event_payload.requesterUserID;
		var requestID = body.message.metadata.event_payload.requestID;
		var approverUserID = body.user.id;
		var message = `Hello, your request with the ID of \`${requestID}\` has been denied. Please contact the approver (<@${approverUserID}>) directly if you have any questions or concerns.`;

		var approverUserID = body.user.id;
		var messageBlocks = JSON.stringify(body.message.blocks);
		var messageBlocksTS = body.message.ts;
		var channelWithMessageWithBlocks = body.channel.id;

		//this update updates the message to show that the request has been denied.
		var functionResponse = await helperFunctionsFile.expenseRequest_UpdateRequestMSG_denied(app, messageBlocks, approverUserID, channelWithMessageWithBlocks, messageBlocksTS, "denied");

		//send message to requester or devchannel depending on test status
		await helperFunctionsFile.sendMessageUserIDAndMessage(app, requesterUserID, message);

	} catch (error) {
		console.log(error);
	};
});
//this handle the "RequestAddReplyButton_ActionID" action
//this is triggered by someone who creates a request from the request summary that's sent to them
//after they submit the request.
//this is just to allow them to add a reply to the submission message in the approvers' channel.
app.action("RequestAddReplyButton_ActionID", async ({ ack, body, client }) => {
	try {
		ack();
		console.log("\nRequestAddReplyButton_ActionID.body\n" + JSON.stringify(body));
		var approversMetadata = body.message.metadata.event_payload.ApproversMessageMetadata;
		var addReplyButtonChannelAndTS = {
			channel: body.channel.id,
			ts: body.message.ts
		};
		var metadata = {
			approversMetadata: approversMetadata, //this contains metadata with the necessary information to trace the same request in the approvers channel.
			addReplyButtonChanneAndTS: addReplyButtonChannelAndTS //this is the channel and ts of the message with the add reply button
		};
		var view = await modalViews.RequestAddReplyView(metadata);
		var APICallResults = await client.views.open({
			trigger_id: body.trigger_id,
			view: view
		});
		console.log(APICallResults);
	} catch (error) {
		console.log(error.data.response_metadata.messages);
	};
});
//this handles the "RequestAddReplyButton-callback" view
//this is triggered by the "RequestAddReplyButton_ActionID" action above
//which is why it's in the action section. Makes more sense to have it here as it's right after the action.
app.view("RequestAddReplyButton-callback", async ({ ack, body, view, client }) => {
	try {
		ack();
		console.log("\nRequestAddReplyButton-callback.body\n" + JSON.stringify(body));
		//get private metadata by doing JSON.parse(body.private_metadata)
		var privateMetadata = JSON.parse(body.view.private_metadata);
		//four options available
		//approversMessageTimestamp and approversChannelID under approversMetadata
		//channel and ts under addReplyButtonChanneAndTS
		var approversMessageTimestamp = privateMetadata.approversMetadata.approversMessageTimestamp;
		var approversChannelID = privateMetadata.approversMetadata.approversChannelID;
		var addReplyButtonChannel = privateMetadata.addReplyButtonChanneAndTS.channel;
		var addReplyButtonTS = privateMetadata.addReplyButtonChanneAndTS.ts;
		//get submitted text by doing body.state.values.RequestAddReplyButton_Text_BlockID.RequestAddReplyButton_Text_ActionID.value
		var submittedText = body.view.state.values.RequestAddReplyButton_Text_BlockID.RequestAddReplyButton_Text_ActionID.value;
		submittedText = `<!channel>\nNew Reply from <@${body.user.id}>. They said: \n\n` + submittedText
		//make call to chat.postMessage to reply to the message at the timestamp and channelID specified for approvers channel
		var APICallResults = await client.chat.postMessage({
			channel: approversChannelID,
			text: submittedText,
			thread_ts: approversMessageTimestamp
		});
		console.log("APICallResults\n" + JSON.stringify(APICallResults));
		// the API call below is to update the message with the add reply button with a new reply to have a log of what's been said.
		var APICallResultsToRequester = await client.chat.postMessage({
			channel: addReplyButtonChannel,
			text: submittedText,
			thread_ts: addReplyButtonTS
		});
		console.log("APICallResultsToRequester\n" + JSON.stringify(APICallResultsToRequester));
	} catch (error) {
		console.log(error);
	};
});






//this section handles the shortcuts
//this handles the "request-app-check-status" shortcut
//this is the shortcut that is used to check the status of the application
//this may be deprecated later on depending on whether develoment/production apps are set up properly
app.shortcut("request-app-check-status", async ({ ack, body, client, shortcut }) => {
	try {
		ack();
		var view = await modalViews.checkTestStatus();

		await client.views.open({
			trigger_id: shortcut.trigger_id,
			view: view
		});
	} catch (error) {
		console.log(error);
	}
});







//this section will be for slash commands that the app will handle
//this handles the "/userid" command
//this command will return the user ID of the user who typed the command to their DMs
//if a user mentions another user in the command, it will return the user ID of the mentioned user
app.command('/userid', async ({ command, ack, say }) => {
	try {
		await ack();
		if (command.text.includes("@") == false) {
			var userID = command.user_id;
			app.client.chat.postMessage({
				channel: userID,
				text: `Your user ID is ${userID}`,
			});
		} else {
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
		console.error(error);
	}
});
//this handles the "/request" command
//"/request" currently sends the Google Forms Link, but will eventually be replaced to send the modal view, if possible.







//this section will be for receiver.router endpoints that the app will handle
//this essentially handles different endpoints that the app will have
//this can be used for a variety of things.

//this handles the "/" endpoint
//this is just a hello page
receiver.router.get('/', (req, res) => {
	res.send('Hello People!');
});
//this handles the "/nodecron-ping" endpoint
//basically to avoid a 404 not found error in Heroku Logs
receiver.router.get('/nodecron-ping', (req, res) => {
	res.send('{"status": "ok"}');
});
//this handles the "/slack/help/GoogleDriveImagePerms" endpoint which is referenced inside the modal view when creating a new request
//it will basically just send an HTML file
receiver.router.get('/slack/help/GoogleDriveImagePerms', (req, res) => {
	res.sendFile(path.join(__dirname, "html/GoogleDriveImgPerms.html"));
});
//this handles the 404 error page
//this message will be shown when any user tries to access an endpoint that doesn't exist
receiver.router.use((req, res) => {
	res.status(404).send('404 Page Not Found');
});






//this starts the bot
(async () => {
	await app.start(process.env.PORT || 3000);
	console.log('⚡️ Bolt app started');
})();